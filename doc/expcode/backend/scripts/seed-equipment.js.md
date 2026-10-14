# backend/scripts/seed-equipment.js

## 1. หน้าที่ของไฟล์

นำรายการอุปกรณ์จาก `data/equipment/equipment.json` เข้า MySQL (ตาราง `equipment` และ `equipment_usage`) พร้อมตรวจความถูกต้องของข้อมูลก่อนเขียน และมี "ด่านสุดท้าย" ที่ปฏิเสธการนำเข้าถ้าข้อมูลยังไม่ถูกผู้พัฒนาตรวจ (`reviewed_by_author !== true`) ไฟล์นี้ไม่มีคอมเมนต์หัวไฟล์

- **ใครเรียกใช้**: คนรัน `npm run seed:equipment` (สคริปต์ใน `backend/package.json`) ; รองรับ `--verify` และ argument เป็น path ไฟล์
- **เรียกใช้**: `dotenv/config`, `node:fs`, `node:path`, `mysql2/promise` ; ตารางจาก `migrations/003`
- **ผลลัพธ์ถูกอ่านต่อโดย**: `equipment.repository.ts` ตอนบูตเซิร์ฟเวอร์

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่และ config (บรรทัด 1–26)
`DEFAULT_FILE = ../../data/equipment/equipment.json` ; `VALID_CATEGORIES` = 5 ประเภท (ตรงกับ ENUM ใน migration 003) ; `connectionConfig()` แบบเดียวกับ `seed-graphs.js`

### บล็อก B — `validate(data)` (บรรทัด 27–106) คืนรายการปัญหา
- `schema_version` ต้องเป็น 1 (30–32)
- ตาราง `equipment`: ต้องมี `equipment_id` ไม่ซ้ำ, `name_th`, `name_en` ไม่ว่าง (35–53)
- ตาราง `equipment_usage` (กลุ่มต่อประเภทเครื่อง): ประเภทต้องอยู่ใน 5 ค่า (59–64) ไม่ประกาศซ้ำ (66–69); แต่ละรายการต้องอ้าง `equipment_id` ที่ประกาศไว้ (77–79), ไม่ซ้ำในประเภทเดียวกัน (81–85), มี `purpose_th` (86–88)
- **กฎที่มา** (90–101): ต้องมี `source_page` หรือ `author_note` อย่างน้อยหนึ่งอย่าง — เป็นกฎเดียวกับ `CHECK chk_usage_provenance` ในฐานข้อมูล ตรวจซ้ำเพื่อให้ error อ่านรู้เรื่องกว่า

### บล็อก C — `seed(conn, data)` (บรรทัด 108–155)
1. upsert ทุกแถว `equipment` ทีละแถวด้วย `INSERT … ON DUPLICATE KEY UPDATE` (112–121) — ใช้ upsert เพราะ `equipment_usage` อ้างถึงด้วย FK ถ้าลบแล้วเขียนใหม่ usage จะถูกลบตาม (CASCADE)
2. ต่อประเภทเครื่อง: `DELETE FROM equipment_usage WHERE device_category = ?` แล้ว bulk `INSERT … VALUES ?` (128–150) — ทำได้เพราะไม่มีตารางไหนอ้าง `equipment_usage` และทำเพื่อให้รายการที่ถูกลบออกจาก JSON หายจาก DB ด้วย ; `display_order` = ลำดับ `i`
3. คืน `{ equipment, usage }`

### บล็อก D — `report(conn)` (บรรทัด 157–192)
พิมพ์จำนวน, ตารางแยกประเภทเครื่อง (รวม / อ้างคู่มือ / เขียนเอง) และเตือนประเภทที่ยังไม่มีข้อมูล (⬜)

### บล็อก E — `main()` (บรรทัด 193–260)
อ่านไฟล์ → `validate` (ถ้าพบปัญหา พิมพ์ ✗ แล้ว `exit(1)`) → **ด่านสุดท้าย** (218–237): ถ้า `data.reviewed_by_author !== true` พิมพ์ข้อความยกเลิกยาวและ `exit(1)` — เหตุผลในข้อความ: รายการอุปกรณ์เป็นร่างที่ AI ช่วยดึงจากคู่มือ ตามกฎโครงงานต้องให้ผู้พัฒนากำกับเอง (อ่านทุกรายการ ตรวจ `source_page` เปิดคู่มือแล้วเจอจริง แก้คำอธิบายเป็นภาษาตัวเอง แล้วเปลี่ยนเป็น `true`) → `--verify` ออกหลังผ่านด่าน → transaction (`beginTransaction`/`commit`/`rollback`) เพราะเป็น DML

## 3. การส่งข้อมูล

```
data/equipment/equipment.json ─► validate ─► ด่าน reviewed_by_author ─► [transaction]
     equipment (upsert) → equipment_usage (DELETE ต่อประเภท + bulk INSERT) → commit → report
```

## 4. จุดที่ควรระวัง

- **ด่าน `reviewed_by_author`** บล็อกการนำเข้าทั้งหมดถ้าไม่เป็น `true` เป๊ะๆ (ตรวจหลัง `validate` และก่อน `--verify` จะจบ) ; ค่าในไฟล์จริงตอนนี้ดูได้จากสรุปของ `data/equipment/equipment.json`
- **ประเภทเครื่องที่ถูกลบออกทั้งกลุ่มจาก JSON ไม่ถูกลบจาก DB** (ลบเฉพาะประเภทที่ยังอยู่ในไฟล์) ; อุปกรณ์ใน `equipment` ที่เลิกใช้ก็ไม่ถูกลบ
- **`--` บน PowerShell 5.1** อาจถูกตัด (เหมือนสคริปต์อื่น)
- ข้อความ error ในด่านสุดท้ายเป็นข้อความยาวภาษาไทยพิมพ์ทาง `console.error` ทั้งหมด
- ไม่มีการตรวจว่า `DB_*` ครบ

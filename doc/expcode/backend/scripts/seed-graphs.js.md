# backend/scripts/seed-graphs.js

## 1. หน้าที่ของไฟล์

นำกราฟจากไฟล์ JSON ใน `data/manuals/` เข้า MySQL (ตาราง `manuals`, `graphs`, `nodes`) โดยตรวจโครงสร้างก่อนเขียน และรายงานผลหลังเขียน ค่าเริ่มต้นนำเข้า `data/manuals/samsung_ac_ar70h.json`

- **ใครเรียกใช้**: คนรัน `npm run seed` (หรือ `npm run seed -- data/manuals/xxx.json` / `-- --verify`)
- **เรียกใช้**: `dotenv/config`, `node:fs`, `node:path`, `mysql2/promise` ; อ่านไฟล์ข้อมูลจากรากโปรเจกต์; ตารางที่สร้างโดย `migrations/001`
- **ผลลัพธ์ถูกอ่านต่อโดย**: `graph.repository.ts` ตอนบูตเซิร์ฟเวอร์

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์: ทำไม upsert (บรรทัด 1–17)
ตาราง `sessions` มี FK ไป `graphs` แบบ `ON DELETE RESTRICT` ถ้า seed ด้วย `DELETE FROM graphs` จะพังเมื่อมีคนใช้งานอยู่ จึงใช้ `INSERT … ON DUPLICATE KEY UPDATE` ; ส่วน `nodes` ไม่มีใครอ้างถึง ลบทิ้งแล้วเขียนใหม่ได้ (ให้โหนดที่ถูกลบออกจาก JSON หายจาก DB ด้วย)

### บล็อก B — ค่าคงที่และ `connectionConfig()` (บรรทัด 19–41)
`DEFAULT_MANUAL = ../../data/manuals/samsung_ac_ar70h.json` ; config เชื่อมต่อ (ไม่ตรวจว่า env ครบหรือไม่ ต่างจาก `run-migrations.js`) ; `ssl` จาก `DB_SSL_CA`

### บล็อก C — `validateManual(manual)` (บรรทัด 43–93)
ตรวจเชิงโครงสร้างที่ DB ตรวจให้ไม่ได้ คืนรายการปัญหา:
- `schema_version` ของไฟล์ต้องเป็น 2 (54–56)
- `entry_node` ของแต่ละกราฟต้องมีในกราฟ (61–63)
- เส้นเชื่อมทุกเส้น (`on_yes`, `on_no`, `next`, `on_invalid`) ต้องชี้ไปโหนดที่มีจริง (65–78) — ชดเชยการไม่มี FK
- `safety_critical` ต้องอยู่บน `instruction` เท่านั้น และต้องมี `safety_warning` ไม่ว่าง (80–88)

### บล็อก D — แปลงโหนดเป็นแถว (บรรทัด 95–137)
- `textOf(node)`: เลือก `question` / `content` / `prompt` ตามชนิด; ชนิดที่ไม่รู้จักโยน error
- `nodeToRow(graphId, node, order)`: คืน array 19 ค่าเรียงตามคอลัมน์ของตาราง `nodes` — `node.next` → `next_node`, `node.pattern` → `input_pattern`, `safety_critical === true` เป็น boolean, `external_reference` ผ่าน `JSON.stringify`, `order` → `display_order`

### บล็อก E — `seedManual(conn, manual)` (บรรทัด 143–227)
1. upsert `manuals` ด้วย `conn.execute` (145–163) ; `graph_count` = จำนวนกราฟในไฟล์
2. วนทุกกราฟ: upsert `graphs` (169–203) — ไม่กระทบ session ที่ใช้อยู่ ; `entry_symptom_th || null`, aliases/config ผ่าน `JSON.stringify`, `page_range[0]/[1]` → `page_start/page_end`
3. `DELETE FROM nodes WHERE graph_id = ?` (207) แล้ว bulk `INSERT INTO nodes … VALUES ?` ครั้งเดียวต่อกราฟ (212–221)
4. คืน `{ graphs, nodes }`

### บล็อก F — `report(conn)` (บรรทัด 233–259)
พิมพ์จำนวนคู่มือ/กราฟ/โหนดใน DB, แยกตามชนิดโหนด และรายการโหนด `safety_critical` (graph / node)

### บล็อก G — `main()` (บรรทัด 263–309)
อ่าน argument (ไฟล์ที่ระบุ หรือค่าเริ่มต้น) ; `--verify` = ตรวจอย่างเดียว ; ถ้ามีปัญหา พิมพ์ ✗ แล้ว `exit(1)` ; ครอบการเขียนด้วย transaction (`beginTransaction` / `commit` / `rollback`) เพราะเป็น INSERT/DELETE ไม่ใช่ DDL ; ปิด connection ใน `finally` ; error รวมที่ 311–314

## 3. การส่งข้อมูล

```
data/manuals/<ไฟล์>.json ─JSON.parse─► validateManual ─(ผ่าน)─► [transaction]
     manuals (upsert) → graphs (upsert) → nodes (DELETE + bulk INSERT) → commit → report
                                                        │
                                                        ▼
                                            MySQL ← GraphRepository.loadAll() อ่านตอนบูต
```

## 4. จุดที่ควรระวัง

- **`ON DUPLICATE KEY UPDATE` ของ `graphs` ไม่อัปเดต `schema_version`** (รายการอัปเดตบรรทัด 176–186 ไม่มีคอลัมน์นี้) ถ้าเปลี่ยน `schema_version` ในไฟล์ข้อมูล ค่าใน DB จะไม่เปลี่ยนตาม (อนุมานจากโค้ด)
- **กราฟที่ถูกลบออกจากไฟล์ JSON ไม่ถูกลบจาก DB** (ไม่มี `DELETE FROM graphs` ตามเหตุผลข้างบน) ทำให้กราฟเก่ายังค้างในตาราง
- **เปลี่ยนโหนดขณะมี session ที่กำลังเดิน**: ลบแล้วเขียน `nodes` ใหม่ ทำให้ session ที่ `current_node_id` ชี้โหนดที่ถูกลบ/เปลี่ยน id จะเจอ `NodeNotFoundError` (500 `GRAPH_NODE_MISSING`) — และ `GraphRepository` ในเซิร์ฟเวอร์ที่รันอยู่ยังเป็นข้อมูลเก่าจนกว่าจะรีสตาร์ต (อนุมานจากโค้ด)
- **`--` บน PowerShell 5.1 ถูกตัด** (ดู `run-migrations.js`) `npm run seed -- --verify` อาจรันจริงโดยไม่ตั้งใจ ; แนะนำเรียก `node scripts/seed-graphs.js --verify` ตรงๆ
- สคริปต์ไม่ตรวจว่า `DB_*` ครบ (ต่างจาก `run-migrations.js`) ถ้าขาดจะได้ error จาก driver

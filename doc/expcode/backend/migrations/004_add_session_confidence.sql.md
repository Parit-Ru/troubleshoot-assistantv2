# backend/migrations/004_add_session_confidence.sql

## 1. หน้าที่ของไฟล์

เพิ่มคอลัมน์ `confidence` ในตาราง `sessions` เก็บ "คะแนนความมั่นใจของ session" (ขั้น 1.8) = คะแนนความคล้าย (cosine) ระหว่างคำค้นของผู้ใช้กับผังขั้นตอนที่เลือก เซิร์ฟเวอร์คำนวณเองตอนเริ่ม session ไม่รับค่าจากหน้าเว็บ ไม่ใช่ความน่าจะเป็น และไม่มีผลต่อการเปลี่ยนสถานะ (แสดงผลอย่างเดียว)

- **ใครเรียกใช้**: `scripts/run-migrations.js`
- **ใครใช้คอลัมน์**: `session.store.ts` (`create` เขียน, `find` อ่าน), `traversal.service.ts` (ส่งเป็นฟิลด์ `confidence` ใน response)
- **เรียกใช้**: ตาราง `sessions` จาก migration 002

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ (บรรทัด 1–17)
- ความหมายของค่า: `NULL` = ไม่มีการจับคู่ให้วัด (ผู้ใช้เลือกอาการจากรายการเอง หรือระบบค้นหายังไม่พร้อม) — **ห้ามใช้ 0 หรือ 1 แทน** เพราะจะปนกับ "คะแนนต่ำจริง"/"ตรงเป๊ะจริง"
- เพิ่มได้อย่างปลอดภัย: คอลัมน์ NULL เท่านั้น แถวเดิมได้ NULL อัตโนมัติ และโค้ดรุ่นก่อนหน้ายังอ่านตารางได้
- `DECIMAL(4,3)` = ทศนิยม 3 ตำแหน่ง ตรงกับที่ API ปัดเศษ (เช่น 0.707)
- ไม่ใช้ `IF NOT EXISTS` เพราะ MySQL ไม่รองรับกับ `ADD COLUMN` ตัวรัน migration จำไฟล์ที่รันแล้วจึงไม่รันซ้ำ

### บล็อก B — `ALTER TABLE sessions ADD COLUMN confidence` (บรรทัด 19–22)
`confidence DECIMAL(4,3) NULL COMMENT '…' AFTER variables`

## 3. การส่งข้อมูล

```
POST /traversal/sessions {graphId, query} ─► SymptomSearchService.scoreGraph ─► confidence ─► INSERT sessions.confidence
GET /traversal/sessions/:id ◄── SELECT confidence (DECIMAL → string ใน mysql2 → Number ใน session.store.ts)
```

## 4. จุดที่ควรระวัง

- `DECIMAL(4,3)` เก็บค่าได้ −9.999 ถึง 9.999 ครอบคลุมช่วง cosine (−1 ถึง 1) ; `mysql2` ส่ง DECIMAL กลับเป็นข้อความ จึงต้องแปลง `Number(...)` (ทำใน `session.store.ts` บรรทัด 114)
- การรันซ้ำจะ error ("Duplicate column name") ถ้าตัวรัน migration ไม่จำสถานะ (อนุมานจากพฤติกรรมของ MySQL)
- ลำดับการขึ้นระบบ: รัน migration ก่อน แล้วค่อย deploy โค้ดใหม่ที่ `SELECT confidence`

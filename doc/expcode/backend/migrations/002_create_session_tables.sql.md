# backend/migrations/002_create_session_tables.sql

## 1. หน้าที่ของไฟล์

สร้างตารางกลุ่ม "ข้อมูลผู้ใช้" 2 ตาราง ที่ถูกเขียนตลอดเวลาที่มีคนใช้งาน: `sessions` (สถานะปัจจุบันของการวินิจฉัย 1 ครั้ง) และ `session_history` (เดินผ่านโหนดอะไร ตอบอะไรไป)

- **ใครเรียกใช้**: `scripts/run-migrations.js`
- **ใครใช้ตาราง**: `session.store.ts` (อ่าน/เขียนทั้งหมด), `scripts/show-session-history.js` (ดูประวัติ)
- **เรียกใช้**: ตาราง `graphs` จาก migration 001 (foreign key)

## 2. อธิบายทีละบล็อก

### บล็อก A — `sessions` (บรรทัด 8–45)
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `session_id` | CHAR(36) PK | เก็บ UUID รูปแบบมีขีด (MySQL ไม่มี uuid; `BINARY(16)` ประหยัดกว่าแต่อ่านตอน debug ไม่ออก — คอมเมนต์ 13–15) |
| `graph_id` | VARCHAR(120) FK | |
| `current_node_id` | VARCHAR(60) | |
| `status` | ENUM('in_progress','completed') DEFAULT 'in_progress' | |
| `variables` | JSON NOT NULL | ค่าที่ผู้ใช้กรอกจากโหนด input เช่น `{"error_code":"E1"}` (ข้อมูลชั่วคราวของ session ไม่ต้อง query แยก field) |
| `created_at`, `updated_at` | TIMESTAMP | |
| `expires_at` | TIMESTAMP NOT NULL | คอมเมนต์ 30 ว่า "หมดอายุ 2 ชั่วโมง" |
- `fk_sessions_graph` → `graphs` **ON DELETE RESTRICT** ON UPDATE CASCADE (คอมเมนต์ 35–37: ตั้งใจใช้ RESTRICT ไม่ใช่ CASCADE ถ้าเผลอลบกราฟที่มีคนใช้อยู่ ให้ error แทนลบ session ทิ้งเงียบๆ ; seed script จึงใช้ upsert)
- ดัชนี `idx_sessions_expires`, `idx_sessions_status`

### บล็อก B — `session_history` (บรรทัด 47–82)
เก็บเป็นตารางแยกไม่ยัดเป็น JSON เพราะจะนำไปใช้ต่อในหน้า Analytics/History (นับอาการที่ถูกถามบ่อย / ผลลัพธ์ที่จบ — คอมเมนต์ 51–54)
- `id` BIGINT UNSIGNED AUTO_INCREMENT PK
- `session_id` CHAR(36), `step_order` SMALLINT UNSIGNED (เริ่มที่ 0)
- `node_id` VARCHAR(60) (โหนดที่ผู้ใช้อยู่ตอนส่ง action)
- `action_type` ENUM('answer','continue','confirm_safety','input')
- `action_value` VARCHAR(255) NULL (มีเฉพาะ answer และ input)
- `fk_history_session` → `sessions` **ON DELETE CASCADE** ON UPDATE CASCADE
- **`UNIQUE KEY uq_history_step (session_id, step_order)`** กันบันทึกลำดับซ้ำ (เช่น request ถูกส่งซ้ำสองครั้ง)
- ดัชนี `idx_history_session`

## 3. การส่งข้อมูล

```
SessionStore.create  ─INSERT─► sessions (expires_at = NOW() + 24 ชม.)
SessionStore.update  ─UPDATE sessions + INSERT session_history (ใน transaction)
SessionStore.find    ─SELECT sessions (expires_at > NOW()) + SELECT session_history ORDER BY step_order
SessionStore.delete  ─DELETE sessions ─► (CASCADE) ลบ session_history
```

## 4. จุดที่ควรระวัง

- **คอมเมนต์ 2 ชั่วโมง ขัดกับโค้ดที่ใช้ 24 ชั่วโมง**: `session.store.ts` ตั้ง `SESSION_TTL_HOURS = 24` และบันทึกไว้ว่าค่าที่ใช้จริงคือค่าในไฟล์ TypeScript ห้ามแก้ migration ที่รันไปแล้ว
- `expires_at` ไม่มีค่าเริ่มต้น (NOT NULL) ผู้ที่ INSERT ต้องใส่เสมอ (`SessionStore.create` ทำแล้ว)
- ยืนยัน: เมื่อ `UPDATE sessions` ไม่พบแถว (session ถูกลบ) การ `INSERT session_history` จะล้มเพราะ foreign key `fk_history_session` แล้ว `SessionStore.update` ทำ rollback
- `action_value VARCHAR(255)` ตรงกับ `MAX_INPUT_LENGTH = 255` ใน `traversal.dto.ts`
- ยังไม่มีตัวกวาดแถวหมดอายุ — ตารางโตขึ้นเรื่อยๆ (ดู `session.store.ts`)

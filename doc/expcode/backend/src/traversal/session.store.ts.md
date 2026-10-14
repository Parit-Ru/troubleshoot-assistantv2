# backend/src/traversal/session.store.ts

## 1. หน้าที่ของไฟล์

ชั้นอ่าน/เขียนข้อมูล session ใน MySQL (ตาราง `sessions` และ `session_history`) ด้วย SQL ที่เขียนเอง ไม่ใช้ ORM — เก็บและอ่าน `SessionState` ที่ engine สร้าง ไม่มีตรรกะเปลี่ยนสถานะอยู่ที่นี่ (คนตัดสินขั้นถัดไปคือ `submitAction()` ของ engine เท่านั้น)
นอกจากนี้ยังเก็บ "ผลลัพธ์ที่ผู้ใช้กรอก" (`outcome_text`, `outcome_at`) แยกจากการอ่าน session ปกติ

- **ใครเรียกใช้**: `traversal.module.ts` (provider), `traversal.service.ts`, `traversal.service.spec.ts`
- **เรียกใช้**: `../database/database.constants`, type จาก `../traversal-engine/types`, `mysql2/promise`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์หัวไฟล์ (บรรทัด 1–23) — นโยบายสำคัญ
- **เวลา**: คำนวณใน SQL ด้วย `NOW()` ไม่ใช้ `Date` ของ JavaScript เพราะ `TIMESTAMP` ขึ้นกับ time zone ของ connection ถ้าเทียบเวลาจากสองที่อาจเห็น session หมดอายุเพี้ยนหลายชั่วโมง
- **อายุ session 24 ชม.** นับจากการใช้งานล่าสุด (ต่ออายุตอนสร้างและทุกครั้งที่ `update`) ยาวกว่ารอบรอที่ยาวที่สุดในข้อมูล (สถานะ `n_ventilate` ที่ให้เปิดพัดลม 3–4 ชม.) คอมเมนต์ใน migration 002 เขียน 2 ชม. แต่ค่าจริงคือค่าในไฟล์นี้ และห้ามแก้ migration ที่รันไปแล้ว
- **ยังไม่มีตัวกวาด session ที่หมดอายุ**: แถวยังอยู่ แต่ `find()` มองไม่เห็น
- **outcome** ถูกแยกไว้ที่ `saveOutcome()` / `findOutcome()`; `find()` ไม่อ่านคอลัมน์นี้ และ `SessionState` ไม่มีฟิลด์นี้ engine จึงไม่มีทางเห็น

### บล็อก B — ค่าคงที่และ interface (บรรทัด 36–60)
- `SESSION_TTL_HOURS = 24` (37)
- `SessionRow` (40–48): `confidence` เป็น `string | number | null` เพราะ DECIMAL(4,3) จาก mysql2 มาเป็นข้อความ
- `HistoryRow` (51–55): `node_id`, `action_type`, `action_value`
- `OutcomeRow` (58–60): `outcome_text`

### บล็อก C — `create(session)` (บรรทัด 66–82)
`INSERT INTO sessions (...) VALUES (...)` โดย `variables` เก็บด้วย `JSON.stringify`, `confidence ?? null`, และ `expires_at = NOW() + INTERVAL ? HOUR` — ไม่เขียนประวัติเพราะ `history` ยังว่าง

### บล็อก D — `find(sessionId)` (บรรทัด 84–117)
- query ที่ 1 (89–94): อ่านแถว session ที่ `expires_at > NOW()` ถ้าไม่มี/หมดอายุคืน `undefined` (service ตอบ 404)
- query ที่ 2 (99–105): อ่าน `session_history ORDER BY step_order`
- ประกอบ `SessionState` (107–116): `variables` ผ่าน `parseVariables`, `confidence` แปลงเป็น `Number` (หรือคง `null`), `history` ผ่าน `rowToHistoryEntry`
- หมายเหตุ: `find()` ไม่ต่ออายุ session

### บล็อก E — `update(session, step)` (บรรทัด 119–186)
- **รับ**: session ใหม่ที่ผ่าน `submitAction` แล้ว + `step = { nodeId, action }` ที่จะบันทึกลงประวัติ
- ตรวจ `history.length === 0` → โยน `Error` (136–140); `stepOrder = history.length - 1` (141)
- ใช้ **transaction** บน connection เดียวกัน (144–146): `UPDATE sessions` (ย้ายโหนด, สถานะ, variables, ต่ออายุ — 148–162) แล้ว `INSERT INTO session_history` (164–175) แล้ว `commit` (177); ถ้า error → `rollback` แล้วโยนต่อ (178–180); `finally` เรียก `conn.release()` เสมอ (184) เพราะ pool มีแค่ 5 เส้น
- ตาราง `session_history` มี UNIQUE KEY `(session_id, step_order)` กันบันทึกซ้ำ (คอมเมนต์ 129–130) request ซ้ำที่มาพร้อมกันจึงล้มตรงนี้และยอมให้ตอบ 500
- ไม่อัปเดตคอลัมน์ `confidence` (ตั้งครั้งเดียวตอน `create`)

### บล็อก F — `delete(sessionId)` (บรรทัด 188–191)
`DELETE FROM sessions` — ประวัติถูกลบตามด้วย `ON DELETE CASCADE` ไม่มี session นี้ก็ไม่ error

### บล็อก G — `saveOutcome(sessionId, text)` (บรรทัด 197–222)
- `UPDATE sessions SET outcome_text = ?, outcome_at = NOW() WHERE session_id = ? AND status = 'completed' AND outcome_text IS NULL`
- คืน `true` เมื่อ `affectedRows === 1` มิฉะนั้น `false`
- **ทำไมใส่เงื่อนไข `outcome_text IS NULL` ใน UPDATE เดียว**: คอมเมนต์ 203–206 อธิบายกันการแข่งกันระหว่างสองคำขอ — ฐานข้อมูลล็อกแถวทีละคำสั่ง ผู้ชนะมีคนเดียวโดยไม่ต้องใช้ transaction (ถ้าเช็คก่อนแล้วเขียนเป็นสองคำสั่งอาจเขียนทับกัน)
- `status = 'completed'` กันบันทึกให้ session ที่ยังเดินอยู่; ไม่ต่ออายุ session

### บล็อก H — `findOutcome(sessionId)` (บรรทัด 224–236)
อ่าน `outcome_text` ของ session ที่ยังไม่หมดอายุ คืน `null` ถ้ายังไม่เคยกรอก/ไม่มี session/หมดอายุ

### บล็อก I — ฟังก์ชันตัวช่วย (บรรทัด 239–297)
- `actionValueOf` (244–246): เก็บ `value` เฉพาะ `answer` กับ `input` นอกนั้น `null`
- `rowToHistoryEntry` / `rowToAction` (255–286): แปลงแถวกลับเป็น action; `answer` ต้องเป็น `yes`/`no`, `input` ต้องไม่ NULL, ไม่ครบโยน `Error` ("ประวัติเสีย") — คอมเมนต์ 252–253: ออกเป็น 500 ดีกว่าส่ง action ที่เสียให้ engine; `default` ใช้ `never` ให้ TypeScript ยืนยันครอบคลุมครบ 4 แบบ
- `parseVariables` (292–297): รับทั้ง string (JSON.parse) และ object; `null/undefined` ให้ `{}`

## 3. การส่งข้อมูล

```
TraversalService ──create/update/find/delete/saveOutcome/findOutcome──► SessionStore ──SQL (mysql2)──► MySQL
                                                                        sessions · session_history
```
ตัวอย่างแถวประวัติ: `{ session_id, step_order: 2, node_id: "n2", action_type: "answer", action_value: "no" }`
ตัวอย่าง `variables` ใน DB: `{"error_code":"E1"}`

## 4. จุดที่ควรระวัง

- **`UPDATE sessions` ไม่ตรวจ `affectedRows`** (บรรทัด 148–162): หาก session ไม่มีอยู่/ถูกลบ คำสั่ง UPDATE จะแก้ 0 แถว แล้วตัว INSERT ประวัติจะล้มเพราะ foreign key `fk_history_session` (ยืนยันจาก `migrations/002_create_session_tables.sql`) ทำให้ rollback และโยน error ออกไป (ผลคือ 500)
- **คำขอพร้อมกันบน session เดียว**: ไม่มีการล็อก/ตรวจเวอร์ชัน ตัวที่แพ้ UNIQUE KEY จะได้ 500 (ตามที่คอมเมนต์ 129–130 ยอมรับ)
- **session หมดอายุสะสมในตาราง** เพราะไม่มีตัวกวาด (คอมเมนต์ 18)
- **`saveOutcome` ไม่ตรวจ `expires_at`** แต่ `findOutcome` ตรวจ — `saveOutcome` อาจเขียนให้ session ที่หมดอายุแล้วได้ ถ้า service เรียกโดยไม่ได้เช็คก่อน (service เช็คสองข้อแรกก่อนเรียกตามคอมเมนต์ 200–201) (อนุมานจากโค้ด)
- `confidence` ไม่ถูกอัปเดตใน `update` — ถูกต้องตามดีไซน์เพราะเป็นค่าตอนเริ่ม session

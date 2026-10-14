# backend/scripts/show-session-history.js

## 1. หน้าที่ของไฟล์

สคริปต์ "อ่านอย่างเดียว" (SELECT) แสดงประวัติ action ของ session จากตาราง `session_history` โดยตรง (ขั้น T2) เหตุผล (คอมเมนต์ 5–7): API ไม่เปิดประวัติให้อ่าน แต่หลักฐานที่หนักแน่นที่สุดว่า "ด่านความปลอดภัยทำงานที่เซิร์ฟเวอร์" คือ action ที่ถูกปฏิเสธ (`continue` ที่ยังไม่ยืนยันคำเตือน) ต้อง **ไม่ทิ้งแถว** ในตารางนี้ เพราะตารางเก็บเฉพาะ action ที่ engine รับแล้ว

- **ใครเรียกใช้**: คนรัน `node scripts/show-session-history.js <sessionId>` (ยืนที่ `backend/`) ใช้คู่กับ `demo-safety-gate.ps1` (ผลที่ถูกต้องมี 3 แถว: `answer yes`, `answer yes`, `confirm_safety` และไม่มีแถว `continue`)
- **เรียกใช้**: `dotenv/config`, `mysql2/promise` ; ตาราง `sessions`, `session_history`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ (บรรทัด 1–17)
วิธีรัน, ผลที่คาด, รหัสออก: **0** = อ่านสำเร็จ · **2** = ไม่พบ session · **1** = ผิดพลาดอื่น ; ไม่พิมพ์ค่าเชื่อมต่อ ; ไม่เพิ่ม dependency

### บล็อก B — ตรวจ argument (บรรทัด 22–29)
`UUID` regex 36 ตัวอักษรรูปแบบมีขีด ; ถ้าไม่ส่งหรือรูปแบบผิด พิมพ์วิธีใช้แล้วคืน `1`

### บล็อก C — เชื่อมต่อและอ่าน (บรรทัด 31–75)
- เชื่อมต่อ MySQL ด้วย `DB_*` (`ssl` ถ้ามี `DB_SSL_CA`) (31–38)
- `SELECT session_id, graph_id, current_node_id, status FROM sessions WHERE session_id = ?` ; ไม่พบ → พิมพ์ข้อความ (อาจถูกลบ — การลบ session ลบประวัติตามด้วย `ON DELETE CASCADE`) แล้วคืน `2` (41–48)
- พิมพ์ผัง/โหนดปัจจุบัน/status (49–51)
- `SELECT step_order, node_id, action_type, action_value FROM session_history … ORDER BY step_order` แล้วพิมพ์เป็นตาราง (53–67)
- ตรวจว่ามีแถว `action_type = 'continue'` ไหม ถ้ามีพิมพ์ว่า "ผิดคาด: การข้ามด่านถูกบันทึกเป็นการเดิน" (69–70) แล้วคืน `0` (71)
- `finally` ปิด connection (72–74)

### บล็อก D — ตัวจบโปรแกรม (บรรทัด 77–83)
`main().then(code => process.exit(code))` ; error: พิมพ์เฉพาะ `err.code || err.name` ไม่พิมพ์ err ทั้งก้อนเพราะข้อความของ driver อาจมีค่าเชื่อมต่อ (80)

## 3. การส่งข้อมูล

```
argv[2] (sessionId) ─► SELECT sessions ─► SELECT session_history ─► stdout (ตารางข้อความ) + exit code
```
ตัวอย่างเอาต์พุตแถว: `step_order | node_id | action_type | action_value` เช่น `0 | n1 | answer | yes`

## 4. จุดที่ควรระวัง

- **ไม่ได้ตั้ง `charset: 'utf8mb4'` ตอนเชื่อมต่อ** ต่างจากสคริปต์ seed/migration ที่ระบุไว้ชัด — จึงใช้ charset ค่าเริ่มต้นของไดรเวอร์ ถ้าค่าที่ผู้ใช้กรอกในโหนด input มีอักขระที่ต้องใช้ 4 ไบต์ (เช่นอีโมจิ) ข้อความที่พิมพ์ออกมาอาจเพี้ยนได้ (อนุมานจากโค้ด; ไม่ได้ทดลองรัน)
- `ssl` ใช้ `DB_SSL_CA` ตรงๆ ไม่ผ่าน `normalizePem` (เหมือน `run-migrations.js`)
- ผลการตรวจ "ไม่มีแถว continue" ใช้เป็นหลักฐานได้เฉพาะเมื่อเรียกจาก session ที่ได้จากสคริปต์สาธิตจริง และ session ยังไม่ถูกลบ/หมดอายุ

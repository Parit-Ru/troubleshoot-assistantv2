# frontend/src/mocks/mockServer.test.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Vitest) ของเซิร์ฟเวอร์จำลอง ยืนยันว่าตัวจำลองตอบรหัส/พฤติกรรมตรงกับ backend จริง โดยเฉพาะ **ด่านความปลอดภัย** (เทสที่คอมเมนต์เรียกว่า "ข้อสอบหลักของโครงงาน") และชุดบันทึกผลลัพธ์ที่ตัวจำลองต้องตอบรหัสและลำดับการตรวจตรงกับ backend ทุกข้อ
(`backend/src/traversal/traversal.service.spec.ts` ระบุว่าลอก "10 กรณี" จากไฟล์นี้ไปทดสอบ service จริง — อนุมานได้ว่าคือ 10 เทสแรกของกลุ่มแรก)

- **ใครเรียกใช้**: Vitest
- **เรียกใช้**: `ApiError` (`../api/http`), ฟังก์ชันทุกตัวจาก `./mockServer`, type `TraversalAction`

## 2. อธิบายทีละบล็อก

### บล็อก A — ตัวช่วย (บรรทัด 14–27)
ค่าคงที่ `STOPS_WORKING`, `ERROR_MESSAGE`, `WATER_DRIPS`, `YES` ; `walk(graphId, actions)` เริ่ม session แล้วส่ง action ทีละตัว

### บล็อก B — `describe('mockServer')` (บรรทัด 29–138) — 12 เทส
13 อาการและทุกอาการมีชื่อไทย (30) · เริ่ม session ได้ `n1`, `in_progress`, อุปกรณ์ 7 รายการ (37) · **`continue` ที่ด่านความปลอดภัยถูกปฏิเสธ 400 `SAFETY_CONFIRMATION_REQUIRED` และสถานะไม่ขยับ** (46) · ยืนยันคำเตือนแล้วเดินต่อได้ (64) · กรอกรหัสผิด (`'12'`) ไป `n_invalid_code` ไม่ใช่ error (71) · กรอก `E1` ได้หน้าจบ `handoff_informed` และไม่มี `{{` ค้าง (80) · ส่ง action หลังจบ → 409 `SESSION_COMPLETED` (90) · session ไม่มี → 404 (101) · ยกเลิกแล้วหาย (109) · graph ไม่มี → 404 (118) · `searchSymptoms()` ตอบ 503 `SEARCH_UNAVAILABLE` เสมอ (125) · `confidence` เป็น `null` (133)

### บล็อก C — `describe('mockServer — บันทึกผลลัพธ์')` (บรรทัด 139–300) — 13 `it` (16 กรณี)
ตัวช่วย `failure(promise)` (145–152), `finishResolved` (WATER_DRIPS+YES), `finishEscalated` (ERROR_MESSAGE+`E1`) :
บันทึกได้ทั้ง resolution/escalation และไม่ขยับสถานะ (160) · GET หลังบันทึกยังได้ข้อความเดิม (176) · ทุก response มีฟิลด์ `outcome` เป็น null จนกว่าจะบันทึก (185) · trim หน้าหลังและเก็บ HTML ตามที่พิมพ์ (198) · ยาว 1000 พอดีผ่าน (206) · บันทึกซ้ำ → 409 `OUTCOME_ALREADY_SUBMITTED` ไม่ทับ (212) · ยังไม่จบ → 409 `SESSION_NOT_COMPLETED` (223) · ไม่พบ session → 404 (237) · ว่าง/ช่องว่างล้วน/1001 ตัวอักษร → 400 `INVALID_OUTCOME` (244, `it.each` 3 กรณี) · **ลำดับตรวจ**: รูปแบบข้อความก่อน แล้วค่อย session และสถานะ (258) · หลังบันทึก action ใหม่ยังถูกปฏิเสธ 409 `SESSION_COMPLETED` (270) · ยกเลิกแล้วผลลัพธ์หายพร้อม session (280) · ผลลัพธ์ไม่รั่วข้าม session (290)

## 3. การส่งข้อมูล

Vitest เรียกฟังก์ชันของ mock โดยตรง (ไม่มี HTTP) ; `DELAY_MS` เป็น 0 เมื่อ `MODE === 'test'`

## 4. จุดที่ควรระวัง

- ผูกกับข้อมูลผังแอร์จริง (13 อาการ, 7 อุปกรณ์, รหัสโหนด `n1`, `n_fix_breaker`, `n_recheck_breaker`, `n_invalid_code`) — แก้ข้อมูลแล้วเทสล้ม
- คอมเมนต์บรรทัด 72–73 ("หน้าจอห้ามตรวจรูปแบบเอง ต้องปล่อยให้เซิร์ฟเวอร์ตัดสิน") เป็นกฎเดียวกับที่ `traversal.service.spec.ts` ยืนยันฝั่ง backend
- เทสสองชุด (frontend mock กับ backend service spec) ต้องคงพฤติกรรมตรงกัน — ไม่มีกลไกอัตโนมัติเทียบกันนอกจากการลอกเทสด้วยมือ

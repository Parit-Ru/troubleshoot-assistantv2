# backend/scripts/demo-safety-gate.ps1

## 1. หน้าที่ของไฟล์

สคริปต์ PowerShell สาธิตว่า **ด่านความปลอดภัยถูกบังคับที่เซิร์ฟเวอร์ ไม่ใช่ที่หน้าเว็บ** โดยคุยกับ REST API ตรงๆ (ไม่ผ่านเบราว์เซอร์/โค้ด frontend) เดินกราฟ "แอร์เปิดไม่ติด" ไปถึงขั้นสับเบรกเกอร์ ซึ่งเป็นโหนด `instruction` ที่ `safety_critical` แล้วทดสอบ 6 ขั้น (PASS/FAIL ต่อขั้น)

- **ใครเรียกใช้**: คนรันเอง เช่น `./scripts/demo-safety-gate.ps1` หรือ `-BaseUrl https://troubleshoot-assistantv2.onrender.com` ; คู่กับ `show-session-history.js` เพื่อดูหลักฐานในตาราง `session_history`
- **เรียกใช้**: endpoint ของ `HealthController` และ `TraversalController` ผ่าน `Invoke-WebRequest`

## 2. อธิบายทีละบล็อก

### บล็อก A — Comment-based help (บรรทัด 1–37)
สรุป 6 ขั้น: (1) `GET /health` ต้อง `ok` (2) `POST /traversal/sessions` ได้ 2xx และ `sessionId` (3) `answer yes` ×2 ถึง `n_fix_breaker` และ `requiresSafetyConfirmation = true` (4) `continue` ต้องได้ 400 `SAFETY_CONFIRMATION_REQUIRED` (5) `GET` session ต้องยังอยู่ `n_fix_breaker` (6) `confirm_safety` ต้องผ่านและโหนดเปลี่ยน
- ขั้น 6 สำคัญ: ด่านที่บล็อกทุกอย่างก็จะ "ผ่าน" ขั้น 4 ได้เหมือนกัน แต่ด่านที่ถูกต้องต้องปล่อยผ่านเมื่อยืนยันถูกวิธี
- สคริปต์ **ไม่ลบ session** เพราะตาราง `session_history` เป็นหลักฐานหลัก (action ที่ถูกปฏิเสธต้องไม่ทิ้งแถว) ให้รัน `node scripts/show-session-history.js <sessionId>` ก่อนค่อยลบ
- ข้อความของสคริปต์เป็น ASCII ล้วนโดยตั้งใจ เพราะ Windows PowerShell 5.1 อ่านไฟล์ UTF-8 ที่ไม่มี BOM เป็น ANSI แล้วภาษาไทยจะเพี้ยน
- exit code: 0 = ผ่านทุกขั้น · 1 = มีขั้นที่ล้ม ; **สร้าง session จริงใน DB ที่เซิร์ฟเวอร์เป้าหมายต่ออยู่**

### บล็อก B — พารามิเตอร์และการตั้งค่า (บรรทัด 38–48)
`-BaseUrl` (ค่าเริ่มต้น `http://localhost:3000`), `-GraphId` (ค่าเริ่มต้น `samsung_ac_ar70h_stops_working`) ; บังคับ TLS 1.2 (PowerShell 5.1 อาจใช้ TLS 1.0/1.1 ที่ host https อย่าง Render ปฏิเสธ) ; `$ErrorActionPreference = 'Stop'`

### บล็อก C — `Send-Api` (บรรทัด 50–90)
ตัวช่วยเรียก API ที่คืน `Status`, `Json`, `Raw`, `Encoding` ได้ทุก status code (เพราะ `Invoke-WebRequest` โยน exception เมื่อไม่ใช่ 2xx การอ่าน 400 ของขั้น 4 จึงทำใน `catch`) : อ่าน body จาก response stream ก่อน แล้ว fallback ไป `ErrorDetails.Message` (พฤติกรรมต่างกันตามโฮสต์: Render หลัง Cloudflare บน PS 5.1 stream อ่านได้ ส่วน localhost cmdlet อ่านไปแล้ว) ; ตัวแปรไม่ใช้ชื่อ `$args` เพราะเป็นตัวแปรอัตโนมัติ

### บล็อก D — `Report-Step` (บรรทัด 92–97)
พิมพ์ `[PASS|FAIL] step N: ชื่อ -- รายละเอียด` และนับ `$script:failures`

### บล็อก E — ขั้นตอน 1–6 (บรรทัด 103–151)
| ขั้น | การทำงาน | เกณฑ์ผ่าน |
|---|---|---|
| 1 (103–109) | `GET /health` | HTTP 200 และ `status = ok` ; ไม่ผ่าน → หยุด `exit 1` (`degraded` = DB เข้าไม่ถึง) |
| 2 (111–119) | `POST /traversal/sessions {graphId}` | 2xx และมี `sessionId` ; ไม่มี → หยุด |
| 3 (121–131) | `answer yes` ×2 | ทั้งคู่ 2xx, โหนดเป็น `n_fix_breaker`, `requiresSafetyConfirmation = true` ; ไม่ผ่าน → หยุด |
| 4 (133–142) | `continue` | HTTP 400 และ `code = SAFETY_CONFIRMATION_REQUIRED` (ถ้าล้ม พิมพ์ content-encoding และ 80 ตัวอักษรแรกของ body ช่วยวินิจฉัย) |
| 5 (144–146) | `GET /traversal/sessions/{id}` | 200 และโหนดยังเป็น `n_fix_breaker` |
| 6 (148–151) | `confirm_safety` | 2xx และโหนดเปลี่ยนไปจาก `n_fix_breaker` |

### บล็อก F — สรุป (บรรทัด 153–162)
พิมพ์เวลาสิ้นสุด `SESSION_ID`, `RESULT: all 6 steps passed` พร้อมคำแนะนำขั้นต่อไป (คาดว่า `session_history` มี 3 แถว ไม่มีแถว `continue`) หรือจำนวนขั้นที่ล้ม แล้ว `exit 0|1`

## 3. การส่งข้อมูล

```
PowerShell ──JSON ผ่าน HTTP──► POST /traversal/sessions {"graphId":"…"}
                          ──► POST …/actions {"type":"answer","value":"yes"} ×2
                          ──► POST …/actions {"type":"continue"}          ← ต้องได้ 400
                          ──► GET  …/sessions/{id}
                          ──► POST …/actions {"type":"confirm_safety"}
ตอบกลับ: SessionResponseDto (JSON) หรือ {statusCode, code, message}
```

## 4. จุดที่ควรระวัง

- **สร้างข้อมูลจริงใน DB** (ตาราง `sessions`/`session_history`) และไม่ลบ ต้องลบเองภายหลัง
- ขั้น 3 ผูกกับข้อมูล: ต้องเป็นกราฟ `samsung_ac_ar70h_stops_working`, ตอบ yes สองครั้งแล้วถึง `n_fix_breaker` ; ถ้าเปลี่ยนข้อมูลกราฟสคริปต์จะหยุดที่ขั้น 3 (ตรงกับที่ `traversal.service.spec.ts` ก็อ้าง `n_fix_breaker` เช่นกัน)
- ข้อความ ASCII เท่านั้นโดยตั้งใจ ถ้าเพิ่มภาษาไทยในไฟล์นี้ต้องบันทึกแบบ UTF-8 with BOM สำหรับ PowerShell 5.1
- สคริปต์ช่วยพิสูจน์ว่าเซิร์ฟเวอร์บังคับด่าน แต่ไม่ได้พิสูจน์กรณีอื่น เช่น `answer` ที่โหนด safety (ซึ่ง `traversal-engine.spec.ts` ครอบคลุมแล้ว)

# frontend/src/lib/errors.test.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Vitest) ของ `describeError` : ยืนยันว่าแต่ละ code ของเซิร์ฟเวอร์ให้หัวข้อ/วิธีกู้คืนตามที่กำหนด, ค่าที่ไม่ใช่ `ApiError` ไม่ทำให้พัง, และข้อความภายในของเซิร์ฟเวอร์ไม่หลุดไปถึงผู้ใช้

- **ใครเรียกใช้**: Vitest ; **เรียกใช้**: `describeError` (`./errors`), `ApiError` (`../api/http`)

## 2. อธิบายทีละบล็อก

### บล็อก A — ตัวช่วย (บรรทัด 5–11)
`SERVER_MESSAGE = 'ข้อความภายในสำหรับนักพัฒนา'` ใส่ในทุกเคส แล้วตรวจว่าไม่โผล่ใน title/detail ; `apiError(status, code)` สร้าง `ApiError`

### บล็อก B — กลุ่มเทส (รวม 20 `it`, ตัว `it.each` 2 กรณี)
| กลุ่ม (บรรทัด) | สิ่งที่ยืนยัน |
|---|---|
| ข้อผิดพลาดที่ระบบรู้จัก (13–49) | `NETWORK_ERROR`→retry ; `SAFETY_CONFIRMATION_REQUIRED`→stay ; `INVALID_ACTION`→reload-session ; `SESSION_COMPLETED`→reload-session ; `SESSION_NOT_FOUND`/`GRAPH_NOT_FOUND`→back-to-symptoms |
| ค้นหาอาการ (51–77) | `INVALID_QUERY`→stay ; `SEARCH_NOT_READY`→retry ; `SEARCH_UNAVAILABLE`→stay และ detail มีคำว่า "รายการ" (เพราะรอแล้วไม่หาย ห้ามบอกให้ลองใหม่) ; 400 `UNKNOWN_ERROR`→"เซิร์ฟเวอร์อ่านคำขอไม่ได้" |
| บันทึกผลลัพธ์ (79–104) | `INVALID_OUTCOME`→stay และ detail มี `1000` ; `SESSION_NOT_COMPLETED`→reload-session ; `OUTCOME_ALREADY_SUBMITTED`→reload-session (ไม่ใช่ลองส่งใหม่ เพราะได้ 409 เดิมซ้ำ) ; ไม่ปนกับรหัสเดิม |
| ข้อมูลขั้นตอนไม่สมบูรณ์ (106–118) | `GRAPH_NODE_MISSING`, `GRAPH_SCHEMA_UNSUPPORTED` → back-to-symptoms และมี `code` ติดมา |
| ไม่รู้จัก (120–140) | `ApiError` 500 `UNKNOWN_ERROR`, `Error` ธรรมดา, string/undefined/null → ข้อความ "เกิดข้อผิดพลาดที่ระบบไม่รู้จัก" ไม่พัง |
| กติการ่วม (142–176) | ทุกกรณีมี detail และไม่มี `SERVER_MESSAGE` ใน title/detail ; แสดง `code` เฉพาะ 2 กรณีของข้อมูลไม่สมบูรณ์ (กรองจาก `ALL_CASES` 17 รายการ) |

## 3. การส่งข้อมูล

Vitest เรียก `describeError(<error>)` โดยตรงแล้วเทียบ object ที่คืน — ไม่มี HTTP/DOM

## 4. จุดที่ควรระวัง

- รายการ `ALL_CASES` ต้องอัปเดตเอง เมื่อเพิ่ม code ใหม่ใน `errors.ts` — ไม่มีกลไกตรวจว่า backend มี code ที่ตารางนี้ยังไม่ครอบคลุม (เช่น `INTERNAL_ERROR` ไม่ได้อยู่ในรายการ)
- เทสที่ 3 ในกลุ่ม "บันทึกผลลัพธ์" ฝังค่า `'1000'` ตรงๆ ตรงกับ `MAX_OUTCOME_LENGTH` (ถ้าเปลี่ยนต้องแก้เทสด้วย)

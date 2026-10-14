# backend/src/symptom-search/symptom-search.exception.filter.ts

## 1. หน้าที่ของไฟล์

แปลง error ของงานค้นหาอาการเป็น HTTP response รูปแบบ `{ statusCode, code, message }` แนวเดียวกับ `traversal.exception.filter.ts` (ใช้ `instanceof` กับคลาส error ไม่จับจากข้อความ และแยก `toErrorBody()` เป็นฟังก์ชันล้วนให้เทสได้โดยไม่ต้องปลอม `ArgumentsHost`)

- **ใครเรียกใช้**: `symptom-search.controller.ts` (`@UseFilters`), `symptom-search.exception.filter.spec.ts`
- **เรียกใช้**: type `ApiErrorBody` จาก `../traversal/traversal.exception.filter` (ใช้ร่วมกันเป็นรูปร่าง response), `InvalidSearchQueryError` จาก `./symptom-search.dto`, `SearchNotReadyError` / `SearchUnavailableError` จาก `./symptom-search.service`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ตารางแปลง (บรรทัด 1–16)
| error | HTTP | `code` | ความหมาย |
|---|---|---|---|
| `InvalidSearchQueryError` | 400 | `INVALID_QUERY` | body ผิดรูปแบบ |
| `SearchNotReadyError` | 503 | `SEARCH_NOT_READY` | กำลังโหลดโมเดล ลองใหม่ได้ |
| `SearchUnavailableError` | 503 | `SEARCH_UNAVAILABLE` | ปิดอยู่หรือโหลดไม่สำเร็จ |
| อื่นๆ | 500 | `INTERNAL_ERROR` | ไม่ทราบสาเหตุ |
ขอบเขตที่รู้อยู่แล้ว: JSON ไวยากรณ์ผิดล้วนๆ (เช่น `{`) ถูก body-parser ของ Express โยนก่อนถึง handler จึงไม่ผ่าน filter นี้

### บล็อก B — `toErrorBody(exception)` (บรรทัด 28–43)
คืน `ApiErrorBody` ตามตาราง; `message` = `exception.message` ถ้าเป็น `Error` ไม่เช่นนั้น `'ไม่ทราบสาเหตุ'` (29); ท้ายสุดดักทุกอย่างที่ไม่รู้จักเป็น 500 `INTERNAL_ERROR` (41–42) เพราะไม่รู้สาเหตุจริง

### บล็อก C — คลาส `SymptomSearchExceptionFilter` (บรรทัด 45–62)
`@Catch()`; `catch` เรียก `toErrorBody` แล้ว **log เฉพาะ `statusCode === 500`** พร้อม stack (54–57) เพราะ 400 และ 503 เป็นผลที่คาดไว้ และสถานะระบบดูได้จาก `GET /symptom-search/status` อยู่แล้ว (คอมเมนต์ 52–53); เขียนผลลง `response.status(...).json(body)` (59–60)

## 3. การส่งข้อมูล

```
throw ใน parseSearchBody / SymptomSearchService.search ──► filter ──► toErrorBody ──► JSON {statusCode, code, message}
```
ตัวอย่าง: `{"statusCode":503,"code":"SEARCH_NOT_READY","message":"ระบบค้นหากำลังเริ่มทำงาน"}` — frontend ใช้ `code` เลือกข้อความไทย (เช่น ลองใหม่อีกครั้ง) ผ่าน `frontend/src/lib/errors.ts`

## 4. จุดที่ควรระวัง

- **ตารางแปลงแยกจาก traversal filter**: ถ้าเพิ่ม error ใหม่ในงานค้นหา ต้องเพิ่มที่ไฟล์นี้เอง ไม่เช่นนั้นกลายเป็น 500
- ต่างจาก traversal filter ตรงที่ log เมื่อ `=== 500` (ส่วน traversal ใช้ `>= 500`) — ผลเท่ากันเพราะที่นี่ไม่มีสถานะ 5xx อื่นนอกจาก 500 และ 503 ซึ่งตั้งใจไม่ log
- ข้อความ error ดิบถูกส่งออกไปให้ผู้เรียกแม้เป็น 500 (บรรทัด 29, 42) อาจเปิดเผยรายละเอียดภายใน (อนุมานจากโค้ด)

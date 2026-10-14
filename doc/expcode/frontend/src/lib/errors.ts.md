# frontend/src/lib/errors.ts

## 1. หน้าที่ของไฟล์

แปลงข้อผิดพลาดจากเซิร์ฟเวอร์เป็น "ข้อความที่ผู้ใช้อ่านแล้วรู้ว่าต้องทำอะไรต่อ" ฟังก์ชันเดียว `describeError(error)` คืน `{ title, detail, recovery, code? }` — ตัดสินจาก `code` เท่านั้น ไม่ใช้ `message` ที่เซิร์ฟเวอร์ส่ง เพราะ message ของกลไกเครื่องสถานะเขียนให้นักพัฒนาอ่าน (มีรหัสอังกฤษปน) ฟังก์ชันนี้ใช้แสดงผลอย่างเดียว ไม่ได้ตัดสินว่าขั้นถัดไปคืออะไร

- **ใครเรียกใช้**: `components/OutcomeForm.tsx`, `components/SessionErrorNotice.tsx`, `pages/SymptomsPage.tsx`, `errors.test.ts`
- **เรียกใช้**: `ApiError` จาก `../api/http`, `MAX_OUTCOME_LENGTH` จาก `./outcome`

## 2. อธิบายทีละบล็อก

### บล็อก A — ชนิดข้อมูล (บรรทัด 14–29)
- `ErrorRecovery` = `'retry' | 'reload-session' | 'back-to-symptoms' | 'stay'` — สิ่งที่หน้าจอควรให้ผู้ใช้ทำต่อ (ลองส่งซ้ำ / ดึงสถานะล่าสุด / กลับหน้าเลือกอาการ / อยู่ขั้นเดิม)
- `ErrorDescription { title, detail, recovery, code? }` — `code` แสดงเฉพาะกรณีข้อมูลขั้นตอนไม่สมบูรณ์ (500) เพื่อให้ผู้ใช้แจ้งผู้ดูแล

### บล็อก B — ค่าสำรอง (บรรทัด 31–35)
`UNKNOWN_ERROR` : "เกิดข้อผิดพลาดที่ระบบไม่รู้จัก" + recovery `retry`

### บล็อก C — `describeError` (บรรทัด 37–168)
ใช้ `switch` แทนตาราง `Record` เพราะ code จากเซิร์ฟเวอร์เป็น string ใดก็ได้ — ตกไป `default` เองเมื่อไม่รู้จัก
1. ถ้าไม่ใช่ `ApiError` (Error ธรรมดา, string, undefined) → `UNKNOWN_ERROR` (43–45)
2. กรณีพิเศษ `code === 'UNKNOWN_ERROR' && status === 400` (JSON ผิดไวยากรณ์ที่ Express ตอบเอง) → "เซิร์ฟเวอร์อ่านคำขอไม่ได้" / `retry` (50–56)
3. ตารางต่อ `code`:

| code | หัวข้อ (title) | recovery |
|---|---|---|
| `NETWORK_ERROR` | เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ | retry |
| `SAFETY_CONFIRMATION_REQUIRED` | เซิร์ฟเวอร์ไม่ให้ข้ามขั้นตอนนี้ | stay |
| `INVALID_ACTION` | หน้าจอไม่ตรงกับเซิร์ฟเวอร์ | reload-session |
| `SESSION_COMPLETED` | การตรวจนี้จบไปแล้ว | reload-session |
| `SESSION_NOT_FOUND` | ไม่พบการตรวจนี้ | back-to-symptoms |
| `GRAPH_NOT_FOUND` | ไม่พบอาการนี้ | back-to-symptoms |
| `INVALID_QUERY` | ข้อความที่พิมพ์ใช้ค้นหาไม่ได้ (บอกเพดาน 200) | stay |
| `SEARCH_NOT_READY` | ระบบค้นหากำลังเริ่มทำงาน | retry |
| `SEARCH_UNAVAILABLE` | ระบบค้นหาไม่พร้อมใช้งานตอนนี้ (ให้เลือกจากรายการแทน) | stay |
| `INVALID_OUTCOME` | ข้อความผลลัพธ์บันทึกไม่ได้ (บอกเพดาน `MAX_OUTCOME_LENGTH`) | stay |
| `SESSION_NOT_COMPLETED` | การตรวจนี้ยังไม่จบ | reload-session |
| `OUTCOME_ALREADY_SUBMITTED` | การตรวจนี้บันทึกผลไปแล้ว | reload-session |
| `GRAPH_NODE_MISSING`, `GRAPH_SCHEMA_UNSUPPORTED` | ข้อมูลขั้นตอนของอาการนี้ไม่สมบูรณ์ (+ ใส่ `code`) | back-to-symptoms |
| อื่นๆ (รวม `INTERNAL_ERROR`) | `UNKNOWN_ERROR` | retry |

## 3. การส่งข้อมูล

```
backend (toErrorBody) ──HTTP {statusCode, code, message}──► http.request ──throw ApiError(status, code, message)──► catch ในหน้าจอ
        └► describeError(err) → {title, detail, recovery, code?} → SessionErrorNotice / OutcomeForm / SymptomsPage แสดงผล
```

## 4. จุดที่ควรระวัง

- **ต้องตามรายการ code ของ backend เอง**: backend ส่ง 14 รหัส (11 จาก `traversal.exception.filter.ts` + 3 จาก `symptom-search.exception.filter.ts` โดย `INTERNAL_ERROR` ใช้ร่วมกัน) ตารางนี้มี case ให้ 13 รหัส (ยกเว้น `INTERNAL_ERROR`) บวก `NETWORK_ERROR` ที่ `http.ts` สร้างเอง ; เพิ่ม error ใหม่ฝั่ง backend แล้วลืมมาเพิ่มที่นี่จะตกไป `UNKNOWN_ERROR`
- `INTERNAL_ERROR` (500 ทั่วไปของ backend) ไม่มี case เฉพาะ จึงแสดงเป็น "ระบบไม่รู้จัก" + ลองใหม่
- ค่าตัวเลขเพดานข้อความ 200 ใน `INVALID_QUERY` เขียนตายตัวในข้อความ (ไม่ได้ดึงจาก `MAX_QUERY_LENGTH` ของ `search.ts`) ส่วน `INVALID_OUTCOME` ใช้ค่าจาก `outcome.ts`
- ไม่ใช้ `message` ของเซิร์ฟเวอร์เลย (ตั้งใจ) — เทสยืนยันว่า message ไม่หลุดไปถึงผู้ใช้

# backend/src/symptom-search/symptom-search.dto.ts

## 1. หน้าที่ของไฟล์

กำหนดรูปร่าง request/response ของ API ค้นหาอาการ พร้อมตัวตรวจ body ที่เขียนเอง (`parseSearchBody`) และ error `InvalidSearchQueryError` แนวเดียวกับ `traversal.dto.ts` คือบริสุทธิ์ ไม่ import NestJS ไม่แตะโมเดลหรือ DB ไม่ใช้ class-validator เพราะ body มี field เดียว

- **ใครเรียกใช้**: `symptom-search.controller.ts` (`parseSearchBody`), `symptom-search.exception.filter.ts` (`InvalidSearchQueryError`), `symptom-search.service.ts` (type response/status), `traversal.dto.ts` (ค่าคงที่ `MAX_QUERY_LENGTH`), และ spec 3 ไฟล์
- **เรียกใช้**: type `DeviceCategory` จาก `../traversal-engine/types`

## 2. อธิบายทีละบล็อก

### บล็อก A — `MAX_QUERY_LENGTH = 200` (บรรทัด 20–27)
ความยาวสูงสุดของคำค้น (นับหลัง trim) — เหตุผล (คอมเมนต์ 23–25): คำค้นถูกส่งเข้าโมเดลทุกครั้ง ถ้าไม่จำกัดอาจทำให้เซิร์ฟเวอร์ Render free (0.1 CPU) ช้าหรือหน่วยความจำพุ่ง อาการที่พิมพ์จริงสั้นกว่านี้มาก

### บล็อก B — `InvalidSearchQueryError` (บรรทัด 33–43)
error ของเราเอง ให้ filter จับด้วย `instanceof`; message ไว้ให้นักพัฒนา หน้าจอเลือกข้อความไทยจาก `code`

### บล็อก C — `SearchBody` และ `parseSearchBody` (บรรทัด 49–83)
- ตรวจ body เป็น object (63–65), `query` เป็น string (67–70), `trim()` แล้วไม่ว่าง (72–75), ไม่เกิน 200 ตัวอักษร (76–80) แล้วคืน `{ query }` (object ใหม่ field เดียว จึงตัด field แปลกปลอมทิ้ง)
- **รับ**: `unknown` — **คืน**: `SearchBody`

### บล็อก D — response ของการค้นหา (บรรทัด 85–117)
- `SymptomMatchDto` (90–102): `graphId`, `entrySymptom`, `entrySymptomTh?`, `deviceCategory`, `score` (cosine ปัด 3 ตำแหน่ง ไม่ใช่ความน่าจะเป็น), `matchedText` (ข้อความอาการที่ทำให้ได้คะแนน ไว้อธิบายผู้ใช้)
- `SymptomSearchResponseDto` (105–117): `query` (หลัง trim), `threshold`, `bestScore` (ส่งเสมอแม้ไม่มีผังผ่านเกณฑ์; `null` เมื่อไม่มีผังให้เทียบ), `matches[]` (ว่าง = หน้าจอต้องแสดงการส่งต่อศูนย์บริการ)

### บล็อก E — สถานะระบบค้นหา (บรรทัด 119–138)
- `SearchState` (120) = `'disabled' | 'loading' | 'ready' | 'failed'`
- `SearchStatusDto` (123–138): `state`, `model`, `dtype`, `indexedTexts`, `indexedGraphs`, `loadMs` (`null` = ยังไม่เสร็จ), `modelFilesFoundLocally`, `error`, `memoryRssMb` (ไว้ตรวจว่าเกิน 512 MB ของ Render free หรือไม่)

## 3. การส่งข้อมูล

```
POST /symptom-search  {"query":"  แอร์ไม่เย็น "} ──parseSearchBody──► {"query":"แอร์ไม่เย็น"} ──► SymptomSearchService.search
SymptomSearchService ──► SymptomSearchResponseDto (JSON) ──► frontend
GET /symptom-search/status ──► SearchStatusDto (JSON)
```
ตัวอย่าง response: `{"query":"แอร์ไม่เย็น","threshold":0.55,"bestScore":0.712,"matches":[{"graphId":"…","entrySymptom":"…","deviceCategory":"Air Conditioner","score":0.712,"matchedText":"…"}]}`

## 4. จุดที่ควรระวัง

- `MAX_QUERY_LENGTH` ถูกนำไปใช้ซ้ำใน `traversal.dto.ts` (ตรวจ `query` ของการเริ่ม session) หากเปลี่ยนค่านี้ ขอบเขตของทั้งสอง API เปลี่ยนพร้อมกัน
- ค่าตัวเลข 200 นับด้วย `.length` (UTF-16) อักขระนอก BMP นับเป็น 2
- ข้อความ error อธิบายเป็นภาษาไทยสำหรับนักพัฒนา ไม่ใช่ข้อความที่แสดงผู้ใช้

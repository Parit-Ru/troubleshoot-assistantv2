# backend/src/symptom-search/symptom-search.exception.filter.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของ `toErrorBody` ใน `symptom-search.exception.filter.ts` ตรวจตารางแปลง error → HTTP response ของงานค้นหาอาการ เป็นฟังก์ชันล้วนจึงไม่ต้องเปิดเซิร์ฟเวอร์

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `InvalidSearchQueryError` (จาก `./symptom-search.dto`), `toErrorBody` (จาก `./symptom-search.exception.filter`), `SearchNotReadyError` / `SearchUnavailableError` (จาก `./symptom-search.service`)

## 2. อธิบายทีละบล็อก

### บล็อก A — `describe('toErrorBody (symptom-search)')` (บรรทัด 12–45) — 4 เทส
| บรรทัด | อินพุต | ผลที่คาดหวัง |
|---|---|---|
| 13 | `InvalidSearchQueryError('query ต้องไม่ว่าง')` | `{ statusCode: 400, code: 'INVALID_QUERY', message: 'query ต้องไม่ว่าง' }` (message เดิม) |
| 21 | `SearchNotReadyError` | 503 `SEARCH_NOT_READY` |
| 27 | `SearchUnavailableError` | 503 `SEARCH_UNAVAILABLE` (คนละ code กับ NOT_READY) |
| 33 | `new Error('boom')` และสตริง `'ไม่ใช่ Error'` | 500 `INTERNAL_ERROR` ข้อความ `'boom'` / `'ไม่ทราบสาเหตุ'` |

## 3. การส่งข้อมูล

Jest เรียก `toErrorBody(<error>)` โดยตรงแล้วเทียบ object ที่คืนด้วย `toEqual` — ไม่มีการส่งข้อมูลข้ามไฟล์

## 4. จุดที่ควรระวัง

- ทดสอบเฉพาะตัวแปลง ไม่ทดสอบตัวคลาส `SymptomSearchExceptionFilter` (ส่วน log เฉพาะ 500 และการเขียน response) ไฟล์ spec ของ traversal ก็ใช้แนวเดียวกัน (อนุมานจากโค้ด)
- การ import `SearchNotReadyError` จาก `symptom-search.service` ทำให้ไฟล์ service ถูกโหลดทั้งไฟล์ (รวม import `GraphRepository`/`EmbeddingService`) แต่ไม่มีการโหลดโมเดลจริงเพราะไม่ได้เรียก `load()`

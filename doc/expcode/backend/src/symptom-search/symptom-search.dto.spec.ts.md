# backend/src/symptom-search/symptom-search.dto.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของ `parseSearchBody` ใน `symptom-search.dto.ts` ตรวจว่า body ของ `POST /symptom-search` ถูกตรวจรูปแบบถูกต้อง ไม่ต้องเปิดเซิร์ฟเวอร์หรือโหลดโมเดลเพราะ DTO บริสุทธิ์

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `InvalidSearchQueryError`, `MAX_QUERY_LENGTH`, `parseSearchBody` จาก `./symptom-search.dto`

## 2. อธิบายทีละบล็อก

### บล็อก A — `describe('parseSearchBody')` (บรรทัด 14–76) — 10 เทส
| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 15 | body ถูกต้อง → คืน `{ query }` |
| 21 | ตัดช่องว่าง/ขึ้นบรรทัดหน้าหลัง (`'  แอร์ไม่เย็น \n'`) |
| 27 | ทิ้ง field แปลกปลอม (`threshold`, `admin`) ผลมีกุญแจเดียวคือ `query` |
| 33 | body ไม่ใช่ object (`null`, `undefined`, `[]`, `['แอร์']`, string, number, boolean) → โยน `InvalidSearchQueryError` |
| 39 | ไม่มี field `query` (`{}` หรือ `{ q: … }`) → error |
| 44 | `query` ไม่ใช่ข้อความ (`123`, `null`, `true`, array, object) → error |
| 52 | `query` เป็นข้อความว่าง → error |
| 56 | `query` มีแต่ช่องว่าง/แท็บ/ขึ้นบรรทัด → error |
| 62 | ยาวพอดี `MAX_QUERY_LENGTH` (200) → ผ่าน |
| 67 | ยาวเกิน 200 → error แต่ `' ' + 200 ตัวอักษร + ' '` ยังผ่าน (นับหลังตัดช่องว่าง) |

## 3. การส่งข้อมูล

Jest เรียก `parseSearchBody(<ค่าทดสอบ>)` โดยตรง แล้วตรวจค่าที่คืนหรือ error ที่โยน — ไม่มีการส่งข้อมูลข้ามไฟล์/เครือข่าย

## 4. จุดที่ควรระวัง

- เทสใช้ตัวอักษรไทย `'ก'.repeat(…)` นับด้วย `.length` — สอดคล้องกับโค้ดจริงที่นับหน่วย UTF-16 ไม่มีเทสกรณีอักขระนอก BMP (อีโมจิ) (อนุมานจากโค้ด)
- ไม่ทดสอบ `InvalidSearchQueryError` ผ่าน filter (ส่วนนั้นอยู่ใน `symptom-search.exception.filter.spec.ts`)

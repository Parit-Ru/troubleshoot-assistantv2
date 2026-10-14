# backend/src/traversal/traversal.dto.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของตัวตรวจ body 2 ตัวใน `traversal.dto.ts`: `parseStartSessionBody` (ส่วน `query` ไม่บังคับ ซึ่งเพิ่มใน "ขั้น 1.8" ตามคอมเมนต์ 4) และ `parseOutcomeBody` (ผลลัพธ์ที่ผู้ใช้กรอก) — ฟังก์ชันบริสุทธิ์ไม่ต้องเปิดเซิร์ฟเวอร์
**หมายเหตุ**: ไม่มีเทสของ `parseTraversalAction` ในไฟล์นี้

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `MAX_QUERY_LENGTH` (จาก `../symptom-search/symptom-search.dto`) และ `InvalidOutcomeError`, `InvalidRequestBodyError`, `MAX_OUTCOME_LENGTH`, `parseOutcomeBody`, `parseStartSessionBody` (จาก `./traversal.dto`)

## 2. อธิบายทีละบล็อก

### บล็อก A — `describe('parseStartSessionBody')` (บรรทัด 18–59) — 6 เทส
| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 19 | มีแค่ `graphId` → คืน `{ graphId }` และไม่มี key `query` |
| 25 | มี `query` ถูกต้อง → คืนทั้งสอง field, query ถูก trim |
| 32 | ทิ้ง field แปลกปลอม เช่น `confidence` ที่หน้าจอพยายามส่งมาเอง (เหลือ `graphId`, `query`) |
| 37 | `query` ไม่ใช่ข้อความ / ว่าง / ช่องว่างล้วน → `InvalidRequestBodyError` |
| 45 | `query` ยาวเกิน `MAX_QUERY_LENGTH` → error, ยาวพอดีผ่าน |
| 54 | `graphId` ผิดรูปแบบ (`{}`, `''`, เลข, `null`) ยังถูกปฏิเสธ |

### บล็อก B — `describe('parseOutcomeBody')` (บรรทัด 61–121) — 9 เทส
| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 62 | `MAX_OUTCOME_LENGTH` เท่ากับ 1000 (ค่าที่ตกลงไว้) |
| 66 | trim หน้าหลัง แต่ไม่แตะกลางข้อความ (ขึ้นบรรทัดใหม่/ช่องว่างกลางข้อความอยู่ครบ) |
| 76 | ทิ้ง field แปลกปลอม (`outcome_at`, `status`, `confidence`) เหลือแค่ `text` |
| 81 | body ไม่ใช่ object → `InvalidOutcomeError` |
| 87 | `text` ไม่มี / ไม่ใช่ข้อความ → `InvalidOutcomeError` |
| 93 | `text` ว่างหรือเป็นช่องว่าง/แท็บ/ขึ้นบรรทัดล้วน → `InvalidOutcomeError` |
| 99 | ยาวพอดีเพดานผ่าน เกิน 1 ตัวไม่ผ่าน นับหลัง trim |
| 106 | ไม่แก้เนื้อหา: ข้อความที่มี HTML/สคริปต์ถูกเก็บตามที่พิมพ์ |
| 111 | error เป็นคนละชนิดกับ `InvalidRequestBodyError` (filter ต้องแปลงเป็นรหัสต่างกัน) |

## 3. การส่งข้อมูล

Jest เรียกฟังก์ชัน `parse*` โดยตรงแล้วตรวจค่าที่คืนหรือ error — ไม่มีการส่งข้อมูลข้ามไฟล์/เครือข่าย

## 4. จุดที่ควรระวัง

- **ช่องว่างในการทดสอบ**: `parseTraversalAction` (ตรวจ action ที่เป็นแกนของ API) ไม่อยู่ในไฟล์นี้ — อาจถูกทดสอบทางอ้อมในที่อื่น (เช่น `traversal.service.spec.ts`) แต่ในไฟล์นี้ไม่พบ
- เทสที่ 106 ยืนยันว่าเซิร์ฟเวอร์ "ไม่ทำความสะอาด" HTML ความปลอดภัยจึงขึ้นกับฝั่งหน้าจอที่ต้องแสดงเป็นข้อความธรรมดา (ตามคำอธิบายในเทส) ไม่ใช่การป้องกันฝั่ง backend

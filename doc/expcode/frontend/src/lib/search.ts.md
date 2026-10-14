# frontend/src/lib/search.ts

## 1. หน้าที่ของไฟล์

ตรรกะเล็กๆ ของช่องค้นหาอาการ (ฟังก์ชันล้วน ไม่แตะ React ไม่เรียก API) ตรวจคำค้นฝั่งหน้าจอเพื่อกันกดค้นเปล่าประโยชน์ (ว่าง/ยาวเกิน) และจัดรูปคะแนนความคล้าย — เซิร์ฟเวอร์ตรวจซ้ำและเป็นผู้ตัดสิน (`INVALID_QUERY`)

- **ใครเรียกใช้**: `components/SessionHeader.tsx`, `components/SymptomRow.tsx`, `components/SymptomSearchForm.tsx`, `pages/SymptomsPage.tsx`, `search.test.ts`
- **เรียกใช้**: ไม่มี

## 2. อธิบายทีละบล็อก

- `MAX_QUERY_LENGTH = 200` (12): ต้องตรงกับ `symptom-search.dto.ts` ของ backend (ลอกมาด้วยมือ)
- `normalizeQuery(raw)` (15–17): `trim()` เหมือนเซิร์ฟเวอร์
- `type QueryCheck = 'ok' | 'empty' | 'too-long'` และ `checkQuery(raw)` (25–32)
- `formatScore(score)` (41–43): `score.toFixed(3)` เสมอ (0.8 → "0.800") เพราะเซิร์ฟเวอร์ปัดมาแล้วแต่ JSON ตัดศูนย์ท้ายทิ้ง การเติมให้ทุกแถวกว้างเท่ากันอ่านเทียบง่าย — **ไม่แปลงเป็นเปอร์เซ็นต์** เพราะ cosine ไม่ใช่ความน่าจะเป็น ("0.812" ไม่ได้แปลว่าถูก 81.2%)

## 3. การส่งข้อมูล

คำค้นที่ผู้ใช้พิมพ์ → `checkQuery` → ถ้า `ok` ส่งต่อ `useSymptomSearch().mutate(query)` ; คะแนนจาก `SymptomMatch.score` / `SessionResponse.confidence` → `formatScore` → ข้อความที่แสดง

## 4. จุดที่ควรระวัง

- ค่า 200 ซ้ำกับ backend (และ `validate-eval-queries.js`) ต้องแก้พร้อมกัน
- `toFixed(3)` ใช้กับค่าที่ไม่ใช่ตัวเลข (เช่น `undefined`) จะพัง ผู้เรียกต้องส่งตัวเลขเสมอ (ตรวจแล้วด้วยชนิด TypeScript)

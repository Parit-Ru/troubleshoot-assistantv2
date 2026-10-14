# frontend/src/components/SessionHeader.tsx

## 1. หน้าที่ของไฟล์

หัวหน้าตรวจอาการ : ชื่ออาการ (`<h1>`), ยี่ห้อ + รุ่นเครื่อง, ปุ่ม "ยกเลิกการตรวจ" (เมื่ออนุญาต) และบรรทัด "คะแนนความคล้าย" (เมื่อ session เริ่มจากผลค้นหา) รับค่าทาง props อย่างเดียว ไม่เรียก API — ผู้เรียกบอกเองว่ายกเลิกได้ไหม (`canAbandon`)

- **ใครเรียกใช้**: `pages/SessionPage.tsx`
- **เรียกใช้**: `formatScore` (`lib/search`), `symptomName` (`lib/symptoms`), `Button`, type `GraphSummary`

## 2. อธิบายทีละบล็อก

- props (11–18): `summary: GraphSummary | undefined` (undefined = รายการอาการยังโหลดไม่เสร็จ แสดงหัวข้อชั่วคราว), `confidence: number | null | undefined`, `canAbandon`, `isAbandoning`, `onAbandon`
- `SessionHeader` (20–54):
  - `<h1>` = `symptomName(summary)` หรือ "ตรวจอาการ" ถ้ายังไม่มี `summary`
  - บรรทัดยี่ห้อ/รุ่น : `{summary.brand} <code>{summary.modelPattern}</code>`
  - ปุ่ม `variant="text"` "ยกเลิกการตรวจ" (เมื่อ `canAbandon`) `isLoading={isAbandoning}`
  - `confidence != null` → "คะแนนความคล้ายกับที่พิมพ์ค้นหา **0.812** (แสดงเป็นข้อมูลประกอบเท่านั้น ขั้นตอนถัดไปตัดสินตามคู่มือ)" — ไม่ใช้คำว่า "มั่นใจ %" (cosine ไม่ใช่ความน่าจะเป็น)

## 3. การส่งข้อมูล

`GraphSummary` (จากรายการอาการ `useGraphs`) + `SessionResponse.confidence` → props → ข้อความ ; `onAbandon` แจ้งขึ้นไปให้หน้าตรวจอาการเรียก `useAbandonSession`

## 4. จุดที่ควรระวัง

- `confidence != null` ใช้ `!=` (ครอบคลุมทั้ง `null` และ `undefined`) ตั้งใจ
- ถ้ารายการอาการโหลดไม่สำเร็จ ผู้ใช้จะเห็นแต่หัวข้อ "ตรวจอาการ" โดยไม่มีชื่ออาการ/รุ่น (ขั้นตอนยังดำเนินต่อได้)

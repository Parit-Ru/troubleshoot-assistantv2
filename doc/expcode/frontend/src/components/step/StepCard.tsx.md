# frontend/src/components/step/StepCard.tsx

## 1. หน้าที่ของไฟล์

กรอบที่กล่องขั้นตอนทุกแบบใช้ร่วมกัน : จัดลำดับบนลงล่าง — (1) ป้ายชนิด (2) `notice` (กล่องคำเตือน เฉพาะสถานะที่ต้องยืนยัน) (3) `heading` ข้อความหลัก (4) `children` ส่วนควบคุม (ปุ่ม/ช่องกรอก) (5) บรรทัดที่มา `ReferenceLine` ; `notice` อยู่ก่อน `heading` เพราะผู้ใช้ต้องเห็นคำเตือนก่อนอ่านว่าให้ทำอะไร ; กรอบนี้แค่จัดวาง ไม่แจ้ง action เอง

- **ใครเรียกใช้**: `CheckpointStep`, `InputStep`, `InstructionStep`, `OutcomeStep`, `SafetyGateStep`
- **เรียกใช้**: `ReferenceLine`, type `NodeReference`, `ReactNode`

## 2. อธิบายทีละบล็อก

- `StepCardTone = 'default' | 'danger'` และ `TONE_CLASSES` (18, 35–38): `default` = `border border-line`, `danger` = `border-2 border-danger` (เขียนชื่อคลาสเต็ม)
- props (20–32): `label?`, `heading`, `tone?`, `notice?`, `reference`, `manualLabel?`, `children?`
- `StepCard` (40–73): `<section className="rounded-xl bg-panel p-5 md:p-6 …">` ; ป้ายชนิดแสดงเมื่อ `label !== undefined` ; `notice` ใน `div.mb-4` ; **`<h2 tabIndex={-1} aria-live="polite" className="text-lg leading-relaxed outline-none">`** : รับโฟกัสด้วยโค้ดได้แต่ Tab ไม่ถึง — หน้าตรวจอาการย้ายโฟกัสมาที่นี่เมื่อเปลี่ยนสถานะ screen reader จึงอ่านสถานะใหม่ทันที ; `aria-live="polite"` รออ่านของค้างให้จบก่อน ; `outline-none` เพราะกรอบโฟกัสบนหัวข้อไม่ช่วยอะไร ; `children` ใน `div.mt-5` ; ปิดท้ายด้วย `<ReferenceLine …>`

## 3. การส่งข้อมูล

รับ props จากกล่องแต่ละแบบ (ข้อความ `node.text` เป็น `heading`, `node.reference` เป็น `reference`) แล้ววาด ; ไม่มี state

## 4. จุดที่ควรระวัง

- การย้ายโฟกัสไปที่ `h2` ทำโดยโค้ดฝั่ง `SessionPage` (ไม่ใช่ไฟล์นี้) ; คอมโพเนนต์นี้เพียงเตรียม `tabIndex={-1}` ไว้ให้
- `aria-live` บนหัวข้อที่ถูกโฟกัสอาจทำให้ screen reader บางตัวอ่านซ้ำ (อนุมานจากพฤติกรรมของ ARIA; ไม่ได้ทดลอง)
- `label`, `notice`, `children` ตรวจด้วย `!== undefined` ไม่ใช่ truthy จึงยอมให้ค่าอย่างสตริงว่างหรือ `0` แสดง

# frontend/src/components/step/InstructionStep.tsx

## 1. หน้าที่ของไฟล์

กล่องขั้นตอนแบบ "ขั้นตอน" (instruction) ที่ **ไม่ต้องยืนยันคำเตือน** : แสดงข้อความและปุ่ม "ถัดไป" ปุ่มเดียว (มีทางไปต่อทางเดียว) instruction ที่ต้องยืนยันคำเตือนไม่มาที่กล่องนี้ — `StepView` ส่งไป `SafetyGateStep` แทน เพราะถ้าส่ง `continue` ให้สถานะที่ต้องยืนยัน เซิร์ฟเวอร์จะปฏิเสธและสถานะไม่ขยับ

- **ใครเรียกใช้**: `step/StepView.tsx`
- **เรียกใช้**: `STEP_KIND_LABELS`, `Button`, `StepCard`, type `StepProps`

## 2. อธิบายทีละบล็อก

`InstructionStep` (12–29): `StepCard` ป้าย `ขั้นตอน` heading = `node.text` ; ปุ่ม `variant="primary"` ข้อความ **"ถัดไป"** (ใช้คำกลางๆ ไม่ใช่ "ทำแล้ว"/"เสร็จแล้ว" เพราะบางผังเริ่มด้วยคำอธิบาย ไม่ใช่คำสั่งให้ลงมือทำ) → `onAction({ type: 'continue' })` ; `disabled={isPending}`

## 3. การส่งข้อมูล

คลิก → `onAction({"type":"continue"})` → `POST …/actions` → เซิร์ฟเวอร์ตอบสถานะถัดไป

## 4. จุดที่ควรระวัง

- เป็นกล่องสำรอง (fallback) ของ `StepView` เมื่อเจอ `type` ที่ไม่รู้จัก (ไม่ใช่ checkpoint/input) และไม่ใช่โหนดจบ
- ถ้าข้อมูลมี `instruction` ที่ `safety_critical` แต่ `requiresSafetyConfirmation` ไม่เป็น true (เกิดไม่ได้จาก engine) จะได้ปุ่มธรรมดาที่เซิร์ฟเวอร์ปฏิเสธ — ด่านจริงอยู่ที่เซิร์ฟเวอร์

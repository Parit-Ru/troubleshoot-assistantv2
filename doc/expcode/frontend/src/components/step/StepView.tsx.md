# frontend/src/components/step/StepView.tsx

## 1. หน้าที่ของไฟล์

"ตัวเลือกกล่อง" : รับสถานะปัจจุบัน (`RenderedNode`) แล้วเลือกกล่องขั้นตอนให้ตรง — ผู้เรียกใช้แค่ชิ้นนี้ชิ้นเดียว

- **ใครเรียกใช้**: `pages/SessionPage.tsx`
- **เรียกใช้**: `CheckpointStep`, `InputStep`, `InstructionStep`, `OutcomeStep`, `SafetyGateStep`, type `StepProps`, `ReactNode`

## 2. อธิบายทีละบล็อก

### คำอธิบายลำดับการเลือก (คอมเมนต์ 9–23)
1. `node.isTerminal` → `OutcomeStep`
2. `node.requiresSafetyConfirmation` → `SafetyGateStep`
3. `node.type` → `CheckpointStep` / `InputStep` / อื่นๆ เป็น `InstructionStep`

**ดูค่า flag ก่อน `type`** เพราะ `isTerminal` และ `requiresSafetyConfirmation` เป็นค่าที่เซิร์ฟเวอร์คำนวณมาให้แล้ว ถือเป็นคำตอบสุดท้าย หน้าจอไม่ต้องคิดซ้ำ ถ้าดู `type` ก่อน instruction ที่ต้องยืนยันคำเตือนจะหลุดเป็นกล่อง "ถัดไป" ธรรมดา
⚠️ ผู้เรียกต้องใส่ `key={node.nodeId}` ให้ชิ้นนี้เสมอ เพื่อล้าง state ในกล่อง (ช่องติ๊กคำเตือน ค่าที่พิมพ์) ทุกครั้งที่เปลี่ยนสถานะ

### `StepViewProps` (24–33)
`extends StepProps` + `outcomeActions?: ReactNode` (ปุ่มของสถานะสิ้นสุด) + `outcomeForm?: ReactNode` (ช่องกรอกผลลัพธ์) — ส่งต่อเฉพาะ `OutcomeStep` : แขนงอื่นไม่รับ prop นี้เลย ช่องกรอกจึงไม่มีทางโผล่กลางการตรวจแม้ผู้เรียกจะส่งมาผิดที่

### `StepView` (35–64)
`const { node } = stepProps` แล้วตรวจตามลำดับ : terminal → `OutcomeStep` (ส่ง `node`, `manualLabel`, `form`, `actions`) ; requiresSafetyConfirmation → `SafetyGateStep` ; `checkpoint` → `CheckpointStep` ; `input` → `InputStep` ; ที่เหลือ → `InstructionStep` (รวมกรณีเจอ type ที่ไม่รู้จัก เป็นทางสำรอง)

## 3. การส่งข้อมูล

`SessionPage` ส่ง `node`, `onAction`, `isPending`, `manualLabel`, `outcomeForm`, `outcomeActions` → `StepView` เลือกกล่อง → กล่องแจ้ง `onAction` กลับขึ้นไป

## 4. จุดที่ควรระวัง

- **ถ้าผู้เรียกลืม `key`** state ในกล่องจะค้างข้ามสถานะ (โดยเฉพาะช่องติ๊กคำเตือน) — จุดนี้ต้องตรวจในการอ่าน `SessionPage`
- type ที่ไม่รู้จักตกไปเป็น `InstructionStep` ที่มีปุ่ม "ถัดไป" ซึ่งอาจส่ง action ผิด (เซิร์ฟเวอร์จะปฏิเสธ) — ทางสำรองที่ปลอดภัยเพราะด่านจริงอยู่ที่เซิร์ฟเวอร์

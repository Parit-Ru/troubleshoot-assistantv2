# frontend/src/components/step/stepProps.ts

## 1. หน้าที่ของไฟล์

ประกาศ interface `StepProps` : props ที่ "กล่องขั้นตอน" ทุกแบบรับเหมือนกัน (`node`, `onAction`, `isPending`, `manualLabel?`) กล่องขั้นตอนไม่เรียก API เอง — รับสถานะเข้ามาแล้วแจ้งผ่าน `onAction` ว่าผู้ใช้ต้องการทำอะไร ส่วนการตัดสินว่าไปสถานะไหนต่อเป็นของเครื่องสถานะฝั่งเซิร์ฟเวอร์ ผลดี: เขียนเทสได้โดยไม่ต้องมีเซิร์ฟเวอร์

- **ใครเรียกใช้**: `CheckpointStep`, `InputStep`, `InstructionStep`, `OutcomeStep` (ใช้ `Pick`), `SafetyGateStep`, `StepView`
- **เรียกใช้**: type `RenderedNode`, `TraversalAction` จาก `../../api/types`

## 2. อธิบายทีละบล็อก

`export interface StepProps` (15–24):
| field | ความหมาย |
|---|---|
| `node: RenderedNode` | สถานะปัจจุบันที่เซิร์ฟเวอร์ส่งมา |
| `onAction: (action: TraversalAction) => void` | แจ้งการกระทำออกไป ผู้เรียกส่งต่อให้เซิร์ฟเวอร์ |
| `isPending: boolean` | true = กำลังรอเซิร์ฟเวอร์ กล่องต้องปิดทุกปุ่ม กันส่งซ้ำ |
| `manualLabel?: string` | ชื่อคู่มือที่แสดงในบรรทัดที่มา (เช่น `Samsung AR70H**D1***`) |

## 3. การส่งข้อมูล

`SessionPage` → `StepView` → กล่องแต่ละแบบ : ข้อมูลลงเป็น props ; การกระทำของผู้ใช้ขึ้นเป็น `onAction(action)` → `useSubmitAction().mutate(action)` → HTTP

## 4. จุดที่ควรระวัง

ไฟล์เป็น type ล้วน ไม่มีโค้ดทำงาน ; ไม่มีจุดน่าสงสัย

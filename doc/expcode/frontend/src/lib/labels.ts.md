# frontend/src/lib/labels.ts

## 1. หน้าที่ของไฟล์

ตารางค่าคงที่แปลง "ค่าจากข้อมูล (อังกฤษ)" เป็น "ข้อความไทยที่แสดงบนหน้าจอ" — ไม่มีตรรกะ จึงไม่มีเทส (คอมเมนต์ 6) ทุกตารางเป็น `Record<..., string>` เพื่อให้ TypeScript ไม่ยอม build ถ้าเพิ่มค่าใหม่ใน type แล้วลืมเพิ่มในตาราง

- **ใครเรียกใช้**: `components/EquipmentPanel.tsx`, `components/step/{CheckpointStep, InputStep, InstructionStep, OutcomeStep, SafetyGateStep}.tsx`, `pages/HomePage.tsx`, `pages/SymptomsPage.tsx`
- **เรียกใช้**: type `DeviceCategory`, `InputType`, `OutcomeKind` จาก `../api/types`

## 2. อธิบายทีละบล็อก

| บรรทัด | สิ่งที่ประกาศ | เนื้อหา |
|---|---|---|
| 20–26 | `DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string>` | Air Conditioner = เครื่องปรับอากาศ, Refrigerator = ตู้เย็น, Washing Machine = เครื่องซักผ้า, Microwave = ไมโครเวฟ, Television = โทรทัศน์ (คอมเมนต์ 16–18: ต้องมี Microwave แม้ตัดออกจากขอบเขตแล้ว เพราะ `DeviceCategory` ใน engine ยังมีค่านี้ ไม่อย่างนั้น compile ไม่ผ่าน) |
| 37–42 | `OUTCOME_TITLES: Record<OutcomeKind, string>` | user_fixed = แก้ปัญหาได้แล้ว ; normal_behavior = เครื่องทำงานปกติ ไม่ได้เสีย ; handoff_informed = ส่งต่อศูนย์บริการ พร้อมข้อมูลสำหรับช่าง ; handoff_unknown = คู่มือไม่ครอบคลุมกรณีนี้ |
| 54–61 | `StepKind` และ `STEP_KIND_LABELS` | checkpoint = คำถาม ; instruction = ขั้นตอน ; safety_instruction = ขั้นตอนที่ต้องยืนยันคำเตือน ; input = กรอกข้อมูล — `StepKind` ไม่ใช่ `NodeType` ตรงๆ เพราะ instruction แบ่งสองป้ายตามต้องยืนยันคำเตือนหรือไม่ และโหนดจบใช้ `OUTCOME_TITLES` แทน |
| 67–72 | `INPUT_SUBMIT_LABELS: Record<InputType, string>` | error_code = ส่งรหัส ; model_number = ส่งรุ่นเครื่อง ; number/text = ส่ง |

## 3. การส่งข้อมูล

ค่าจาก `RenderedNode` / `GraphSummary` (เช่น `outcomeKind`, `deviceCategory`) → ค้นตารางนี้ → ข้อความไทยที่แสดงในคอมโพเนนต์

## 4. จุดที่ควรระวัง

- ชื่อประเภทเครื่องใน `DEVICE_CATEGORY_LABELS` ครอบคลุมเฉพาะ 5 ประเภทตาม type — ถ้า schema ยอมให้ประเภทอื่น (Printer ฯลฯ) ตามที่ `troubleshooting-graph.v2.schema.json` อนุญาต จะต้องขยาย type ก่อน
- หน้าจอเป็นผู้เลือก key `StepKind` จาก `type` + `requiresSafetyConfirmation` (ตรรกะนี้อยู่ที่ `StepView`/คอมโพเนนต์ ไม่ใช่ที่นี่)

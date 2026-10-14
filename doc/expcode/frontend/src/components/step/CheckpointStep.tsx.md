# frontend/src/components/step/CheckpointStep.tsx

## 1. หน้าที่ของไฟล์

กล่องขั้นตอนแบบ "คำถาม" (checkpoint) : แสดงคำถามและปุ่ม "ใช่" / "ไม่ใช่" แจ้งคำตอบออกไปทาง `onAction` ไม่รู้ว่าแต่ละคำตอบพาไปสถานะไหน (ตัดสินที่ `resolveNextNode` ฝั่งเซิร์ฟเวอร์ ผ่าน `on_yes` / `on_no`)

- **ใครเรียกใช้**: `step/StepView.tsx`
- **เรียกใช้**: `STEP_KIND_LABELS` (`lib/labels`), `Button`, `StepCard`, type `StepProps`

## 2. อธิบายทีละบล็อก

`CheckpointStep({ node, onAction, isPending, manualLabel })` (12–45): ใช้ `StepCard` ป้าย `คำถาม` + heading = `node.text` ; ปุ่ม 2 ปุ่ม `variant="answer"` (น้ำหนักเท่ากัน ไม่ใช้เขียว–แดง เพราะสีชี้นำคำตอบ) :
- "ใช่" → `onAction({ type: 'answer', value: 'yes' })`
- "ไม่ใช่" → `onAction({ type: 'answer', value: 'no' })`
- ทั้งคู่ `disabled={isPending}` กันส่งซ้ำ
- คำบนปุ่มต้องเป็น "ใช่" / "ไม่ใช่" ตรงตัว ห้ามเปลี่ยนเป็น "มี/ไม่มี" เพราะคำถามบางข้อในข้อมูลเขียนว่า "หากไม่ทราบ ให้ตอบไม่ใช่" (ตัวอย่าง: โหนด `n_pipe` ในกราฟ `improper_airflow_temperature`)

## 3. การส่งข้อมูล

คลิกปุ่ม → `onAction({type:'answer', value})` → `SessionPage` → `useSubmitAction` → `POST /traversal/sessions/:id/actions` → ตัวอย่าง body: `{"type":"answer","value":"yes"}`

## 4. จุดที่ควรระวัง

- กล่องนี้ถูกเลือกโดย `StepView` เมื่อ `node.type === 'checkpoint'` (และไม่ใช่โหนดจบหรือโหนดที่ต้องยืนยันคำเตือน) — checkpoint ที่ตั้ง `safety_critical` ในข้อมูลไม่มีด่านเพิ่ม (สอดคล้องกับ engine)
- ปุ่มสูง `min-h-14` เต็มความกว้าง เหมาะกับการแตะบนมือถือ

# frontend/src/components/step/InputStep.tsx

## 1. หน้าที่ของไฟล์

กล่องขั้นตอนแบบ "กรอกข้อมูล" (input) เช่น กรอกรหัสข้อผิดพลาดที่หน้าจอแอร์ : ช่องข้อความ + ปุ่มส่ง (ข้อความปุ่มตามชนิด: "ส่งรหัส", "ส่งรุ่นเครื่อง", "ส่ง")
⚠️ **ห้ามตรวจรูปแบบของค่าที่กรอกในหน้าจอ** (คอมเมนต์ 12–16): (1) เซิร์ฟเวอร์ไม่ได้ส่งรูปแบบที่ถูกต้องมา ถ้าเขียนเองเป็นกฎชุดที่สองที่อาจไม่ตรงกับข้อมูล (2) การกรอกผิดไม่ใช่ข้อผิดพลาด แต่เป็นการเปลี่ยนสถานะ (`on_invalid`) ไปยังสถานะที่อธิบายรูปแบบรหัส ถ้าหน้าจอกันไว้ ผู้ใช้จะไม่มีทางไปถึงสถานะนั้น หน้าจอทำแค่ตัดช่องว่างหัวท้ายและไม่ให้ส่งค่าว่าง

- **ใครเรียกใช้**: `step/StepView.tsx` (เมื่อ `node.type === 'input'`)
- **เรียกใช้**: `INPUT_SUBMIT_LABELS`, `STEP_KIND_LABELS`, `Button`, `StepCard`, type `StepProps`, `InputType`, `FormEvent`, `useState`

## 2. อธิบายทีละบล็อก

- `BASE_INPUT_CLASSES` (19–20): สไตล์ช่อง (ขอบ `border-line`, พื้น `bg-canvas`, โฟกัสขอบส้ม)
- `inputType = node.inputType ?? 'text'` (24) ; `value` state (27) ล้างเองเมื่อเปลี่ยนสถานะเพราะผู้เรียกใส่ `key={node.nodeId}` ; `trimmed = value.trim()`, `canSubmit = trimmed !== '' && !isPending` (28–29)
- `handleSubmit(event)` (36–40): `preventDefault()` แล้วถ้า `canSubmit` เรียก `onAction({ type: 'input', value: trimmed })` — เช็ค `canSubmit` ซ้ำเพราะกด Enter ได้แม้ปุ่มถูกปิด
- `isCode` (43): `error_code`/`model_number` ใช้ฟอนต์ `font-mono` (แยก 0/O, 1/l ได้)
- JSX (46–77): `<form onSubmit>` (กด Enter แล้วส่งได้เอง) ; `<input type="text">` : `aria-label={node.text}` (ช่องไม่มีป้ายที่มองเห็น), `inputMode` = `numeric` เมื่อชนิด `number` ไม่เช่นนั้น `text`, ปิด `autoComplete/autoCorrect/autoCapitalize/spellCheck` (รหัสไม่ใช่คำในพจนานุกรม และค่าที่ส่งต้องตรงกับที่ผู้ใช้เห็น) ; ปุ่ม `type="submit"` `disabled={!canSubmit}`

## 3. การส่งข้อมูล

พิมพ์ → ส่ง → `onAction({"type":"input","value":"E1"})` → `POST …/actions` → engine ตรวจ `pattern` (JavaScript regex ฝั่งเซิร์ฟเวอร์) แล้วไป `next` หรือ `on_invalid`

## 4. จุดที่ควรระวัง

- หน้าจอ **ไม่แปลงเป็นตัวพิมพ์ใหญ่** : pattern ในข้อมูล (`^[A-Za-z]{1,2}[0-9]{1,3}$`) รับทั้งสองแบบ ถ้าเปลี่ยน pattern เป็นตัวพิมพ์ใหญ่อย่างเดียว ผู้ใช้ที่พิมพ์ `e1` จะเข้าสถานะ `n_invalid_code`
- ค่าที่ส่งถูกจำกัดที่เซิร์ฟเวอร์ไม่เกิน 255 ตัวอักษร (`MAX_INPUT_LENGTH`) แต่ช่องนี้ไม่มี `maxLength` — ค่ายาวเกินจะได้ 400 `INVALID_ACTION` (อนุมานจากโค้ดทั้งสองฝั่ง)
- ผู้เรียกต้องใส่ `key={node.nodeId}` เพื่อล้างค่าที่พิมพ์เมื่อเปลี่ยนสถานะ (และเมื่อวนกลับโหนดเดิมหลังกรอกผิด `nodeId` เท่าเดิม จึงไม่รีเซ็ตช่อง — ผู้ใช้เห็นค่าที่พิมพ์ไว้เดิมเมื่อกลับมาแก้ ซึ่งอาจเป็นพฤติกรรมที่ตั้งใจ) (อนุมานจากโค้ด; ไม่ได้ทดลองในเบราว์เซอร์)

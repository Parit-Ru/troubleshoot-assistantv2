# frontend/src/components/step/OutcomeStep.tsx

## 1. หน้าที่ของไฟล์

กล่องของ "สถานะสิ้นสุด" (resolution หรือ escalation) : จบการตรวจ ไม่มีทางไปต่อ แสดงหัวข้อ+ไอคอน+สีตาม `outcomeKind` แล้วข้อความของสถานะ จากนั้นช่องกรอกผลลัพธ์ (`form`) และปุ่ม (`actions`) ที่รับเข้ามาเป็น prop กล่องนี้ไม่มีปุ่มของตัวเอง เพราะ "ตรวจอาการอื่น" / "เริ่มอาการนี้ใหม่" ต้องใช้ router และเริ่ม session ใหม่ ซึ่งเป็นงานของหน้าตรวจอาการ ; ปุ่มทั้งสองอยู่นอกฟอร์ม กดได้เสมอไม่ว่าผู้ใช้จะกรอกหรือไม่

- **ใครเรียกใช้**: `step/StepView.tsx` (เมื่อ `node.isTerminal`)
- **เรียกใช้**: `OUTCOME_TITLES`, `Icon`, `StepCard`, type `StepProps` (`Pick<…,'node'|'manualLabel'>`), type `OutcomeKind`

## 2. อธิบายทีละบล็อก

- `OutcomeStepProps extends Pick<StepProps, 'node' | 'manualLabel'>` + `form?`, `actions?` (25–28)
- `OUTCOME_COLOR_CLASSES` (31–36): user_fixed → `text-success`, normal_behavior → `text-info`, handoff_informed/handoff_unknown → `text-accent`
- `OUTCOME_ICONS` (38–43): success, info, wrench, wrench
- `OutcomeStep` (45–71): `kind = node.outcomeKind ?? 'handoff_unknown'` — **ค่าสำรองที่ปลอดภัยที่สุด** ถ้า `outcomeKind` หายไป ระบบไม่ควรบอกว่า "แก้ได้แล้ว" เมื่อไม่รู้ว่าจบแบบไหน (คอมเมนต์ 47–50 ระบุว่าตรวจข้อมูลแล้ว 29/29 สถานะมี outcomeKind) ; heading = ไอคอน + `OUTCOME_TITLES[kind]` ; เนื้อหา `<p>{node.text}</p>` ; `form` อยู่ใน `div` มีเส้นคั่นบน (`border-t`) ; `actions` อยู่ใน `div.space-y-3`

## 3. การส่งข้อมูล

`node` (outcomeKind, text, reference) จากเซิร์ฟเวอร์ + `form`/`actions` (`ReactNode` จาก `SessionPage`) → วาด ; ไม่มี state และไม่เรียก API ในกล่องนี้

## 4. จุดที่ควรระวัง

- ไม่มีป้ายชนิด (`label`) บน `StepCard` เพราะสถานะสิ้นสุดใช้หัวข้อจาก `OUTCOME_TITLES` แทน
- ข้อความของสถานะจบบางกราฟ (เช่น กราฟเครื่องซักผ้าร่าง) เป็นภาษาอังกฤษ จะแสดงตามที่ข้อมูลเขียน

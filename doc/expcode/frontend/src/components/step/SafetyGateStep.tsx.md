# frontend/src/components/step/SafetyGateStep.tsx

## 1. หน้าที่ของไฟล์

กล่องขั้นตอนที่ต้อง **ยืนยันคำเตือนก่อน** (instruction ที่ `safety_critical`) : แสดงกล่องคำเตือนสีแดงก่อนข้อความขั้นตอน, ช่องติ๊ก "ฉันอ่านคำเตือนแล้ว และจะทำตามก่อนลงมือ" และปุ่ม "ยืนยันและทำขั้นตอนนี้" ที่กดได้ก็ต่อเมื่อติ๊กแล้ว
⚠️ **ช่องติ๊กนี้ไม่ใช่ตัวบังคับความปลอดภัย** (คอมเมนต์ 11–13) — ตัวบังคับจริงอยู่ที่ `resolveNextNode` ฝั่งเซิร์ฟเวอร์ ซึ่งรับเฉพาะ `{ type: 'confirm_safety' }` ถ้าใครแก้ให้ส่ง `continue` เซิร์ฟเวอร์จะปฏิเสธและสถานะไม่ขยับ ช่องติ๊กมีไว้เพื่อประสบการณ์ใช้งาน: กันนิ้วกด "ถัดไป" ซ้ำตำแหน่งเดิมโดยไม่อ่าน

- **ใครเรียกใช้**: `step/StepView.tsx` (เมื่อ `node.requiresSafetyConfirmation`)
- **เรียกใช้**: `STEP_KIND_LABELS`, `Button`, `Notice`, `StepCard`, type `StepProps`, `useState`

## 2. อธิบายทีละบล็อก

- `const [acknowledged, setAcknowledged] = useState(false)` (30) — state ในกล่องนี้ ต้องเริ่มว่างทุกครั้งที่เปลี่ยนสถานะ ซึ่งทำได้ด้วย `key={node.nodeId}` ที่ผู้เรียกใส่ให้ (คอมเมนต์ 19–29): ถ้าไม่มี key ผังที่มีสถานะต้องยืนยันสองสถานะติดกัน (เช่น `n_power_off` แล้ว `n_power_back_on` ใน `indicator_blinking`) React จะใช้กล่องเดิมซ้ำ ช่องติ๊กจะค้างเป็นติ๊ก ผู้ใช้กดยืนยันสถานะที่สองได้โดยไม่ได้อ่านคำเตือนใหม่
- `StepCard` (33–73): ป้าย `ขั้นตอนที่ต้องยืนยันคำเตือน`, `tone="danger"` (ขอบแดงหนา), `notice` = `<Notice tone="danger" title="คำเตือนก่อนทำขั้นตอนนี้">{node.safetyWarning}</Notice>` (มาก่อนข้อความขั้นตอน), `heading = node.text`
- `<label>` ห่อ `<input type="checkbox">` จริง (ไม่ทำ div ปลอม เพื่อได้ Space, screen reader และกดที่ข้อความฟรี; สูง ≥ 48px) — `checked={acknowledged}`, `disabled={isPending}`, `onChange` อัปเดต state
- ปุ่ม `primary` : `disabled={!acknowledged || isPending}`, คลิก → `onAction({ type: 'confirm_safety' })`

## 3. การส่งข้อมูล

```
node.safetyWarning (เซิร์ฟเวอร์) → Notice ──ผู้ใช้ติ๊ก (state ในเครื่อง)──► กดยืนยัน → onAction({"type":"confirm_safety"}) → POST …/actions
```
ถ้าส่ง `{"type":"continue"}` เซิร์ฟเวอร์ตอบ 400 `SAFETY_CONFIRMATION_REQUIRED` (ดู `traversal-engine.ts`)

## 4. จุดที่ควรระวัง

- **พึ่ง `key={node.nodeId}` จากผู้เรียก** (`SessionPage`) เพื่อรีเซ็ตช่องติ๊ก — ถ้าลืมใส่จะเกิดช่องว่างตามที่คอมเมนต์ระบุ แม้เซิร์ฟเวอร์จะยังกันด่านจริงไว้ได้
- ถ้า `safetyWarning` เป็น `undefined` (ไม่ควรเกิดตามกฎของข้อมูล/ตัวตรวจ) กล่องแดงจะว่างเปล่า — เป็นบทเรียนจาก demo ที่ `path-coverage.spec.ts` ตรวจข้อมูลกันไว้

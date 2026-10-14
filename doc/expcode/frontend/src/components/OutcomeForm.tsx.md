# frontend/src/components/OutcomeForm.tsx

## 1. หน้าที่ของไฟล์

ช่องกรอก "ผลเป็นอย่างไรบ้าง?" ที่หน้าสุดท้ายของการตรวจ (ทั้ง resolution และ escalation) ไม่บังคับกรอก ข้อความที่กรอกเป็นข้อมูลบันทึกอย่างเดียว ไม่ได้ใช้ตัดสินขั้นตอนใด ไม่เรียก API เอง — หน้าตรวจอาการถือ mutation แล้วส่งสถานะเข้ามาทาง props
มี 2 สถานะ ตัดสินจาก `savedText` ที่เซิร์ฟเวอร์ส่งมาเท่านั้น (ไม่มี state "บันทึกแล้ว" แยกในหน้าจอ): ยังไม่มี → ฟอร์ม ; มีแล้ว → ข้อความอ่านอย่างเดียว (บันทึกได้ครั้งเดียว กด F5 แล้วเห็นเหมือนกัน) ข้อความของผู้ใช้แสดงเป็น text ของ React เท่านั้น (ไม่ใช้ `dangerouslySetInnerHTML`) จึงไม่ตีความ HTML/`<script>`

- **ใครเรียกใช้**: `pages/SessionPage.tsx` (ส่งเข้า `StepView` เป็น `outcomeForm`)
- **เรียกใช้**: `describeError` (`lib/errors`), `MAX_OUTCOME_LENGTH, checkOutcome, formatOutcomeCounter, normalizeOutcome` (`lib/outcome`), `Button`, `Notice`, hooks `useEffect/useId/useRef/useState`

## 2. อธิบายทีละบล็อก

- props (29–40): `savedText: string | null | undefined`, `onSubmit(text)`, `isSending`, `error: Error | null`, `onRefresh()`
- `TEXTAREA_CLASSES` (42–43)
- state/hook (45–63): `textareaId/hintId/counterId = useId()` (เชื่อม label/คำอธิบาย/ตัวนับกับช่องสำหรับ screen reader) ; `value` ; `isSaved = typeof savedText === 'string'` ; **การย้ายโฟกัส**: `wasSavedAtMount` (ref) + `savedHeadingRef` + `useEffect` — หลังกดบันทึกปุ่มที่โฟกัสอยู่หาย โฟกัสตกไป `body` และ screen reader เงียบ จึงย้ายโฟกัสไป "บันทึกผลแล้ว" ; ไม่ย้ายตอนเปิดหน้าที่บันทึกไว้แล้ว (F5) เพราะไม่ใช่ผลของการกระทำผู้ใช้
- แขนง "บันทึกแล้ว" (65–77): `<section>` มี `<p tabIndex={-1}>บันทึกผลแล้ว</p>` และข้อความ `whitespace-pre-wrap break-words` (คงการขึ้นบรรทัดใหม่ และคำยาวไม่ดันหน้าจอล้น)
- แขนงฟอร์ม (79–143): `canSubmit = checkOutcome(value) === 'ok' && !isSending` ; `described = error ? describeError(error) : null` ; `handleSubmit` เรียก `onSubmit(normalizeOutcome(value))` ; `<label>` "ผลเป็นอย่างไรบ้าง? (ไม่บังคับ)" + คำอธิบาย "ไม่ต้องใส่ข้อมูลส่วนตัว … · บันทึกได้ครั้งเดียว แก้ไขภายหลังไม่ได้" ; `<textarea maxLength={1000} rows={4} aria-describedby=…>` + ตัวนับ `formatOutcomeCounter(value)` ; ถ้ามี error แสดง `<div role="alert"><Notice tone="danger" …>` พร้อมปุ่ม "ดึงข้อมูลล่าสุด" เมื่อ `recovery === 'reload-session'` ; ปุ่ม "บันทึกผล" แบบ `secondary` (ปุ่มหลักของหน้าคือ "ตรวจอาการอื่น") `isLoading={isSending}`

## 3. การส่งข้อมูล

```
ผู้ใช้พิมพ์ → checkOutcome → onSubmit(text ที่ trim แล้ว) → useSubmitOutcome → POST /traversal/sessions/:id/outcome {"text": "…"}
เซิร์ฟเวอร์ตอบ SessionResponse(outcome) → แคช → savedText เปลี่ยนเป็น string → ฟอร์มกลายเป็นข้อความอ่านอย่างเดียว
```

## 4. จุดที่ควรระวัง

- **ข้อมูลส่วนบุคคล**: ช่องรับข้อความอิสระ ผู้ใช้อาจพิมพ์ข้อมูลส่วนตัวแม้มีคำเตือน และข้อความถูกเก็บต่อในตาราง `sessions` (ไม่มีตัวกวาด) ตามที่ migration 005 ระบุ
- ถ้าบันทึกล้มเหลว ข้อความที่พิมพ์ยังคงอยู่ (state `value` ไม่ถูกล้าง) ผู้ใช้กดบันทึกใหม่ได้
- `maxLength={1000}` นับหน่วย UTF-16 เหมือนฝั่งเซิร์ฟเวอร์ และต้องตรงกับ `MAX_OUTCOME_LENGTH` ของ backend
- รหัส `OUTCOME_ALREADY_SUBMITTED`/`SESSION_NOT_COMPLETED` ให้ปุ่มดึงข้อมูลล่าสุด (ไม่ใช่ลองส่งซ้ำ)

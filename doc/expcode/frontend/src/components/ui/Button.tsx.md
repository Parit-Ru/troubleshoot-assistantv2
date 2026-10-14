# frontend/src/components/ui/Button.tsx

## 1. หน้าที่ของไฟล์

ปุ่มพื้นฐานของแอป มี 4 รูปแบบ (`primary`, `secondary`, `answer`, `text`) และสถานะกำลังโหลด (`isLoading` แสดงตัวหมุนและปิดปุ่ม)

- **ใครเรียกใช้**: `OutcomeForm`, `SessionErrorNotice`, `SessionHeader`, `SymptomSearchForm`, `TerminalActions`, `step/{CheckpointStep, InputStep, InstructionStep, ReferenceLine, SafetyGateStep}`, `HomePage`, `SymptomsPage`
- **เรียกใช้**: `Icon` (spinner), type `ComponentProps` จาก `react`

## 2. อธิบายทีละบล็อก

- `VARIANT_CLASSES` (6–15) — เขียนชื่อคลาสเต็มทุกคำ (Tailwind ต่อสตริงไม่ได้):
  - `primary`: พื้นส้ม `bg-accent` ตัวอักษร `text-canvas` เสมอ (คอมเมนต์ 7: ห้าม `text-white` อ่านยากบนสีส้ม), สูงอย่างน้อย `min-h-12`
  - `secondary`: ขอบ `border-line` พื้น `bg-panel`
  - `answer`: ปุ่มตอบเต็มความกว้าง `min-h-14` ชิดซ้าย ตัวใหญ่ (ใช้กับ "ใช่/ไม่ใช่")
  - `text`: ปุ่มลักษณะลิงก์
  - ทุกแบบใช้ตัวแปรสถานะ `enabled:hover:` เพื่อไม่ให้ hover มีผลตอนปิดปุ่ม
- `BASE_CLASSES` (18–19): `inline-flex items-center gap-2 transition`, กรอบโฟกัสส้ม (`focus-visible:outline …`), `disabled:cursor-not-allowed disabled:opacity-50`
- `ButtonProps extends ComponentProps<'button'>` + `variant?`, `isLoading?` (21–24)
- `Button` (26–49): ค่าเริ่มต้น `variant='primary'`, `isLoading=false`, **`type='button'`** (กันปุ่มในฟอร์มส่งฟอร์มโดยไม่ตั้งใจ) ; `disabled={disabled || isLoading}` ; `aria-busy={isLoading || undefined}` ; ประกอบ `className` จากฐาน + แบบ + ที่ส่งมา ; ถ้า `isLoading` แสดง `<Icon name="spinner" … animate-spin />` ก่อน `children`

## 3. การส่งข้อมูล

รับ props ผ่านการเรียกใช้ใน JSX (`onClick`, `disabled`, `children` …) ส่งต่อ `...rest` ให้ `<button>` ; ไม่มีข้อมูลไหลข้ามไฟล์

## 4. จุดที่ควรระวัง

- `...rest` ถูกกระจายหลังคุณสมบัติหลัก ทำให้ผู้เรียกแทนค่า `aria-busy`, `className` (แต่ `className` ถูกดึงออกมารวมแล้ว) ได้ ยกเว้น `type`/`disabled` ที่ดึงออกมาจัดการเอง
- ปุ่ม `answer` ใช้ `justify-start`/`text-left` ต่างจากแบบอื่น ๆ ที่ `justify-center`
- ปุ่มที่ `isLoading` ถูกปิดอัตโนมัติ — ผู้เรียกไม่ต้องใส่ `disabled` ซ้ำ

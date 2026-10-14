# frontend/src/components/ui/Icon.tsx

## 1. หน้าที่ของไฟล์

คอมโพเนนต์ไอคอนของทั้งแอป วาดเองเป็น SVG ทุกตัว (ไม่ใช้ไลบรารีไอคอน) มี 12 ไอคอน เรียกใช้เป็น `<Icon name="warning" className="h-5 w-5 text-danger" />` สีมาจาก `currentColor` (เปลี่ยนด้วยคลาส `text-*`) ขนาดกำหนดผ่าน `className`

- **ใครเรียกใช้**: `Button.tsx`, `Notice.tsx`, `EquipmentPanel.tsx`, `SymptomRow.tsx`, `AppShell.tsx`, `ServerStatus.tsx`, `OutcomeStep.tsx`, `PathRail.tsx`, `HomePage.tsx`, `NotFoundPage.tsx`, `SessionPage.tsx`, `SymptomsPage.tsx`
- **เรียกใช้**: type `ReactNode` จาก `react` เท่านั้น

## 2. อธิบายทีละบล็อก

### บล็อก A — `IconName` (บรรทัด 15–28)
12 ชื่อ : `warning` (เตือน), `success` (ถูก), `info`, `wrench` (ส่งต่อช่าง), `chevron-right`, `book` (หน้าคู่มือ), `pencil` (ผู้พัฒนาเพิ่มเอง), `box` (อุปกรณ์), `spinner` (หมุนรอ), `logo` (สถานะหนึ่งเปลี่ยนได้สองทาง), `switch-on`, `switch-off` — พิมพ์ชื่อผิด TypeScript แจ้งตั้งแต่ตอนเขียน

### บล็อก B — `ICONS: Record<IconName, IconShape>` (บรรทัด 30–143)
`IconShape = { viewBox, body }` ; ตัวส่วนใหญ่ใช้ viewBox `0 0 24 24` ; สวิตช์เป็นรูปแนวตั้งใช้ `0 0 20 32` ; `spinner` เป็นวงกลมสามในสี่วง (ผู้เรียกใส่ `animate-spin` เอง) ; `switch-on` มีปุ่มทึบ (fill) อยู่ด้านบน ส่วน `switch-off` ปุ่มโปร่งอยู่ด้านล่าง — ต่างทั้งตำแหน่งและความทึบ จึงไม่พึ่งสีอย่างเดียว (คอมเมนต์ 126) ; เพราะเป็น `Record` ถ้าเพิ่มชื่อใน `IconName` แล้วไม่เพิ่มรูป จะ build ไม่ผ่าน

### บล็อก C — `Icon` (บรรทัด 145–172)
props : `name`, `className = 'h-5 w-5'`, `label?` ; วาด `<svg>` ด้วย `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`, round cap/join ; **การเข้าถึง**: ถ้ามี `label` → `role="img"` + `aria-label` ; ไม่มี → `aria-hidden` (ไอคอนที่อยู่คู่ข้อความซ่อนจาก screen reader)

## 3. การส่งข้อมูล

ไม่มีข้อมูลไหล: รับ `name`/`className`/`label` เป็น props แล้วคืน SVG

## 4. จุดที่ควรระวัง

- `switch-on` มีการ `fill="currentColor"` เฉพาะวงกลม (ข้ามค่า `fill="none"` ของ svg) ตั้งใจให้ทึบ
- ไอคอนที่ใช้ตัวเดียวโดยไม่มีข้อความต้องส่ง `label` เอง ไม่เช่นนั้น screen reader จะอ่านไม่ได้
- ไอคอน `box` และ `book` ถูกใช้ในแผงอุปกรณ์/บรรทัดที่มา ส่วน `pencil` ใช้แสดงว่าผู้พัฒนาเพิ่มเอง (ตามคอมเมนต์ในไฟล์)

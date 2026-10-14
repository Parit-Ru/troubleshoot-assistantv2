# frontend/src/components/step/ReferenceLine.tsx

## 1. หน้าที่ของไฟล์

บรรทัด "ที่มาของขั้นตอน" ที่อยู่ล่างสุดของกล่องขั้นตอนทุกกล่อง : บรรทัดหลักแสดงชื่อคู่มือที่คนอ่านรู้เรื่อง + เลขหน้า ส่วนรหัสเอกสารยาวๆ ซ่อนไว้ในปุ่ม "ดูรหัสเอกสาร" สำหรับคนที่ต้องการตรวจย้อน ทุกสถานะบอกที่มาได้เสมอ ตามหลักว่าระบบไม่แต่งขั้นตอนเอง

- **ใครเรียกใช้**: `step/StepCard.tsx`
- **เรียกใช้**: `formatSourceLine` (`lib/reference`), `Button`, type `NodeReference`, `useState`

## 2. อธิบายทีละบล็อก

- props : `reference: NodeReference`, `manualLabel?` (13–17)
- `const [isCodeShown, setIsCodeShown] = useState(false)` (21) — state เฉพาะกล่องนี้
- วาด (23–41): `<p>{formatSourceLine(reference, manualLabel)}</p>` ; ปุ่ม `variant="text"` สลับข้อความ "ซ่อนรหัสเอกสาร"/"ดูรหัสเอกสาร" พร้อม `aria-expanded={isCodeShown}` ; ถ้ากาง แสดง `<p className="mt-1 break-all font-mono text-xs">{reference.source}</p>` (`break-all` กันล้นขอบบนมือถือ)

## 3. การส่งข้อมูล

`RenderedNode.reference` (จากเซิร์ฟเวอร์) → `StepCard` → `ReferenceLine` → ข้อความที่แสดง ; state เปิด/ปิดอยู่ในคอมโพเนนต์เอง

## 4. จุดที่ควรระวัง

- ถ้าไม่ส่ง `manualLabel` บรรทัดหลักจะโชว์รหัสเอกสารเต็มทันที (ตาม `formatSourceLine`) ซึ่งซ้ำกับส่วนที่ซ่อน
- ปุ่ม `text` มี `py-3` ทำให้สูงพอแตะบนมือถือ

# frontend/src/components/SessionErrorNotice.tsx

## 1. หน้าที่ของไฟล์

กล่องข้อผิดพลาดของหน้าตรวจอาการ : ข้อความและปุ่มมาจาก `describeError()` ตามชนิด recovery — `retry` → ปุ่ม "ลองอีกครั้ง" ; `reload-session` → "ดึงขั้นตอนล่าสุด" ; `back-to-symptoms` → "เลือกอาการใหม่" (นำทางไป `/symptoms`) ; `stay` → ไม่มีปุ่ม (ผู้ใช้ทำต่อที่กล่องขั้นตอนเดิมได้)

- **ใครเรียกใช้**: `pages/SessionPage.tsx`
- **เรียกใช้**: `useNavigate` (react-router-dom), `describeError`, `Button`, `Notice`

## 2. อธิบายทีละบล็อก

- props : `error: Error`, `onRefresh: () => void` (สิ่งที่เกิดเมื่อกด "ลองอีกครั้ง"/"ดึงขั้นตอนล่าสุด" หน้าตรวจอาการเป็นผู้กำหนด) (15–18)
- `SessionErrorNotice` (20–48): `described = describeError(error)` ; `Notice tone="danger" title={described.title}` ; แสดง `detail` ; ถ้ามี `described.code` (กรณีข้อมูลขั้นตอนไม่สมบูรณ์) แสดง "รหัส: …" ด้วยฟอนต์ mono ; ปุ่มตาม `recovery` ข้างบน

## 3. การส่งข้อมูล

`error` (จาก mutation/query ใน `SessionPage`) → `describeError` → กล่องข้อความ+ปุ่ม ; ปุ่มเรียก `onRefresh` หรือ `navigate('/symptoms')`

## 4. จุดที่ควรระวัง

- ไม่มี `role="alert"` ในไฟล์นี้ (ต่างจาก `OutcomeForm` ที่ห่อด้วย `role="alert"`) ขึ้นกับว่า `SessionPage` ห่อไว้หรือไม่
- กรณี `stay` (เช่น `SAFETY_CONFIRMATION_REQUIRED`) ไม่มีปุ่ม — ผู้ใช้ต้องกลับไปติ๊กยืนยันที่กล่องขั้นตอนเอง

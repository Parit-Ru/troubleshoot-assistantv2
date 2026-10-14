# frontend/src/components/TerminalActions.tsx

## 1. หน้าที่ของไฟล์

ปุ่มสองปุ่มท้ายหน้าจบการตรวจ : "ตรวจอาการอื่น" (ปุ่มหลัก) และ "เริ่มอาการนี้ใหม่" (ปุ่มรอง) กดได้เสมอ ไม่ขึ้นกับว่าผู้ใช้กรอกผลลัพธ์หรือไม่ รับฟังก์ชันทาง props เพราะการไปหน้าอื่นและการเริ่ม session ใหม่เป็นงานของหน้าตรวจอาการ

- **ใครเรียกใช้**: `pages/SessionPage.tsx` (ส่งเข้า `StepView` เป็น `outcomeActions`)
- **เรียกใช้**: `Button`

## 2. อธิบายทีละบล็อก

props (9–13): `onOtherSymptom`, `onRestart`, `isRestarting` ; `TerminalActions` (15–31) คืน Fragment สองปุ่มเต็มความกว้าง : `primary` "ตรวจอาการอื่น" → `onOtherSymptom` ; `secondary` "เริ่มอาการนี้ใหม่" → `onRestart` พร้อม `isLoading={isRestarting}`

## 3. การส่งข้อมูล

คลิก → ฟังก์ชันที่ `SessionPage` ส่งมา (นำทางไป `/symptoms` หรือเรียก `useStartSession` ด้วย `graphId` เดิม)

## 4. จุดที่ควรระวัง

- ไม่มีการยืนยันก่อนเริ่มใหม่ — การเริ่มใหม่จะสร้าง session ใหม่ (session เก่าที่จบแล้วยังค้างในฐานข้อมูลจนหมดอายุ)
- ปุ่มสองปุ่มถูกคืนเป็น Fragment ผู้เรียกจัดช่องว่างผ่าน `space-y-3` ของ `OutcomeStep`

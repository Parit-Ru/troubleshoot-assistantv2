# frontend/src/components/ui/Notice.tsx

## 1. หน้าที่ของไฟล์

กล่องข้อความแจ้งเตือน 2 สี : `info` (ฟ้า ข้อมูลทั่วไป) และ `danger` (แดง คำเตือนความปลอดภัยและข้อผิดพลาด) ประกอบด้วยไอคอน หัวข้อตัวหนา (ไม่บังคับ) และเนื้อความ — **แค่แสดงผล** ไม่มีช่องติ๊กหรือปุ่มยืนยันในตัว (ด่านความปลอดภัยจริงประกอบใน `SafetyGateStep` โดยวางช่องติ๊กไว้นอกกล่องนี้/ใน children ตามที่คอมเมนต์ระบุ)

- **ใครเรียกใช้**: `OutcomeForm`, `SessionErrorNotice`, `SlowServerNotice`, `SymptomSearchResults`, `step/SafetyGateStep`, `HomePage`, `SymptomsPage`
- **เรียกใช้**: `Icon`, type `IconName`, type `ReactNode`

## 2. อธิบายทีละบล็อก

- `NoticeTone = 'info' | 'danger'` (15)
- `TONE_CLASSES` (21–24): `info` = `border-info/40 bg-info/10` + ตัวอักษร `text-info` ; `danger` = `border-danger/40 bg-danger/10` + `text-danger` (`/40`, `/10` คือความทึบ 40%/10% ให้พื้นจางไม่แย่งสายตา) — เขียนชื่อคลาสเต็ม
- `DEFAULT_ICONS` (27–30): `info`→`info`, `danger`→`warning`
- `Notice({ tone, title?, children? })` (40–54): `<div>` flex พร้อมไอคอน (`mt-0.5` ให้ตรงบรรทัดแรก) ; ส่วนข้อความ `min-w-0 flex-1 space-y-1` ; `title` เป็น `<p>` ตัวหนาสีตาม tone ; `children` ใน `<div className="text-ink">`

## 3. การส่งข้อมูล

รับ `tone`, `title`, `children` เป็น props แล้ววาด UI (ไม่มี state / ไม่ส่งออก)

## 4. จุดที่ควรระวัง

- **ไม่มี `role="alert"`/`aria-live`**: ข้อความแจ้งเตือนที่ปรากฏทีหลัง (เช่น error จากเซิร์ฟเวอร์) อาจไม่ถูก screen reader ประกาศเอง ขึ้นกับผู้เรียก (เช่น `SessionErrorNotice`) (อนุมานจากโค้ด)
- ไม่มีปุ่มปิดกล่อง

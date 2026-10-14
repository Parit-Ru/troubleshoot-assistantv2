# frontend/src/components/SymptomSearchForm.tsx

## 1. หน้าที่ของไฟล์

ช่องพิมพ์อาการ + ปุ่ม "ค้นหา" ไม่เรียก API — ผู้เรียกถือข้อความและสั่งค้นหาเอง (ผ่าน `value`/`onChange`/`onSubmit`) ปุ่มกดได้เมื่อมีข้อความจริงเท่านั้น (ไม่ใช่ช่องว่างล้วน) ส่วนการตัดสินว่าข้อความใช้ได้ไหม เซิร์ฟเวอร์ตรวจซ้ำเสมอ

- **ใครเรียกใช้**: `pages/SymptomsPage.tsx`
- **เรียกใช้**: `MAX_QUERY_LENGTH, checkQuery` (`lib/search`), `Button`, `useId`

## 2. อธิบายทีละบล็อก

- props (13–21): `value`, `onChange`, `onSubmit`, `isSearching` (ปุ่มแสดงตัวหมุน), `disabled` (กำลังเริ่ม session จากแถวที่กดไปแล้ว)
- `SymptomSearchForm` (23–70): `inputId = useId()` ผูก `<label htmlFor>` "พิมพ์อาการที่พบ" ; `canSearch = checkQuery(value) === 'ok'` ; `handleSubmit` : `preventDefault()` แล้วเรียก `onSubmit()` เมื่อ `canSearch && !disabled && !isSearching` ; `<input type="text" maxLength={200} placeholder="เช่น แอร์ไม่เย็น มีน้ำหยด รีโมทกดไม่ติด" autoComplete="off" disabled={disabled}>` (ตัดที่ขีดจำกัดเดียวกับเซิร์ฟเวอร์) ; ปุ่ม `type="submit"` `isLoading={isSearching}` `disabled={!canSearch || disabled}`

## 3. การส่งข้อมูล

พิมพ์ → `onChange(value)` (state อยู่ใน `SymptomsPage`) → ส่งฟอร์ม/กด Enter → `onSubmit()` → `useSymptomSearch().mutate(query ที่ trim แล้ว)` → `POST /symptom-search`

## 4. จุดที่ควรระวัง

- ปุ่มส่ง (`disabled`) ปิดได้ แต่การกด Enter ก็ถูกกันซ้ำใน `handleSubmit` ด้วย
- `maxLength` นับหน่วย UTF-16 ตรงกับฝั่งเซิร์ฟเวอร์ ; ค่า 200 ลอกมาด้วยมือจาก backend

# frontend/src/components/SymptomSearchResults.tsx

## 1. หน้าที่ของไฟล์

แสดงผลค้นหาอาการ : ถ้ามีผังผ่านเกณฑ์ แสดงรายการ (สูงสุด 3 ตามที่ backend ส่ง) ด้วย `SymptomRow` ; ถ้าไม่มีเลย แสดงกล่องบอกว่าไม่พบอาการใกล้เคียง ระบบไม่เดาให้ แนะนำพิมพ์ใหม่/เลือกจากรายการ/ติดต่อศูนย์บริการ Samsung
หน้าที่ของการค้นหาคือ "เสนอ" ว่าจะเริ่มผังไหน ผู้ใช้เลือกและยืนยันเอง จึงใช้คำว่า "ใกล้เคียง" ไม่ใช้ "ตรงกับ" และแสดง "คะแนนความคล้าย" ไม่ใช่เปอร์เซ็นต์ (cosine ไม่ใช่ความน่าจะเป็น)

- **ใครเรียกใช้**: `pages/SymptomsPage.tsx`
- **เรียกใช้**: `SymptomRow`, `Notice`, type `SymptomSearchResponse`

## 2. อธิบายทีละบล็อก

- props (14–21): `result: SymptomSearchResponse`, `startingId: string | null`, `isStarting`, `onSelect`
- `matches.length === 0` (29–36) → `<Notice tone="info" title="ไม่พบอาการที่ใกล้เคียงกับที่พิมพ์">` ข้อความ "ระบบไม่เดาอาการให้ …"
- ไม่เช่นนั้น (38–60) → `<section>` หัวข้อ "อาการที่ใกล้เคียงกับที่พิมพ์" + คำอธิบาย "ระบบเสนอให้เลือก ไม่ได้ตัดสินแทน …" + `<ul>` ของ `SymptomRow` (`key=graphId`, ส่ง `score`, `matchedText`, `isStarting={isStarting && startingId === graphId}`, `disabled={isStarting && startingId !== graphId}`)

## 3. การส่งข้อมูล

`SymptomSearchResponse.matches[]` จาก `POST /symptom-search` → แถว → คลิก → `onSelect(graphId)` → เริ่ม session พร้อม `query`

## 4. จุดที่ควรระวัง

- กรณีไม่มีผลถูกเขียนข้อความเฉพาะ "Samsung" ตายตัว (ผูกกับยี่ห้อในข้อมูลปัจจุบัน)
- `bestScore` และ `threshold` ที่ backend ส่งมา ไม่ถูกนำมาแสดงในคอมโพเนนต์นี้

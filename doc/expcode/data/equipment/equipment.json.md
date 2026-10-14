# data/equipment/equipment.json

## 1. หน้าที่ของไฟล์

ข้อมูลต้นทางของ "อุปกรณ์ที่ควรเตรียมก่อนซ่อม" แยกตามประเภทเครื่อง ประกอบด้วยแคตตาล็อกอุปกรณ์ 7 ชิ้น (`equipment`) และตารางการใช้งานต่อประเภทเครื่อง (`usage`) ปัจจุบันมีข้อมูลประเภทเดียวคือ Air Conditioner (7 รายการ)

- **ใครเรียกใช้**: `backend/scripts/seed-equipment.js` (นำเข้า MySQL → ตาราง `equipment`, `equipment_usage`), `frontend/src/mocks/mockServer.ts` (ฝั่ง mock ใช้ไฟล์เดียวกัน ตาม import graph), และ `backend/src/traversal/traversal.service.spec.ts` (อ่านด้วย `fs`)
- **เรียกใช้**: ไม่มี (ข้อมูล)

## 2. อธิบายทีละบล็อก

### บล็อก A — ส่วนหัว (บรรทัด 2–6)
- `schema_version: 1` (ตรงกับที่ `seed-equipment.js` ตรวจ)
- `_readme`: "รายการอุปกรณ์ที่ควรเตรียมก่อนซ่อม แยกตามประเภทเครื่อง"
- **`reviewed_by_author: true`** (ด่านที่ `seed-equipment.js` ใช้ — ถ้าไม่เป็น `true` จะไม่ยอมนำเข้า) พร้อม `_reviewed_by_author_note` ระบุว่าผู้พัฒนาตรวจและรับรองแล้ว (ระบุวันที่ 8 กันยายน 2569) เก็บครบทั้ง 7 รายการตามที่ AI ร่าง รวมถึง `flashlight` และ `step_stool` ซึ่งไม่มีในคู่มือ (อนุมานจากสามัญสำนึกเรื่องความปลอดภัย/การเข้าถึง)

### บล็อก B — `equipment` (บรรทัด 8–16) แคตตาล็อก 7 ชิ้น
แต่ละชิ้นมี `equipment_id` (slug), `name_th`, `name_en`: `usb_c_cable` (สายชาร์จ USB-C), `notepad_or_phone` (กระดาษปากกา หรือมือถือ), `dry_cloth` (ผ้าแห้ง), `soft_brush` (แปรงขนนุ่ม), `drain_brush` (แปรงล้างท่อ), `flashlight` (ไฟฉาย), `step_stool` (บันไดหรือเก้าอี้ที่มั่นคง)

### บล็อก C — `usage` (บรรทัด 18–61)
กลุ่มเดียว `device_category: "Air Conditioner"` มี `items` 7 รายการ แต่ละรายการมี `equipment_id`, `purpose_th`, และ **ที่มาอย่างน้อยหนึ่งอย่าง**:
- อ้างคู่มือ (`source_page` + `_evidence`): `usb_c_cable` (หน้า 43, ชาร์จรีโมท), `notepad_or_phone` (หน้า 44, จดรหัสข้อผิดพลาด)
- ผู้พัฒนาเพิ่มเอง (`author_note`): `soft_brush`, `dry_cloth`, `drain_brush`, `flashlight`, `step_stool`
กฎ "ต้องมี `source_page` หรือ `author_note`" ตรงกับ `CHECK chk_usage_provenance` ในฐานข้อมูล

## 3. การส่งข้อมูล

```
equipment.json ─(seed-equipment.js: validate + reviewed_by_author)─► MySQL equipment + equipment_usage
              └(mockServer.ts, traversal.service.spec.ts อ่านโดยตรง)
MySQL ─(EquipmentRepository.findByCategory)─► SessionResponseDto.equipment[] ─► frontend (EquipmentPanel)
```
ฟิลด์ที่ขึ้นต้นด้วย `_` (`_readme`, `_evidence`, `_reviewed_by_author_note`) เป็นคอมเมนต์ในไฟล์ ไม่ถูกนำเข้า DB

## 4. จุดที่ควรระวัง

- มีเพียงประเภท Air Conditioner; ประเภทอื่น (เช่น Washing Machine) ได้ `equipment: []` และหน้าจอซ่อนแผงอุปกรณ์เอง
- 5 จาก 7 รายการเป็นการเพิ่มของผู้พัฒนา ไม่ได้มาจากคู่มือ — ต้องแสดงให้ผู้ใช้เห็นที่มา (`authorNote`) อย่างซื่อตรง (ตามกฎของโครงงานในข้อความของ `seed-equipment.js`)
- `reviewed_by_author` เป็นค่าที่ผู้พัฒนากรอกเอง สคริปต์ตรวจแค่ค่า `true` ไม่ได้ตรวจเนื้อหา
- การแก้ไฟล์นี้ไม่มีผลกับ backend ที่รันอยู่จนกว่าจะ `npm run seed:equipment` และรีสตาร์ตเซิร์ฟเวอร์ (เพราะ `EquipmentRepository` โหลดตอนบูต)

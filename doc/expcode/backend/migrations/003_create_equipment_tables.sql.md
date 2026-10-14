# backend/migrations/003_create_equipment_tables.sql

## 1. หน้าที่ของไฟล์

มี 2 งานในไฟล์เดียว:
1. ปรับคอลัมน์ `manuals.device_category` จาก `VARCHAR(40)` เป็น `ENUM` ของ 5 ประเภทเครื่อง (บรรทัด 1–4)
2. สร้างตารางอุปกรณ์ที่ควรเตรียมก่อนทำตามขั้นตอน: `equipment` (แคตตาล็อก) และ `equipment_usage` (ความสัมพันธ์อุปกรณ์ ↔ ประเภทเครื่อง) (บรรทัด 5–45)

ไฟล์ไม่มีคอมเมนต์หัวไฟล์บอกชื่อไฟล์ (ต่างจาก 001/002/004/005) และคำสั่ง `ALTER` อยู่บรรทัดแรกก่อนคอมเมนต์ของตาราง `equipment`

- **ใครเรียกใช้**: `scripts/run-migrations.js`
- **ใครใช้ตาราง**: `scripts/seed-equipment.js` (เขียน), `equipment.repository.ts` (อ่านตอนบูต)
- **เรียกใช้**: ตาราง `manuals` จาก migration 001 (ปรับ `device_category`)

## 2. อธิบายทีละบล็อก

### บล็อก A — `ALTER TABLE manuals` (บรรทัด 1–4)
`MODIFY COLUMN device_category ENUM('Air Conditioner','Microwave','Refrigerator','Television','Washing Machine') NOT NULL` — ทำให้ค่าตรงกับ type `DeviceCategory` ใน `traversal-engine/types.ts` (ลำดับในตัว ENUM เรียงตามตัวอักษร ต่างจากลำดับใน type)

### บล็อก B — `equipment` (บรรทัด 5–18) 1 แถวต่ออุปกรณ์ 1 ชิ้น
- `equipment_id` VARCHAR(60) PK (ใช้ slug ที่คนอ่านออก ไม่ใช่ AUTO_INCREMENT)
- `name_th` VARCHAR(100) NOT NULL, `name_en` VARCHAR(100) NOT NULL (เผื่อ UI สองภาษา)
- `created_at`, `updated_at`

### บล็อก C — `equipment_usage` (บรรทัด 20–45) many-to-many พร้อมข้อมูลบนเส้นเชื่อม
- `device_category` ENUM (5 ประเภท) NOT NULL, `equipment_id` VARCHAR(60) NOT NULL
- `purpose_th` TEXT NOT NULL (ใช้ทำอะไรกับเครื่องประเภทนี้)
- `source_page` SMALLINT UNSIGNED NULL (เลขหน้าคู่มือ), `author_note` TEXT NULL (กำกับเมื่อผู้พัฒนาเขียนเอง)
- `display_order` SMALLINT UNSIGNED DEFAULT 0
- PK `(device_category, equipment_id)` — อุปกรณ์เดียวกันใช้ได้หลายประเภท แต่ห้ามซ้ำในประเภทเดียวกัน
- `fk_usage_equipment` → `equipment` ON DELETE CASCADE ON UPDATE CASCADE
- **`CHECK (source_page IS NOT NULL OR author_note IS NOT NULL)`** (`chk_usage_provenance`) บังคับให้ทุกรายการบอกที่มาได้อย่างน้อยหนึ่งอย่าง
- ดัชนี `idx_usage_category (device_category, display_order)`

## 3. การส่งข้อมูล

```
data/equipment/equipment.json ─(seed-equipment.js)─► equipment + equipment_usage ─(equipment.repository.ts)─► Map ตามประเภทเครื่อง ─► SessionResponseDto.equipment
```

## 4. จุดที่ควรระวัง

- `ALTER TABLE manuals … MODIFY` เป็นคำสั่งที่ไม่ idempotent เหมือน `CREATE TABLE IF NOT EXISTS` — พึ่งตัวรัน migration ที่จำไฟล์ที่รันแล้ว ไม่ให้รันซ้ำ (ตามที่ migration 004/005 ระบุ)
- การเปลี่ยนเป็น ENUM จะล้มถ้าข้อมูลเดิมใน `manuals.device_category` มีค่านอกรายการ 5 ค่า
- `CHECK` constraint บังคับจริงเฉพาะ MySQL 8.0.16 ขึ้นไป (เวอร์ชันเก่าอ่านแล้วข้าม) (อนุมานจากพฤติกรรมของ MySQL)
- ENUM มี 5 ประเภท แต่ข้อมูลจริงในโปรเจกต์ตอนนี้มีเพียง 2 ประเภทในไฟล์คู่มือ (Air Conditioner และเครื่องซักผ้า) และข้อมูลอุปกรณ์มีเฉพาะ Air Conditioner (ดู `data/equipment/equipment.json`) — ประเภทที่เหลือเป็นการเผื่อไว้

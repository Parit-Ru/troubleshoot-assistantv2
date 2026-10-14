# backend/src/traversal/equipment.repository.ts

## 1. หน้าที่ของไฟล์

โหลดรายการ "อุปกรณ์ที่ควรเตรียมก่อนทำตามขั้นตอน" จากตาราง `equipment` + `equipment_usage` เข้าหน่วยความจำตอนบูต แล้วแจกให้ service ตามประเภทเครื่อง (`DeviceCategory`) — แนวคิดเดียวกับ `GraphRepository`
อุปกรณ์ผูกกับ "ประเภทเครื่อง" ไม่ได้ผูกกับอาการ ทุกอาการของเครื่องปรับอากาศจึงได้รายการเดียวกัน (คอมเมนต์ 16–17)

- **ใครเรียกใช้**: `traversal.module.ts` (provider), `traversal.service.ts`, `traversal.service.spec.ts`
- **เรียกใช้**: `../database/database.constants`, type `DeviceCategory` จาก `../traversal-engine/types`, type `EquipmentItemDto` จาก `./traversal.dto`, `mysql2/promise`

## 2. อธิบายทีละบล็อก

### บล็อก A — import และคอมเมนต์ (บรรทัด 1–25)
คอมเมนต์ 8–14 ให้เหตุผลเหมือน `GraphRepository`: ข้อมูลอ่านอย่างเดียว เปลี่ยนเฉพาะตอนรัน `npm run seed:equipment` มีแค่หลักสิบรายการ และ **ถ้ารัน seed ขณะเซิร์ฟเวอร์เปิดอยู่ต้องเริ่มเซิร์ฟเวอร์ใหม่**

### บล็อก B — `EquipmentRow` (บรรทัด 27–40)
1 แถว = อุปกรณ์ 1 ชิ้นของประเภทเครื่อง 1 ประเภท มี `device_category`, `equipment_id`, `name_th`, `purpose_th`, `source_page` (NULL ถ้าผู้พัฒนาเพิ่มเอง), `author_note` (NULL ถ้าอ้างคู่มือได้)

### บล็อก C — คลาสและ lifecycle (บรรทัด 42–57)
- field `byCategory: Map<DeviceCategory, EquipmentItemDto[]>` (47)
- constructor รับ pool (49); `onModuleInit` เรียก `loadAll()` (55–57) ถ้า throw แอปไม่บูต

### บล็อก D — `findByCategory(category)` (บรรทัด 63–73)
- **รับ**: `DeviceCategory` — **คืน**: สำเนาของ array (`[...]`) เรียงตาม `display_order`
- ประเภทที่ไม่มีข้อมูลได้ array ว่าง ไม่ใช่ error แล้วหน้าจอจะซ่อนแผงอุปกรณ์เอง (คอมเมนต์ 66–67)
- คืนสำเนาเพื่อไม่ให้ผู้เรียกเผลอแก้ข้อมูลกลาง (คอมเมนต์ 69) — เป็นสำเนาตื้น ตัว item ยังเป็นอ็อบเจ็กต์เดียวกัน

### บล็อก E — `loadAll()` (บรรทัด 79–112)
- query เดียว (83–89): `equipment_usage u JOIN equipment e` เรียง `ORDER BY u.device_category, u.display_order, u.equipment_id` (คอมเมนต์ 80–82: ใช้ `equipment_id` ตัดสินลำดับสุดท้ายให้ลำดับเหมือนเดิมทุกครั้งแม้ `display_order` ซ้ำ)
- วนทุกแถวสร้าง `EquipmentItemDto` (94–102) โดยเปลี่ยน NULL → `undefined` เพื่อให้ field หายไปจาก JSON (คอมเมนต์ 98–99: ตรงกับที่ mockServer ทำ)
- เพิ่มเข้า list ของประเภทนั้น (104–106) แล้ว log จำนวนรายการ/จำนวนประเภท (109–111)

## 3. การส่งข้อมูล

```
MySQL (equipment_usage ⨝ equipment) ──onModuleInit──► byCategory (Map ในหน่วยความจำ)
                                                      │ findByCategory(category)
                                                      ▼
                                              TraversalService → ใส่ใน SessionResponse → JSON → frontend EquipmentPanel
```
ตัวอย่าง item (ค่าจริงจาก `data/equipment/equipment.json`): `{ "equipmentId":"usb_c_cable", "nameTh":"สายชาร์จ USB-C", "purposeTh":"ชาร์จรีโมทที่แบตหมด ช่องชาร์จอยู่ด้านล่างของรีโมท", "sourcePage":43 }` ; รายการที่ผู้พัฒนาเพิ่มเองจะมี `authorNote` แทน `sourcePage`

## 4. จุดที่ควรระวัง

- ข้อมูลในหน่วยความจำไม่รีเฟรชอัตโนมัติหลัง seed ใหม่ (ต้อง restart)
- `findByCategory` คืน item ตัวเดิมที่ใช้ร่วมกัน (สำเนาตื้น) ถ้าผู้เรียกแก้ฟิลด์ใน item จะกระทบทุกคน (อนุมานจากโค้ด)
- ไม่มีการตรวจค่า NULL ของ `name_th` / `purpose_th` ในโค้ด แต่ไม่มีปัญหา เพราะทั้งสองคอลัมน์เป็น NOT NULL ใน `migrations/003_create_equipment_tables.sql`; ตาราง `equipment_usage` ยังมี CHECK ให้มี `source_page` หรือ `author_note` อย่างน้อยหนึ่งอย่าง

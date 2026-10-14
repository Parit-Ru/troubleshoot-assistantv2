# frontend/src/lib/symptoms.ts

## 1. หน้าที่ของไฟล์

จัดรายการอาการสำหรับหน้าเลือกอาการ : เลือกชื่ออาการที่จะแสดง (`symptomName`) และจัดกลุ่มตาม ประเภทเครื่อง + ยี่ห้อ + รุ่น พร้อมเรียงอาการในกลุ่มตามพจนานุกรมไทย (`groupSymptoms`) ศัพท์ในโค้ด: 1 `GraphSummary` = เครื่องสถานะ 1 ชุด = 1 อาการ (ในโค้ดยังเรียกว่า graph)

- **ใครเรียกใช้**: `components/SessionHeader.tsx`, `components/SymptomRow.tsx`, `pages/HomePage.tsx`, `pages/SymptomsPage.tsx`, `symptoms.test.ts`
- **เรียกใช้**: type `DeviceCategory`, `GraphSummary` จาก `../api/types`

## 2. อธิบายทีละบล็อก

- `thaiCollator = new Intl.Collator('th')` (19): สร้างครั้งเดียวนอกฟังก์ชัน (สร้างแต่ละครั้งมีต้นทุน) และใช้แทน `<`/`>` เพราะการเทียบธรรมดาดูแค่รหัสตัวอักษร ส่วน Collator เรียงตามพจนานุกรมไทย (ไม่นับสระหน้า แ เ โ "แอร์" จึงเรียงตาม อ)
- `type SymptomLabel = Pick<GraphSummary, 'entrySymptom' | 'entrySymptomTh'>` (25): แคบกว่า `GraphSummary` เพื่อให้ทั้งรายการอาการและผลค้นหา (`SymptomMatch`) ส่งเข้าได้
- `symptomName(summary)` (28–30): `entrySymptomTh ?? entrySymptom` (ใช้ไทยถ้ามี)
- `interface SymptomGroup { deviceCategory, brand, modelPattern, symptoms[] }` (33–39)
- `groupSymptoms(graphs)` (51–80): วนจัดกลุ่มด้วย `Map` key = `` `${deviceCategory}|${brand}|${modelPattern}` `` (ใช้ `|` คั่นเพราะไม่มีในชื่อ) → ลำดับกลุ่ม = ลำดับที่พบครั้งแรก (Map จำลำดับให้) → แต่ละกลุ่ม `sort` ด้วย `thaiCollator.compare(symptomName(a), symptomName(b))` → คืน `Array.from(groups.values())`
  - ใช้ทั้งสามค่าเป็นคีย์ เพราะอนาคตประเภทเดียวอาจมีหลายรุ่น (หัวกลุ่มจะได้ไม่แสดงรุ่นผิด)
  - ไม่แก้ array `graphs` ที่รับเข้า (push ลง array ใหม่ของกลุ่ม)

## 3. การส่งข้อมูล

`GET /traversal/graphs` → `GraphSummary[]` → `groupSymptoms` → `SymptomGroup[]` → หน้าเลือกอาการแสดงทีละกลุ่ม

## 4. จุดที่ควรระวัง

- ลำดับกลุ่มขึ้นกับลำดับที่ backend ส่งมา (ซึ่งเรียงตาม `graph_id` ตอนโหลด) ไม่ได้กำหนดลำดับกลุ่มเอง (เทสจึงหากลุ่มด้วย `find`)
- ผลการเรียงขึ้นกับ ICU/locale `th` ของเบราว์เซอร์/Node ถ้า runtime ไม่มีข้อมูล locale ไทย ลำดับอาจต่างออกไป (อนุมานจากพฤติกรรมของ `Intl.Collator`)
- `Array.sort` ใน JavaScript (ES2019+) เสถียร จึงกลุ่มที่ชื่อเท่ากันคงลำดับเดิม

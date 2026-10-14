# data/chunks/manual_Samsung_WashingMachine_OID84209.json

## 1. หน้าที่ของไฟล์

ข้อมูลต้นทางแบบ "ข้อความแบน" (flat chunks) ของหัวข้อแก้ปัญหาในคู่มือเครื่องซักผ้า Samsung รุ่น `OID84209` (ไฟล์คู่มือ `OID84209_IB_WW3000FM-MD_EN_TH_250612.pdf` หน้า 45–50) รวม 29 chunk (`c1`–`c29`) ต่ออาการ/รหัสข้อผิดพลาด 1 รายการ ใช้เป็นวัตถุดิบสร้างกราฟ (ผลคือ `data/manuals/washing_machine_clf.json` ซึ่งไฟล์นั้นระบุว่าสร้างด้วย `convert_with_classifier.py` ที่ไม่อยู่ใน repo ส่วน `convert_chunks_to_graphs.py` ในโฟลเดอร์ `scripts/` สร้างโครงโหนดแบบเดียวกัน) และให้ `verify_chunks.py` ตรวจความตรงกับ PDF

- **ใครเรียกใช้**: `scripts/convert_chunks_to_graphs.py` (รับไฟล์ chunk แบบนี้เป็น input), `scripts/verify_chunks.py` ; กราฟใน `washing_machine_clf.json` อ้าง `source_chunk_id`
- **เรียกใช้**: ไม่มี (ข้อมูล)

## 2. อธิบายทีละบล็อก

### โครงของ chunk 1 รายการ
ฟิลด์เหมือนไฟล์ chunk แอร์ แต่มีเพิ่ม `embedding: null` และ `created_at: null` (ทุกรายการ) และ `source` ลงท้าย `.pdf`:
`chunk_id` (เช่น `manual_Samsung_WashingMachine_OID84209_p45_c1`), `device_category: "Washing Machine"`, `brand: "Samsung"`, `model: "OID84209"`, `source`, `page`, `content`, `metadata{symptom, possible_cause, solution (มีเลขขั้น), severity, safety_warning, difficulty}`

### กลุ่มของ chunk (บรรทัด 2–552)
- **อาการทั่วไป (c1–c17, หน้า 45–48)**: ไม่เริ่มทำงาน (c1), น้ำเข้าไม่พอ (c2), ผงซักฟอกค้างถาด (c3), สั่นสะเทือน/เสียงดัง (c4), ไม่ระบายน้ำ/ไม่ปั่น (c5), ปั่นไม่ทำงาน (c6), เปิดประตูไม่ได้ (c7), ฟองมากเกินไป (c8), เติมผงซักฟอกเพิ่มไม่ได้ (c9), หยุดกลางคัน (c10), น้ำอุณหภูมิผิด (c11), ผ้าเปียกท้ายรอบ (c12), น้ำรั่ว (c13), มีกลิ่น (c14), ไม่เห็นฟอง (รุ่น Bubble เท่านั้น) (c15), เวลาซักนานขึ้น (c16), คราบบนเสื้อผ้า (c17)
- **รหัสข้อมูล (information code) (c18–c29, หน้า 48 และ 50)**: 4C (น้ำไม่เข้า), 5C (น้ำไม่ระบาย), dC (เปิดประตูขณะทำงาน), dC1 (ล็อกประตูไม่ได้), OC (น้ำล้น), LC (ตรวจสายระบาย), 3C (ตรวจมอเตอร์), TC1 (เซ็นเซอร์ความร้อนน้ำ), HC (ตรวจความร้อนสูง), 1C (เซ็นเซอร์ระดับน้ำ), AC (สื่อสารระหว่าง PBA), AC6 (สื่อสารอินเวอร์เตอร์)
- ระดับ `severity`: high 7 รายการ (OC, 3C, TC1, HC, 1C, AC, AC6)

## 3. การส่งข้อมูล

```
คู่มือ PDF ► chunks (ไฟล์นี้) ──(convert_with_classifier.py ตามที่ระบุในไฟล์ผลลัพธ์; ไม่อยู่ใน repo)──► data/manuals/washing_machine_clf.json (29 กราฟ ร่าง)
                          ├──convert_chunks_to_graphs.py──► กราฟรูปแบบเดียวกัน (ร่าง)
                          └──verify_chunks.py (+PDF)──► รายงานตรวจ
```

## 4. จุดที่ควรระวัง

- **`safety_warning` ไม่เป็น null ใน 6 chunk**: c1, c5, c10, c11, c25, c26 — ในจำนวนนี้ c25 ("Water heating temperature sensor needs to be checked.") และ c26 ("High temperature heating check.") ข้อความเป็นการกล่าวซ้ำอาการมากกว่าจะเป็นคำเตือนความปลอดภัยจริง และสคริปต์แปลงจะจับคู่คำเตือนกับขั้นตอนด้วยการนับคำซ้อนทับ (ต้องตรวจโดยผู้พัฒนา)
- รูปแบบฟิลด์ต่างจากไฟล์ chunk แอร์เล็กน้อย (`embedding`, `created_at`, ชื่อ `source` มี `.pdf`) — ถ้าสคริปต์ต้องประมวลผลสองไฟล์ร่วมกันต้องระวังความต่างนี้ (อนุมานจากการเปรียบเทียบ)
- คำอธิบายในคู่มือฉบับนี้บางจุดอ้างหน่วย °F (เช่น 120 °F / 49 °C) ซึ่งตัวเลขจะถูกตรวจโดยตัวตรวจตัวเลขใน `verify_chunks.py`
- เป็นข้อมูลภาษาอังกฤษ ฟิลด์ภาษาไทยของกราฟต้องถูกเติมในขั้นถัดไป

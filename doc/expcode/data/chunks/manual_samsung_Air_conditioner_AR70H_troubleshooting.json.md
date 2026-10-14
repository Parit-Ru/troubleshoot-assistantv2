# data/chunks/manual_samsung_Air_conditioner_AR70H_troubleshooting.json

## 1. หน้าที่ของไฟล์

ข้อมูลต้นทางแบบ "ข้อความแบน" (flat chunks) ของหัวข้อแก้ปัญหาในคู่มือแอร์ Samsung AR70H**D1*** (หน้า 43–44 ของคู่มือ `RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04`) มี 13 chunk ต่อ 1 อาการ เนื้อหาเป็นภาษาอังกฤษตามคู่มือ ใช้เป็นวัตถุดิบสำหรับสร้างกราฟ (`convert_chunks_to_graphs.py`) และสำหรับตรวจความตรงของข้อความกับคู่มือ (`verify_chunks.py`)

- **ใครเรียกใช้**: `scripts/convert_chunks_to_graphs.py` (แปลงเป็นกราฟ), `scripts/verify_chunks.py` (ตรวจกับ PDF) ; กราฟใน `data/manuals/samsung_ac_ar70h.json` อ้าง `source_chunk_id` ของ chunk เหล่านี้
- **เรียกใช้**: ไม่มี (ข้อมูล)

## 2. อธิบายทีละบล็อก

### โครงของ chunk 1 รายการ (ทุกรายการเหมือนกัน)
| ฟิลด์ | ความหมาย |
|---|---|
| `chunk_id` | รหัส เช่น `manual_Samsung_AirConditioner_AR70HD1_p43_stops_working` |
| `device_category`, `brand`, `model`, `source` | ประเภท/ยี่ห้อ/รุ่น (`AR70H**D1***`)/ชื่อไฟล์คู่มือ |
| `page` | เลขหน้าที่พิมพ์ในคู่มือ (43 หรือ 44) |
| `content` | ข้อความรวม: อาการ + สาเหตุ + วิธีแก้ (ใช้ฝัง embedding แบบเดิม) |
| `metadata.symptom` | ชื่ออาการ |
| `metadata.possible_cause` | สาเหตุที่เป็นไปได้ |
| `metadata.solution` | วิธีแก้ — ถ้ามีหลายขั้นตอนจะมีเลข "1. … \n2. …" |
| `metadata.severity`, `difficulty` | ระดับความรุนแรง/ความยาก |
| `metadata.safety_warning` | **ทุกรายการเป็น `null`** |

### รายการ 13 chunk (บรรทัด 2–222)
หน้า 43 (8 รายการ): `stops_working`, `cannot_change_temperature`, `improper_airflow_temperature` (5 ขั้นตอน), `cannot_change_airflow_direction`, `cannot_change_fan_speed`, `remote_not_working` (3 ขั้นตอน), `timer_not_working`, `indicator_blinking` (severity medium)
หน้า 44 (5 รายการ): `odors_from_unit`, `error_message` (medium/hard), `unit_generating_noise`, `water_drips_outdoor` ("This is normal."), `condensation_indoor` ("This is a normal occurrence …")

## 3. การส่งข้อมูล

```
คู่มือ PDF ──(สกัดด้วยมือ/เครื่องมือ)──► chunks.json ──convert_chunks_to_graphs.py──► กราฟ (ร่าง) ──ตรวจ/แก้โดยผู้พัฒนา──► data/manuals/samsung_ac_ar70h.json
chunks.json + PDF ──verify_chunks.py──► รายงานความตรง
```

## 4. จุดที่ควรระวัง

- **`safety_warning` เป็น `null` ทุกรายการ** แต่กราฟแอร์ใน `data/manuals/samsung_ac_ar70h.json` มีโหนดด่านความปลอดภัย 3 โหนด (ใน `indicator_blinking` 2 และ `stops_working` 1 ตาม `data/index.json`) แสดงว่าด่านเหล่านั้นถูกเพิ่มโดยผู้พัฒนาในขั้นสร้างกราฟ ไม่ได้มาจากฟิลด์นี้ (อนุมานจากการเปรียบเทียบไฟล์)
- `severity`/`difficulty` ที่นี่ถูกถ่ายไปยังกราฟ และ `verify_chunks.py` ตรวจให้ตรงกัน
- ข้อความเป็นภาษาอังกฤษ ส่วนข้อความไทยเกิดจากการแปล/เรียบเรียงในขั้นสร้างกราฟ
- คำว่า "contact your service provider" ในข้อความ ทำให้ `convert_chunks_to_graphs.py` อาจจัดเป็นกรณี "ส่งต่อช่างทันที" เฉพาะเมื่อมีขั้นตอนเดียวและตรง regex (ดูสรุปของสคริปต์นั้น)

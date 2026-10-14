# data/manuals/samsung_ac_ar70h.json

## 1. หน้าที่ของไฟล์

ไฟล์ "ข้อมูลหลัก" ของระบบ: คู่มือแก้ปัญหาแอร์ Samsung AR70H**D1*** ในรูปกราฟตาม schema v2 มี 13 กราฟ (1 กราฟต่ออาการ) รวม 95 โหนด ผู้พัฒนาตรวจแก้แล้ว (ผ่าน `validate_graph.py` 13/13) เป็นข้อมูลที่ถูกนำเข้า MySQL ด้วย `seed-graphs.js` และถูกใช้เป็นข้อมูลทดสอบ/อ้างอิงในหลายที่

- **ใครเรียกใช้**: `backend/scripts/seed-graphs.js` (ค่าเริ่มต้น), `validate-eval-queries.js`, `eval-symptom-search.js`, `measure-embedding.mjs`, `scripts/validate_graph.py`, `simulate_paths.py`, `build_index.py`, `inspect_vocab.py`, `slim_model.py`; เทส Jest (`path-coverage.spec.ts`, `traversal-engine.confidence.spec.ts`, `symptom-matcher.spec.ts`, `symptom-search.service.spec.ts`, `traversal.service.spec.ts`); และ `frontend/src/mocks/mockServer.ts`
- **เรียกใช้**: ไม่มี (ข้อมูล) ; กราฟอ้าง `source_chunk_id` ของ `data/chunks/manual_samsung_Air_conditioner_AR70H_troubleshooting.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — ส่วนหัวคู่มือ (บรรทัด 2–8)
ตรงกับ type `ManualFile`: `schema_version: 2`, `manual_id: samsung_ac_ar70h`, `device_category`, `brand`, `model_pattern: AR70H**D1***`, `source_manual`, `count: 13`, `graphs[]`

### บล็อก B — โครงของกราฟ 1 อัน
`schema_version`, `graph_id`, `device_category`, `brand`, `model_pattern`, `entry_symptom` (อังกฤษ), `entry_symptom_th`, `entry_symptom_aliases?`, `source`, `page_range`, `source_chunk_id`, `severity`, `difficulty`, `config?`, `entry_node`, `nodes[]` (ลำดับในอาร์เรย์ไม่ใช่ลำดับการเดิน)

### บล็อก C — 13 กราฟ (ย่อ)
| graph_id (ตัด `samsung_ac_ar70h_`) | บรรทัด | จุดเด่น |
|---|---|---|
| cannot_change_airflow_direction | 10–64 | ถาม Good Sleep → อธิบาย → ตรวจซ้ำ ; ผลสำเร็จเป็น `normal_behavior` |
| cannot_change_fan_speed | 65–134 | ตรวจ AI Auto/Dry แล้ว Good Sleep ; `normal_behavior` |
| cannot_change_temperature | 135–189 | ตรวจโหมด Fan ; `normal_behavior` |
| condensation_indoor | 190–243 | แยกหยดน้ำเกาะผิว (ปกติ) ออกจากน้ำไหลเป็นทาง (`n_escalate_leak`, `handoff_informed`) |
| error_message | 244–301 | **มีโหนด `input`** `n_record_code` (pattern `^[A-Za-z]{1,2}[0-9]{1,3}$`, `store_as: error_code`, `on_invalid: n_invalid_code` ที่วนกลับ) ; `n_escalate_with_code` ใช้ `{{error_code}}` สองครั้ง |
| improper_airflow_temperature | 302–493 | 16 โหนด ลูปตรวจต่อเนื่อง (อุณหภูมิ→ประตู→ฟิลเตอร์→เครื่องนอก→ท่อ) ; มี `entry_symptom_aliases` 3 คำ และ `config`: `max_pipe_length` (แบบ `by_model_variant` 6 รุ่น: 07/09/12/15 = 20 ม., 18/24 = 30 ม.) กับ `min_pipe_length` = 3 ม. อ้างจากคู่มือติดตั้ง (`other_official_document`) |
| indicator_blinking | 494–565 | **2 โหนด safety_critical** (`n_power_off`, `n_power_back_on`) พร้อม `safety_warning` ที่ผู้พัฒนาเพิ่มเอง (ระบุใน `author_note`) |
| odors_from_unit | 566–667 | `entry_node = n0` (เริ่มที่ instruction) ; `config.fan_mode_ventilation_hours` = `"3-4"` (สตริง, หน่วยชั่วโมง, หน้า 44) |
| remote_not_working | 668–772 | 11 โหนด ชาร์จ USB-C → สิ่งกีดขวาง (≤ 7 ม.) → แสงจ้า |
| stops_working | 773–872 | **1 โหนด safety_critical** `n_fix_breaker` (สับเบรกเกอร์ ห้ามสับซ้ำถ้าตัดทันที) ; กราฟที่ใช้ในเทส/สาธิตความปลอดภัย |
| timer_not_working | 873–927 | ตรวจว่ากดยืนยันหลังตั้งเวลาไหม |
| unit_generating_noise | 928–1015 | `entry_node = n0` ; `config.min_pipe_length_no_coil` = 3 ม. ; `n_explain_piping` มี `external_reference` (คู่มือติดตั้ง หัวข้อ Typical installation, `in_knowledge_base: false`) |
| water_drips_outdoor | 1016–1055 | 3 โหนด (กราฟสั้นสุด) ใช่ → `n_normal` (ปกติ) |

### บล็อก D — ฟิลด์ของโหนดที่พบ
checkpoint (`question`, `on_yes`, `on_no`), instruction (`content`, `next`, `safety_critical`, `safety_warning?`), input (`prompt`, `input_type`, `pattern`, `store_as`, `next`, `on_invalid`), resolution/escalation (`content`, `outcome_kind` ∈ `user_fixed`, `normal_behavior`, `handoff_informed`, `handoff_unknown`) ; บางโหนดมี `author_note`/`external_reference`

## 3. การส่งข้อมูล

```
data/chunks/…AR70H_troubleshooting.json ─► (สร้าง/เรียบเรียงโดยผู้พัฒนา) ─► samsung_ac_ar70h.json
  ├─ seed-graphs.js ─► MySQL (manuals/graphs/nodes) ─► GraphRepository ─► traversal-engine
  ├─ buildSymptomTexts ─► ข้อความตัวแทน 36 ข้อความ = 13 (ไทย) + 13 (อังกฤษ) + 10 (คำพ้อง) ─► ดัชนีค้นหา
  └─ mockServer.ts / Jest อ่านตรงจากไฟล์
```

## 4. จุดที่ควรระวัง

- **ตัวเลขที่ถูกล็อกไว้ในเทส**: 13 กราฟ, 95 โหนด, 106 เส้นทาง, 36 ข้อความตัวแทน, และโหนดความปลอดภัย 3 โหนด — แก้ไฟล์นี้ต้องแก้ค่าในเทสและเอกสารตาม
- **`entry_node` ไม่ใช่ `n1` เสมอไป**: `odors_from_unit` และ `unit_generating_noise` เริ่มที่ `n0`
- **comment ไม่ตรงกับคีย์**: `author_note` ของ `n2` ใน `unit_generating_noise` อ้างคีย์ `config.min_pipe_length_no_coil_m` แต่คีย์จริงชื่อ `min_pipe_length_no_coil` (ไม่มีผลต่อการทำงาน เพราะ engine ไม่อ่าน `config`) (ตรวจจากข้อมูล)
- **ตัวเลข/ข้อความใน `question` ฝังค่าจาก `config` ตรงๆ** (เช่น ระยะท่อ 20/30 เมตรใน `n_pipe`) engine ไม่ดึงค่าจาก `config` ให้อัตโนมัติ (ตามคอมเมนต์ใน `types.ts`) จึงต้องแก้สองที่เมื่อค่าเปลี่ยน
- คำเตือนความปลอดภัยทั้ง 3 จุดเป็นข้อความที่ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือ (ฟิลด์ `safety_warning` ในไฟล์ chunk เป็น `null` ทั้งหมด)

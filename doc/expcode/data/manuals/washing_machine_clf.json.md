# data/manuals/washing_machine_clf.json

## 1. หน้าที่ของไฟล์

กราฟแก้ปัญหา "ร่าง" ของเครื่องซักผ้า Samsung รุ่น `OID84209` (29 กราฟ, 300 โหนด, 3,802 บรรทัด) ที่สร้างอัตโนมัติจากไฟล์ chunk (`data/chunks/manual_Samsung_WashingMachine_OID84209.json`) ด้วยสคริปต์ที่ระบุในไฟล์ว่า `convert_with_classifier.py` โดยใช้ตัวจำแนกชนิดขั้นตอนจากโมเดล `paraphrase-multilingual-MiniLM-L12-v2` ตัวไฟล์ติดป้าย `review_status: "pending_manual_review"` ทั้งระดับคู่มือและทุกกราฟ — ยังรอผู้พัฒนาตรวจแก้ ไม่ใช่ข้อมูลที่ผ่านการรับรองแล้ว
ชื่อ `_clf` น่าจะย่อจาก classifier (อนุมานจากชื่อสคริปต์ที่ระบุในไฟล์)

- **ใครเรียกใช้**: `scripts/validate_graph.py --all`, `scripts/simulate_paths.py --all`, `scripts/build_index.py` (อ่านทุกไฟล์ใน `data/manuals/`) ; `backend/scripts/seed-graphs.js` จะนำเข้าได้ถ้าระบุ path ไฟล์นี้เป็น argument ; ไม่พบโค้ดอื่นที่อ้างถึงไฟล์นี้ (เช่น `mockServer.ts` ใช้เฉพาะไฟล์แอร์)
- **เรียกใช้**: ไม่มี (ข้อมูล) ; กราฟอ้าง `source_chunk_id` `…_p45_c1` ถึง `…_p50_c29`
- **สคริปต์ที่สร้างไฟล์นี้ไม่อยู่ใน repo**: ไม่พบ `convert_with_classifier.py` ในรายการไฟล์ที่ git ติดตามและในโฟลเดอร์โปรเจกต์

## 2. อธิบายทีละบล็อก

### บล็อก A — ส่วนหัวคู่มือ (บรรทัด 2–13)
ฟิลด์ตาม `ManualFile` (`schema_version 2`, `manual_id: samsung_oid84209`, `device_category: Washing Machine`, `brand`, `model_pattern: OID84209`, `source_manual: OID84209_IB_WW3000FM-MD_EN_TH_250612.pdf`, `count: 29`) บวกฟิลด์เพิ่มของตัวสร้าง: `generated_by`, `classifier_model`, `classifier_cv_accuracy: 0.8199` (ความแม่นยำ cross-validation ราว 82.0%), `confidence_threshold: 0.6` (ต่ำกว่านี้ถือว่า "ไม่ยอมรับ" ผลจำแนก), `review_status`

### บล็อก B — โครงของกราฟ 1 อัน (ตัวอย่าง บรรทัด 15–215)
ฟิลด์มาตรฐานของกราฟ + ฟิลด์เพิ่ม: `possible_cause`, `generated_by`, `review_status`, `conversion_notes[]`, `classification_log[]` (ต่อขั้นตอนของคู่มือ: `text`, `predicted_type`, `confidence`, `accepted`, `final_type`, `graph_symptom`)
- `entry_symptom_th` เป็น `""` ทั้ง 29 กราฟ (ยังไม่มีคำแปลไทย)
- รูปแบบโหนดทุกกราฟเหมือนกัน (ตรงกับตรรกะของ `convert_chunks_to_graphs.py`): `n1` (checkpoint ยืนยันอาการ: ถ้าไม่ใช่ → `n_escalate_mismatch`) → ต่อด้วยคู่ `s{i}` (instruction) ↔ `c{i}` (checkpoint "แก้ไขแล้วหรือไม่?") → `n_resolved` (`user_fixed`) / `n_escalate` (`handoff_unknown`) / `n_escalate_mismatch`

### บล็อก C — 29 กราฟ (graph_id ทั้งหมดขึ้นต้น `oid84209_`)
| กลุ่ม | กราฟ |
|---|---|
| อาการทั่วไป (หน้า 45–48) | start, water_supply_insufficient_no_water_supplied, after_cycle_detergent_remains_detergent_drawer, excessive_vibrations_makes_noise, drain_spin, spinning_work, door_open, excessive_suds, cannot_apply_additional_detergent, stops, fills_wrong_water_temperature, load_wet_end_cycle, leaks_water, has_odours, no_bubbles_seen_bubble_models_only, increased_time_washing, stains_clothes |
| รหัส information code (หน้า 48, 50) | information_code_4c_water_supplied, _5c_water_draining, _dc_operating_washing_machine, _dc1_door_cannot_locked, _oc_water_overflowed, _lc_check_drain_hose, _3c_check_motor_operation, _tc1_water_heating_temperature, _hc_high_temperature_heating, _1c_water_level_sensor, _ac_check_communications_between, _ac6_inverter_communication_check |

### บล็อก D — ตัวเลขที่นับได้จากไฟล์
- **โหนดความปลอดภัย (`safety_critical: true`) 3 โหนด**: `oid84209_start` ขั้น `s6` (ตรวจฟิวส์/รีเซ็ตเบรกเกอร์), `oid84209_stops` ขั้น `s1` (เสียบปลั๊ก/ฟิวส์/ประตู), `oid84209_fills_wrong_water_temperature` ขั้น `s4` (ตั้งเครื่องทำน้ำร้อน ≥ 120 °F) — จับคู่โดยสคริปต์ มี `author_note` ว่าผู้พัฒนาต้องตรวจซ้ำ
- `classification_log` รวม 94 แถว ไม่ยอมรับ (`accepted: false`) 26 แถว ; `final_type`: instruction 85, checkpoint 7, escalation 2
- กราฟที่มี `conversion_notes` ("โมเดลจำแนกขั้นตอน 1 รายการว่าไม่ใช่ instruction …") 9 กราฟ
- กราฟพิเศษ 2 กราฟที่ `n_escalate` ใช้ข้อความ "ติดต่อศูนย์บริการ" จากคู่มือตรงๆ (ภาษาอังกฤษ, `handoff_informed`, มี `author_note`): `stains_clothes`, `information_code_oc_water_overflowed`

## 3. การส่งข้อมูล

```
data/chunks/manual_Samsung_WashingMachine_OID84209.json
   ──(convert_with_classifier.py — ไม่มีใน repo)──► data/manuals/washing_machine_clf.json (ร่าง)
   ──► validate_graph.py (ล้ม 29/29 ด้าน schema) · simulate_paths.py · build_index.py(ยังไม่ได้รวมใน data/index.json)
   ──(ถ้าตรวจแก้แล้ว) seed-graphs.js ► MySQL ► GraphRepository
```

## 4. จุดที่ควรระวัง

- **ยังไม่ผ่าน schema v2**: `validate_graph.py` รายงาน [SCHEMA] ผิดทั้ง 29 กราฟ — รหัสโหนด `s1`/`c1` ไม่ตรง pattern `^n[a-z0-9_]+$` และมี property ที่ schema ไม่อนุญาต (`classification_log`, `conversion_notes`, `generated_by`, `possible_cause`, `review_status`) แต่ตัวตรวจฝั่ง `seed-graphs.js` ตรวจเฉพาะโครงสร้าง (entry_node, เส้นเชื่อม, safety) ซึ่งไฟล์นี้ผ่านได้ จึงมีความเสี่ยงที่จะถูก seed เข้าฐานข้อมูลได้ทั้งที่ยังเป็นร่าง (อนุมานจากโค้ดของสองตัวตรวจ)
- **ผล "final_type" ใน `classification_log` ไม่สะท้อนในโหนดจริง**: ขั้นตอนที่ถูกจำแนกเป็น `checkpoint` (7 แถว เช่น "Make sure the door is properly closed.") ถูกสร้างเป็นโหนด `instruction` ทั้งหมด (ตรวจ 7 กรณีแล้ว) ตัวจำแนกจึงมีผลแค่กำหนดกราฟพิเศษ/ข้อความแจ้งเตือน ไม่ได้เปลี่ยนชนิดโหนด
- **ขั้น "ติดต่อศูนย์บริการ" ถูกทำเป็น instruction ธรรมดา** ในหลายกราฟ (เช่น 5C, dC1, LC, 3C, TC1, HC, 1C, AC, AC6: "If the information code remains, contact a customer service centre.") แล้วตามด้วยคำถาม "ปัญหาแก้ไขแล้วหรือไม่?" ซึ่งอ่านแล้วไม่สมเหตุสมผลทางประสบการณ์ผู้ใช้ — เป็นเรื่องที่ผู้พัฒนาต้องตรวจ
- **คำเตือนความปลอดภัยจากคู่มือไม่ครบ**: chunk ที่มี `safety_warning` 6 รายการ แต่กราฟมีโหนด safety เพียง 3 โหนด (กราฟ `drain_spin`, `tc1`, `hc` ไม่มี) เพราะการจับคู่ใช้คำซ้อนทับ ≥ 2 คำ
- **ข้อความทั้งหมดในโหนดขั้นตอนเป็นภาษาอังกฤษ** มีภาษาไทยเฉพาะโหนดที่สคริปต์เติม (คำถามยืนยัน/ผลลัพธ์) และ `entry_symptom_th` ว่าง ทำให้คำค้นภาษาไทยจับคู่กับกราฟกลุ่มนี้ได้ยากถ้านำเข้าระบบค้นหา (อนุมานจากโค้ด `symptom-matcher.ts` ที่ใช้เฉพาะข้อความที่มี)
- `data/index.json` ยังไม่รวมคู่มือนี้

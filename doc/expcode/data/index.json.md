# data/index.json

## 1. หน้าที่ของไฟล์

ดัชนีสรุปของกราฟแก้ปัญหาทั้งหมด สร้างอัตโนมัติด้วย `scripts/build_index.py` (ข้อมูลชุดเดียวกับที่แสดงเป็นตารางใน `data/INDEX.md`) มี 3 ส่วน: `manuals` (รายการคู่มือ), `count` (จำนวนกราฟ) และ `graphs` (สรุปรายกราฟ) ปัจจุบันบรรจุ 1 คู่มือ: Samsung แอร์ AR70H (`samsung_ac_ar70h`) 13 กราฟ

- **ใครสร้าง**: `scripts/build_index.py` (เขียนทับไฟล์นี้ทุกครั้งที่รัน)
- **ใครอ่าน**: ไม่พบโค้ดในโปรเจกต์ที่ import ไฟล์นี้ (ตาม import graph) — เป็นข้อมูลอ้างอิงให้คน/เครื่องมืออ่าน
- **เรียกใช้**: ไม่มี (ข้อมูล)

## 2. อธิบายทีละบล็อก

### บล็อก A — `manuals` (บรรทัด 2–11)
หนึ่งรายการ: `manual_id: samsung_ac_ar70h`, `brand: Samsung`, `device_category: Air Conditioner`, `model_pattern: AR70H**D1***`, `source_manual: RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04`, `graph_count: 13`

### บล็อก B — `count` (บรรทัด 12)
13

### บล็อก C — `graphs[]` (บรรทัด 13–344)
แต่ละกราฟมี: `manual_id`, `graph_id`, `entry_symptom`, `entry_symptom_th`, `device_category`, `brand`, `model_pattern`, `source`, `page_range`, `severity`, `difficulty`, `node_count`, `node_types` (จำนวนต่อชนิดโหนด), `safety_nodes`, `config_keys`

| graph_id (ตัดคำนำหน้า `samsung_ac_ar70h_`) | โหนด | หน้า | safety | หมายเหตุ |
|---|---:|---|---:|---|
| cannot_change_airflow_direction | 5 | 43 | 0 | |
| cannot_change_fan_speed | 7 | 43 | 0 | |
| cannot_change_temperature | 5 | 43 | 0 | |
| condensation_indoor | 5 | 44 | 0 | |
| error_message | 5 | 44 | 0 | มีโหนด `input` 1 (severity medium, difficulty hard) |
| improper_airflow_temperature | 16 | 43 | 0 | `config_keys`: max_pipe_length, min_pipe_length |
| indicator_blinking | 7 | 43 | 2 | |
| odors_from_unit | 9 | 44 | 0 | `config_keys`: fan_mode_ventilation_hours |
| remote_not_working | 11 | 43 | 0 | |
| stops_working | 10 | 43 | 1 | |
| timer_not_working | 5 | 43 | 0 | |
| unit_generating_noise | 7 | 44 | 0 | `config_keys`: min_pipe_length_no_coil |
| water_drips_outdoor | 3 | 44 | 0 | |
รวม 95 โหนด และโหนดที่มีด่านความปลอดภัย 3 โหนด (ตรงกับ `EXPECTED_NODE_COUNT = 95` ใน `path-coverage.spec.ts`)

## 3. การส่งข้อมูล

```
data/manuals/*.json ─(scripts/build_index.py)─► data/index.json (+ data/INDEX.md)
```

## 4. จุดที่ควรระวัง

- **ดัชนีไม่ทันสมัย**: `data/manuals/` มีไฟล์ `washing_machine_clf.json` (เครื่องซักผ้า 29 กราฟ) อยู่ด้วย แต่ไฟล์นี้ระบุแค่ 1 คู่มือ / 13 กราฟ — แสดงว่า `build_index.py` ไม่ได้ถูกรันใหม่หลังเพิ่มคู่มือเครื่องซักผ้า (อนุมานจากการเปรียบเทียบ)
- เนื่องจากเป็นไฟล์ที่สร้างอัตโนมัติ ห้ามแก้ด้วยมือ (จะถูกเขียนทับ)
- ตัวเลขชุดนี้ (13 กราฟ / 95 โหนด / safety 3) ตรงกับค่าที่ Jest ล็อกไว้ใน `path-coverage.spec.ts` และกับจำนวนข้อความตัวแทน 36 ข้อความที่ `symptom-matcher.spec.ts` คาดไว้

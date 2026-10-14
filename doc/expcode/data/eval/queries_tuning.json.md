# data/eval/queries_tuning.json

## 1. หน้าที่ของไฟล์

"ชุดตั้งเกณฑ์" (tuning set) สำหรับวัดและเลือกเกณฑ์ความคล้าย (`MATCH_THRESHOLD`) ของระบบค้นหาอาการ มีคำค้นตัวอย่าง 56 ข้อ แบ่งเป็นในขอบเขต 39 ข้อ (ผังแอร์ทั้ง 13 ผัง ผังละ 3 ข้อ) และนอกขอบเขต 17 ข้อ ฟิลด์ `author` ระบุตรงๆ ว่า **ร่างโดย Claude (ผู้ช่วย AI) รอผู้พัฒนาตรวจแก้ — ยังไม่ใช่ชุดที่ผู้พัฒนาเขียนเอง** และ `status: "draft"`

- **ใครเรียกใช้**: `backend/scripts/validate-eval-queries.js` (ตรวจ), `backend/scripts/eval-symptom-search.js` (โหมดเริ่มต้น `--set tuning` กวาดเกณฑ์)
- **เรียกใช้**: ไม่มี (ข้อมูล) ; ฟิลด์ `expected_graph_id` อ้าง `graph_id` ใน `data/manuals/samsung_ac_ar70h.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — ส่วนหัว (บรรทัด 2–4)
`set: "tuning"`, `author`, `status: "draft"`

### บล็อก B — `queries[]` ในขอบเขต (T001–T039, บรรทัด 6–278)
แต่ละข้อมี `id`, `query`, `category: "in_scope"`, `expected_graph_id`, `style` ∈ {`colloquial`, `formal`, `english`, `typo_or_abbrev`, `vague`} — ผังละ 3 ข้อ ตามลำดับ: stops_working (T001–T003), cannot_change_temperature (T004–T006), improper_airflow_temperature (T007–T009), cannot_change_airflow_direction (T010–T012), cannot_change_fan_speed (T013–T015), remote_not_working (T016–T018), timer_not_working (T019–T021), indicator_blinking (T022–T024), odors_from_unit (T025–T027), error_message (T028–T030), unit_generating_noise (T031–T033), water_drips_outdoor (T034–T036), condensation_indoor (T037–T039)
ตัวอย่าง: `{"id":"T001","query":"เสียบปลั๊กแล้วแต่แอร์ไม่ติดเลย","category":"in_scope","expected_graph_id":"samsung_ac_ar70h_stops_working","style":"colloquial"}`

### บล็อก C — `queries[]` นอกขอบเขต (T040–T056, บรรทัด 279–397)
`category: "out_of_scope"`, `expected_graph_id: null`, และ `kind` ∈:
- `other_appliance` (T040–T047, 8 ข้อ): เช่น "ตู้เย็นไม่เย็นเลย", "เครื่องซักผ้าไม่ปั่นแห้ง", "my refrigerator is making a strange noise"
- `ac_outside_manual` (T048–T053, 6 ข้อ): เกี่ยวกับแอร์แต่นอกคู่มือ เช่น "น้ำยาแอร์หมดต้องเติมเมื่อไหร่", "ขอราคาค่าบริการล้างแอร์"
- `unrelated` (T054–T056, 3 ข้อ): "วันนี้ฝนจะตกไหม", "แนะนำร้านอาหารแถวกำแพงแสน", "ช่วยแก้การบ้านคณิตศาสตร์หน่อย"

## 3. การส่งข้อมูล

```
queries_tuning.json ──validate-eval-queries.js──► ตรวจรูปแบบ/ซ้ำ/ข้อความตัวแทน
                    └─eval-symptom-search.js──► embed คำค้น ► rankGraphs ► ตารางกวาดเกณฑ์ ► เลือกเกณฑ์ (เช่น 0.55)
```

## 4. จุดที่ควรระวัง

- **ผู้เขียนเป็น AI และยังไม่ผ่านการตรวจของผู้พัฒนา** — `MATCH_THRESHOLD = 0.55` ใน `symptom-search.service.ts` เลือกจากชุดนี้ และคอมเมนต์ในโค้ดระบุว่า "ห้ามอ้างเป็นความแม่นยำของระบบ"
- ชุดนี้ครอบคลุมเฉพาะผังแอร์ 13 ผัง ถ้าเพิ่มกราฟของเครื่องอื่น (เช่นเครื่องซักผ้า) ชุดและตัวตรวจต้องขยายด้วย — ตัวตรวจ (`validate-eval-queries.js`) อ้างอิงเฉพาะไฟล์ผังแอร์ และคำค้นนอกขอบเขตบางข้อ (เช่น "เครื่องซักผ้าไม่ปั่นแห้ง") จะกลายเป็น "ในขอบเขต" หากเพิ่มผังเครื่องซักผ้าเข้าระบบค้นหา (อนุมานจากโค้ด)
- เกณฑ์แนะนำของตัวตรวจผ่านครบ: รวม 56 ข้อ (≥ 40), นอกขอบเขต 17/56 ≈ 30.4% (≥ 30%), ทุกผังมี 3 ข้อ (≥ 2)
- มีคำค้นที่ตั้งใจให้ลักษณะ "พิมพ์ผิด/ย่อ" (เช่น "cant set temp on my aircon", "แอร์เสียงดังมากกกกก") เพื่อวัดความทนทานของโมเดล

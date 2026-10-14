# scripts/convert_chunks_to_graphs.py

## 1. หน้าที่ของไฟล์

แปลงข้อมูลคู่มือแบบข้อความแบน (flat chunks — ไฟล์ใน `data/chunks/*.json`) ให้เป็นกราฟการแก้ปัญหาตาม schema v2 (ไฟล์แบบ `data/manuals/*.json`) ด้วยกติกาแบบ deterministic ล้วน ไม่เรียกโมเดลภาษา ผลลัพธ์คือ **"ร่าง"** ที่ต้องให้ผู้พัฒนาตรวจและแก้ก่อนใช้จริง (ติดป้าย `review_status: pending_manual_review`)

- **ใครเรียกใช้**: คนรัน `python scripts/convert_chunks_to_graphs.py <input.json> <output.json>`
- **เรียกใช้**: `argparse`, `json`, `re`, `sys`, `pathlib` เท่านั้น
- **ผลลัพธ์ใช้ต่อโดย**: `validate_graph.py`, `simulate_paths.py`, `build_index.py`, `backend/scripts/seed-graphs.js` (หลังผู้พัฒนาตรวจแก้)

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่ (บรรทัด 24–46)
- `NORMAL_BEHAVIOR_PATTERNS`: regex ภาษาอังกฤษที่บ่งว่าอาการนั้นเป็นการทำงานปกติ (เช่น "this is normal", "not a defect")
- `DIRECT_ESCALATION_PATTERNS`: บ่งว่าต้องส่งต่อช่างทันที (เช่น "contact service", "call a technician")
- `STOPWORDS`: คำที่ไม่นับเป็นคำสำคัญ (ใช้ทั้งการตั้งชื่อ slug และจับคู่คำเตือนกับขั้นตอน)

### บล็อก B — ฟังก์ชันช่วย (บรรทัด 53–140)
- `slugify(text, max_words=6)`: ทำข้อความเป็นรหัส ตัดอักษรที่ไม่ใช่ a-z0-9, ตัด stopword, เอา 6 คำแรก ต่อด้วย `_` (ว่างได้ `'unnamed'`)
- `parse_solution_steps(solution)`: แยกวิธีแก้เป็นขั้นตอน — ถ้ามีเลข "1." หรือ "1)" นำหน้าบรรทัดจะแยกตามเลข ไม่เช่นนั้นถือเป็นขั้นตอนเดียว
- `normalize_word_set`, `find_safety_step_index(steps, warning)`: จับคู่คำเตือนความปลอดภัยกับขั้นตอนที่ซ้อนทับคำสำคัญมากที่สุด ต้องซ้อนทับ **อย่างน้อย 2 คำ** ไม่เช่นนั้น `None`
- `is_normal_behavior`, `is_direct_escalation(steps)` (เฉพาะกรณีมีขั้นตอนเดียว), `clean_safety_warning` (ค่าสตริง `'None'`, `'null'`, `'n/a'`, `'-'` ถือว่าว่าง)

### บล็อก C — `build_graph(chunk, brand)` (บรรทัด 147–318)
1. อ่าน `symptom`, `solution`, `safety_warning` จาก `chunk['metadata']` (ไม่มีช่อง solution ใช้ `content` แทนและบันทึก `conversion_notes`)
2. สร้างโหนดแรก `n1` (checkpoint ยืนยันอาการ: `on_no = n_escalate_mismatch`) พร้อม `author_note` ว่าเป็นโหนดจากสคริปต์
3. แยก 4 กรณี (ลำดับตัวเลขในคอมเมนต์คือ 1,2,4,3):
   - **ปกติ** (181–189) → `n_normal` (resolution, `normal_behavior`)
   - **ติดต่อช่างทันที** (191–199) → `n_escalate_direct` (escalation, `handoff_informed`)
   - **ไม่มีข้อมูลวิธีแก้** (201–213) → `n_escalate_nodata` (`handoff_unknown`)
   - **กรณีทั่วไป** (215–263): สำหรับแต่ละขั้นตอน i สร้าง `s{i}` (instruction, ผูก `safety_critical`/`safety_warning` ตามผลจับคู่) แล้ว `c{i}` (checkpoint "แก้ไขได้หรือไม่?" → yes ไป `n_resolved`, no ไปขั้นถัดไปหรือ `n_escalate` ถ้าเป็นขั้นสุดท้าย) ปิดท้ายด้วย `n_resolved` (`user_fixed`) และ `n_escalate` (`handoff_unknown`)
4. เพิ่ม `n_escalate_mismatch` ทุกกราฟ (265–275)
5. ตรวจทันทีว่าทุกเส้นเชื่อม (`on_yes`, `on_no`, `next`, `on_invalid`) ชี้ไปโหนดที่มีจริง ถ้าไม่ `ValueError` (277–287)
6. คืนกราฟ: `schema_version: 2`, `graph_id = slugify(model,3) + '_' + slugify(symptom)`, `entry_symptom_th: ''` (ผู้พัฒนาต้องเติมคำแปลเอง), `page_range = [page, page]`, `possible_cause`, `generated_by`, `review_status`, `conversion_notes`, `entry_node: 'n1'`, `nodes`

### บล็อก D — `convert_file` และ `main` (บรรทัด 325–389)
อ่าน chunks (ต้องเป็นรายการไม่ว่าง ไม่เช่นนั้น `sys.exit`) → ใช้ `brand` ของ chunk แรก → `build_graph` ทุก chunk → สร้างไฟล์คู่มือ (`manual_id = slugify(brand model, 4)`, `count`, `graphs`) เขียนด้วย `ensure_ascii=False, indent=2` → พิมพ์สถิติ (จำนวนกราฟ/โหนด/ชนิด/โหนดที่มีด่านความปลอดภัย) ; `main` ใช้ `argparse` รับ `input` กับ `output`

## 3. การส่งข้อมูล

```
data/chunks/<ไฟล์>.json (flat chunks: metadata.symptom/solution/safety_warning/severity …)
        ──convert_file──► build_graph ต่อ chunk ──► <output>.json (manual v2 แบบร่าง)
```
ตัวอย่างโครงโหนดที่สร้าง: `n1 (checkpoint) → s1 (instruction) → c1 (checkpoint) → s2 → c2 → … → n_resolved / n_escalate`, และ `n_escalate_mismatch`

## 4. จุดที่ควรระวัง

- **ผลลัพธ์ไม่ผ่าน schema v2 โดยสภาพ**: รหัสโหนด `s1`, `c1` ไม่ตรง pattern `^n[a-z0-9_]+$` ของ schema และฟิลด์ `generated_by`, `review_status`, `conversion_notes`, `possible_cause` ไม่อยู่ใน schema (ซึ่งไม่อนุญาต property เพิ่ม) — ผมรัน `validate_graph.py` กับไฟล์เครื่องซักผ้า 29 กราฟ (`data/manuals/washing_machine_clf.json` — ไฟล์นั้นระบุว่าสร้างด้วย `convert_with_classifier.py` ที่ไม่อยู่ใน repo แต่โครงโหนด `s1`/`c1`/`n_escalate_mismatch` เหมือนที่สคริปต์นี้สร้าง) ล้มทั้ง 29 กราฟด้วยสาเหตุนี้ ต้องแก้ด้วยมือ/สคริปต์เพิ่มก่อนนำเข้า DB จริง
- **`graph_id` ไม่รับประกันว่าไม่ซ้ำ**: สร้างจาก slug ของ model + 6 คำแรกของอาการ ถ้าสองอาการคำนำหน้าเหมือนกันจะได้ id ซ้ำ โดยสคริปต์ไม่ตรวจ
- **`entry_symptom_th` เป็นสตริงว่าง** ทุกกราฟ ต้องเติมก่อนใช้กับระบบค้นหา (ข้อความตัวแทนภาษาไทยหายไป)
- **`brand` ใช้ของ chunk แรกทั้งไฟล์** และ `manual_id`/`device_category` ก็มาจาก chunk แรก — ถ้าไฟล์ผสมหลายยี่ห้อ/รุ่นจะผิด
- การจับคู่คำเตือนกับขั้นตอนใช้การนับคำซ้อนทับ ≥ 2 คำ — เป็นการเดา ผู้พัฒนาต้องตรวจ (ตามที่ `author_note` ในกราฟระบุ) ; การตัดสิน "ปกติ/ต้องเรียกช่าง" ใช้ regex ภาษาอังกฤษเท่านั้น

# scripts/validate_graph.py

## 1. หน้าที่ของไฟล์

ตัวตรวจกราฟแก้ปัญหา (schema v2) 3 ชั้น: (1) ตรวจกับ JSON Schema `data/schemas/troubleshooting-graph.v2.schema.json` (2) กฎทางธุรกิจ (เข้าถึงได้, ไม่มีโหนดตาย, โหนดจบ, ตำแหน่งด่านความปลอดภัย) (3) กฎเฉพาะ v2 (โหนด input, ที่มาของ config, ตัวแปรเทมเพลต) — ทำงานกับไฟล์คู่มือ โดยแตกกราฟทีละอันตรวจ แล้วสรุปผ่าน/ไม่ผ่าน

- **ใครเรียกใช้**: คนรัน `python scripts/validate_graph.py --all` หรือ `python scripts/validate_graph.py data/manuals/<ชื่อ>.json` (ไม่มีไฟล์โค้ดอื่น import; ตัวตรวจ JavaScript ที่คล้ายกันอยู่ใน `backend/scripts/seed-graphs.js` ฟังก์ชัน `validateManual`)
- **เรียกใช้**: `json`, `re`, `sys`, `pathlib`, `jsonschema` (นำเข้าตอนเรียกใช้เท่านั้น) ; อ่าน `data/schemas/troubleshooting-graph.v2.schema.json` และ `data/manuals/*.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่ (บรรทัด 19–20)
`EDGE_KEYS = ("on_yes","on_no","next","on_invalid")`, `TERMINAL_TYPES = ("resolution","escalation")`

### บล็อก B — `validate_json_schema(graph, schema)` (บรรทัด 23–32)
ใช้ `Draft202012Validator` คืนรายการ `[SCHEMA] <json_path>: <message>` เรียงตาม path ; ถ้าไม่ได้ติดตั้ง `jsonschema` คืนแค่ `["[WARN] jsonschema not installed …"]`

### บล็อก C — `validate_business_rules(graph)` (บรรทัด 35–203) กฎ 12 ข้อ
| ข้อ | กฎ | ระดับ |
|---|---|---|
| 1 | `entry_node` ต้องมีใน nodes (และตรวจ `node_id` ซ้ำ) | ERROR |
| 2 | เส้นเชื่อมทุกเส้นต้องชี้โหนดที่มี | ERROR |
| 3 | โหนดจบห้ามมี `on_yes/on_no/next/on_invalid` | ERROR |
| 4 | ทุกโหนดต้องเข้าถึงได้จาก `entry_node` (DFS) | ERROR |
| 5 | ทุกโหนดต้องไปถึงโหนดจบได้ (BFS) — กันวนไม่รู้จบ; ต้องมีโหนดจบอย่างน้อยหนึ่งตัว | ERROR |
| 6 | `safety_critical` ต้องมี `safety_warning` (ไม่งั้นกล่องเตือนว่าง) | ERROR |
| 7 | `safety_critical` บน checkpoint/input | WARN (ควรย้ายไป instruction) |
| 8 | `pattern` ของ input ต้อง compile ได้ ; มี pattern แต่ไม่มี `on_invalid` | ERROR / WARN |
| 9 | ตัวแปร `{{x}}` ต้องมี input node ที่ `store_as` ตัวนั้น | ERROR |
| 10 | `config` ที่ origin เป็น `author_assumption` | WARN |
| 11 | `config` แบบ `by_model_variant` ต้องมี variant ที่ครอบคลุม `model_pattern` (เทียบรูปแบบมี wildcard `*` ทั้งสองฝั่งด้วย `patterns_overlap`) | ERROR |
| 12 | `external_reference.in_knowledge_base == False` | WARN (UI ห้ามแสดงเป็นลิงก์) |
คืน `errors + warnings`

### บล็อก D — `validate_manual(path, schema)` (บรรทัด 206–256)
อ่านไฟล์คู่มือ แล้วตรวจแต่ละกราฟแยกกัน (เพราะ schema เขียนสำหรับ 1 กราฟ ไม่ใช่ทั้งไฟล์ และบอกได้ว่ากราฟไหนผิด) พิมพ์ ERROR/WARN, `PASS — N nodes (…)` หรือ `FAIL — …` ; ผ่านเมื่อไม่มี [SCHEMA] และ [BIZ] ; คืน `dict` กุญแจ `"<manual_id>/<graph_id>"`

### บล็อก E — `main()` (บรรทัด 259–291)
โหลด schema (ถ้ามีไฟล์) ; ไม่มี argument พิมพ์วิธีใช้และ `exit(1)` ; `--all` ตรวจทุก `data/manuals/*.json` มิฉะนั้นตรวจไฟล์ที่ระบุ ; พิมพ์ `SUMMARY: ผ่าน/ทั้งหมด` ; `exit(0)` เมื่อผ่านทั้งหมด ไม่เช่นนั้น `exit(1)`

## 3. การส่งข้อมูล

```
data/manuals/*.json + data/schemas/…v2.schema.json ──► validate_manual ──► stdout (ERROR/WARN/PASS/FAIL, SUMMARY) + exit code 0/1
```

## 4. ผลที่ทดลองรันจริง (อ่านอย่างเดียว)

- `python scripts/validate_graph.py data/manuals/samsung_ac_ar70h.json` → **SUMMARY: 13/13 passed**
- `python scripts/validate_graph.py --all` → **SUMMARY: 13/42 passed** (exit 1) — กราฟเครื่องซักผ้า 29 กราฟใน `washing_machine_clf.json` ล้มทั้งหมด ด้วย [SCHEMA] เช่น `Additional properties are not allowed ('classification_log', 'conversion_notes', 'generated_by', 'possible_cause', 'review_status')` และ `node_id 's1' does not match '^n[a-z0-9_]+$'` (รหัสโหนดแบบ `s1`/`c1` จากสคริปต์แปลง)

## 5. จุดที่ควรระวัง

- **ถ้าไม่ได้ติดตั้ง `jsonschema` ตัวตรวจจะ "ผ่านชั้น schema" เงียบๆ**: ได้เพียงข้อความ `[WARN]` ซึ่งไม่ถูกนับเป็นข้อผิดพลาด (ตัวกรองนับเฉพาะ `[SCHEMA]`/`[BIZ]`) (อนุมานจากโค้ด)
- **regex ตรวจด้วย Python (`re.compile`) แต่ engine จริงใช้ `RegExp` ของ JavaScript** (`traversal-engine.ts` บรรทัด 156) สองภาษา regex ไม่เหมือนกันทั้งหมด (เช่น named group `(?P<x>…)`) pattern ที่ผ่านที่นี่อาจ error ตอนรันจริง (อนุมานจากโค้ด)
- ข้อ 4/5 ตรวจเฉพาะความเชื่อมต่อของกราฟ ไม่ตรวจความหมายของข้อความ ; ตัวตรวจความหมายอยู่ที่ `simulate_paths.py`
- ข้อ 7 ของตัวตรวจเป็นแค่คำเตือน ส่วน engine จริง **ไม่บังคับ** ด่านกับโหนดที่ไม่ใช่ instruction (ตาม `traversal-engine.ts`)
- ข้อความแจ้งเตือนเป็นภาษาอังกฤษเป็นหลัก (ต่างจากสคริปต์อื่น)

# data/schemas/troubleshooting-graph.v2.schema.json

## 1. หน้าที่ของไฟล์

JSON Schema (draft 2020-12) ที่นิยามรูปร่างที่ถูกต้องของ "กราฟแก้ปัญหา 1 อัน" (schema v2) ใช้ตรวจโครงสร้าง: ฟิลด์บังคับ ชนิดข้อมูล enum และกฎของโหนดแต่ละชนิด คำอธิบายในไฟล์ระบุว่า กราฟควบคุมบทสนทนาแบบกำหนดแน่นอน ("LLM ไม่เคยตัดสินขั้นถัดไป") และสิ่งที่เปลี่ยนจาก v1: `confidence` ถูกถอดออกจากโหนด (คำนวณต่อ session จาก retrieval), `config` รองรับตารางตามรุ่นเครื่อง, มีโหนด `input` ใหม่, และ `external_reference` สำหรับลิงก์ข้ามเอกสาร

- **ใครเรียกใช้**: `scripts/validate_graph.py` (โหลดไฟล์นี้ผ่าน `Draft202012Validator`) ; รูปร่างเดียวกันสะท้อนใน type `TroubleshootingGraph` ของ `backend/src/traversal-engine/types.ts` (คอมเมนต์ในไฟล์ type อ้างไฟล์นี้เป็นต้นฉบับ)
- **เรียกใช้**: ไม่มี (เป็นข้อมูล)

## 2. อธิบายทีละบล็อก

### บล็อก A — ระดับกราฟ (บรรทัด 1–88)
- `required` (7–19): `schema_version`, `graph_id`, `device_category`, `brand`, `model_pattern`, `entry_symptom`, `source`, `page_range`, `source_chunk_id`, `entry_node`, `nodes`
- **`additionalProperties: false`** (20): ห้ามมี property นอกรายการ
- `schema_version`: `const 2` — ตรึงไว้เพื่อให้ engine ปฏิเสธกราฟที่มันไม่ได้ถูกสร้างมาสำหรับ
- `graph_id`: pattern `^[a-z0-9_]+$`
- `device_category`: enum 10 ค่า (Air Conditioner, Refrigerator, Washing Machine, Microwave, Television, Printer, Dishwasher, Dryer, Smartphone, Laptop)
- `model_pattern`: รุ่นที่กราฟครอบคลุม ใช้ `*` เป็น wildcard (เช่น `AR70H**D1***`) ; ค่าสเปกที่ต่างกันตามรุ่นต้องไปอยู่ใน `config` แบบตาราง ไม่ใช่ค่าเดี่ยว
- `entry_symptom` (อังกฤษ, ใช้ฝัง embedding), `entry_symptom_th` (ไทย, ฝังคู่กันเพื่อให้คำค้นไทยตรงโดยไม่พึ่ง cross-lingual), `entry_symptom_aliases` (คำพ้องที่ผู้ใช้พิมพ์จริง)
- `page_range`: array จำนวนเต็ม ≥ 1 ยาว 2 พอดี ; `severity`, `difficulty` : enum ; `config`: object ของ `config_entry` ; `entry_node`, `nodes` (อย่างน้อย 1)

### บล็อก B — `$defs` ย่อย (บรรทัด 90–171)
- `node_id_ref`: pattern `^n[a-z0-9_]+$` (ขึ้นต้นด้วย `n`)
- `outcome_kind`: enum 4 แบบ พร้อมคำอธิบายความหมายแต่ละแบบ
- `config_entry`: `oneOf` สองรูป — `scalar` (มี `value`, `unit`, `source`) หรือ `by_model_variant` (มี `unit`, `variants[]` ที่แต่ละตัวมี `match` pattern และ `value`; "First match wins" เรียงจากเฉพาะเจาะจงไปทั่วไป, และ `source`)
- `value_provenance`: `origin` ∈ {`source_manual`, `other_official_document`, `author_assumption`} (ค่า `author_assumption` ห้ามแสดงต่อผู้ใช้ราวกับคู่มือระบุ) + `document`, `page`, `note`
- `external_reference`: บังคับ `document`, `section`, `in_knowledge_base` (false = UI ต้องแสดงเป็น "ดูคู่มือฉบับพิมพ์" ไม่ใช่ลิงก์)

### บล็อก C — `node` (บรรทัด 173–293)
ฟิลด์ร่วม: `node_id` (pattern `^n[a-z0-9_]+$`), `type` (5 ชนิด), `safety_critical`, `safety_warning`, `has_image`, `image_url` (format uri), `author_note`, `external_reference` ; แล้ว `allOf` ของกฎ if/then ต่อชนิด:
| ชนิด | ต้องมี | ห้ามมี |
|---|---|---|
| `checkpoint` | `question`, `on_yes`, `on_no` | `next`, `content`, `outcome_kind`, `store_as` |
| `instruction` | `content`, `next` | `on_yes`, `on_no`, `question`, `outcome_kind`, `store_as` |
| `input` | `prompt`, `input_type` (error_code/model_number/number/text), `store_as` (`^[a-z0-9_]+$`), `next` ; ไม่บังคับ `pattern`, `on_invalid` | `on_yes`, `on_no`, `content`, `outcome_kind` |
| `resolution` / `escalation` | `content`, `outcome_kind` | `on_yes`, `on_no`, `next`, `question`, `confidence`, `store_as` |

## 3. การส่งข้อมูล

```
data/manuals/*.json (แต่ละ graph) ──► jsonschema Draft202012Validator(schema) ──► [SCHEMA] path: message
```
ใช้โดย `validate_graph.py` ทีละกราฟ (ไม่ใช่ทั้งไฟล์คู่มือ)

## 4. จุดที่ควรระวัง

- **ชุด `device_category` ในไฟล์นี้ (10 ค่า) กว้างกว่า type ใน TypeScript และ ENUM ใน MySQL (5 ค่า)** กราฟที่ใช้ `Printer`/`Dishwasher`/`Dryer`/`Smartphone`/`Laptop` จะผ่านตัวตรวจ schema แต่จะ seed ลง DB ไม่ได้ (migration 003 จำกัดเป็น 5 ประเภท) (อนุมานจากการเปรียบเทียบไฟล์)
- **รหัสโหนดต้องขึ้นต้นด้วย `n`** ผลคือกราฟจากสคริปต์แปลง (`convert_chunks_to_graphs.py`) ที่ใช้ `s1`/`c1` ไม่ผ่าน ; และ **`additionalProperties: false`** ทำให้ฟิลด์ `generated_by`, `review_status`, `conversion_notes`, `possible_cause` ของสคริปต์แปลงไม่ผ่านเช่นกัน (ยืนยันจากการรัน `validate_graph.py` กับไฟล์เครื่องซักผ้า)
- schema ไม่ได้บังคับว่า `safety_critical` ต้องอยู่บน `instruction` เท่านั้น (กฎนั้นอยู่ใน `validate_graph.py` ข้อ 6–7 และ `seed-graphs.js`)
- ระดับ `node` ไม่ได้ตั้ง `additionalProperties: false` ฟิลด์แปลกปลอมระดับโหนดจึงผ่านได้ (ยกเว้นที่ถูก `not` ห้ามไว้ตามชนิด)
- `$id` ใช้ชื่อโดเมน `fixbot.dev` ตามชื่อโปรเจกต์เดิม (FixBot) ; `format: "uri"` ของ `image_url` โดยปกติไม่ถูกบังคับตรวจ เว้นแต่เปิดโหมด format checking (อนุมานจากพฤติกรรมของ JSON Schema)

# backend/migrations/001_create_graph_tables.sql

## 1. หน้าที่ของไฟล์

สร้างตารางกลุ่ม "ข้อมูลกราฟ" 3 ตาราง: `manuals` (คู่มือ) → `graphs` (อาการ) → `nodes` (ขั้นตอน) ข้อมูลกลุ่มนี้ถูกเขียนครั้งเดียวตอน seed แล้วอ่านอย่างเดียว ทุกตารางใช้ `utf8mb4` เพราะข้อความเป็นภาษาไทย (คอมเมนต์ 8–9: `utf8` ใน MySQL คือ `utf8mb3` เก็บบางตัวอักษรไม่ได้)

- **ใครเรียกใช้**: `scripts/run-migrations.js` (รันตามลำดับเลขไฟล์)
- **ใครใช้ตาราง**: `scripts/seed-graphs.js` (เขียน), `graph.repository.ts` (อ่านตอนบูต), ตาราง `sessions` (002) อ้าง `graphs`
- **เรียกใช้**: ไม่มี (SQL ล้วน)

## 2. อธิบายทีละบล็อก

### บล็อก A — `manuals` (บรรทัด 11–25) 1 แถวต่อคู่มือ 1 เล่ม
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `manual_id` | VARCHAR(80) PK | |
| `device_category` | VARCHAR(40) NOT NULL | (migration 003 เปลี่ยนเป็น ENUM 5 ประเภท) |
| `brand`, `model_pattern` | VARCHAR(40), VARCHAR(60) | |
| `source_manual` | VARCHAR(200) | ชื่อไฟล์คู่มือต้นฉบับ ใช้สร้างการอ้างอิง |
| `graph_count` | SMALLINT UNSIGNED DEFAULT 0 | |
| `created_at`, `updated_at` | TIMESTAMP | `updated_at` ON UPDATE CURRENT_TIMESTAMP |
ดัชนี `idx_manuals_category (device_category)`

### บล็อก B — `graphs` (บรรทัด 27–67) 1 แถวต่ออาการ 1 อาการ
- `graph_id` VARCHAR(120) PK, `manual_id` FK
- `entry_symptom` TEXT (อังกฤษ), `entry_symptom_th` TEXT NULL (ไทย ใช้แสดงผลและค้นหา), `entry_symptom_aliases` JSON NULL (คำพ้อง array)
- ที่มา: `source` VARCHAR(200), `page_start`, `page_end` (SMALLINT UNSIGNED), `source_chunk_id`
- `severity` ENUM('low','medium','high','critical') NULL, `difficulty` ENUM('easy','medium','hard') NULL
- `config` JSON NULL (provenance ของค่าคงที่จากคู่มือ)
- `entry_node` VARCHAR(60) NOT NULL — **ตั้งใจไม่ใส่ FOREIGN KEY ไป `nodes`** เพราะจะเป็นวงกลม (`nodes` อ้าง `graph_id`, แต่ `graphs.entry_node` ก็อ้าง `nodes`) (คอมเมนต์ 50–52)
- `schema_version` TINYINT UNSIGNED DEFAULT 2
- `fk_graphs_manual` → `manuals` **ON DELETE CASCADE ON UPDATE CASCADE** (ลบคู่มือ = ลบกราฟของคู่มือนั้น)

### บล็อก C — `nodes` (บรรทัด 69–131) 1 แถวต่อโหนด
คอมเมนต์ 74–80 แจกแจงว่าแต่ละชนิดโหนดใช้คอลัมน์ใด (ที่ไม่ใช้เป็น NULL) และคอมเมนต์ 82–85 อธิบายว่ารวม `question/content/prompt` เป็น `text_content` ช่องเดียว (repository แปลงกลับเป็นชื่อ field ตาม `node_type`)
- PK `(graph_id, node_id)` — `node_id` ซ้ำข้ามกราฟได้ (เช่น `n1`) แต่ห้ามซ้ำในกราฟเดียว (คอมเมนต์ 122)
- `node_type` ENUM 5 ชนิด, `text_content` TEXT NOT NULL
- เส้นออก: `on_yes`, `on_no` (checkpoint), `next_node` (instruction/input), `on_invalid` (input; NULL = วนกลับโหนดเดิม) — ทั้งหมด VARCHAR(60) NULL
- เฉพาะ input: `input_type` ENUM('error_code','model_number','number','text'), `input_pattern` VARCHAR(255), `store_as` VARCHAR(60)
- เฉพาะโหนดจบ: `outcome_kind` ENUM 4 แบบ
- ความปลอดภัย: **`safety_critical BOOLEAN NOT NULL DEFAULT FALSE`**, `safety_warning` TEXT NULL
- `has_image` BOOLEAN, `image_url`, `author_note` TEXT, `external_reference` JSON, `display_order` SMALLINT UNSIGNED (รักษาลำดับตามไฟล์ต้นฉบับ)
- `fk_nodes_graph` → `graphs` ON DELETE CASCADE ON UPDATE CASCADE; ดัชนี `idx_nodes_type`, `idx_nodes_safety`

## 3. การส่งข้อมูล

```
data/manuals/*.json ─(seed-graphs.js)─► manuals/graphs/nodes ─(graph.repository.ts ตอนบูต)─► หน่วยความจำ
```
`BOOLEAN` ใน MySQL คือ `TINYINT(1)` — `mysql2` คืนเป็นตัวเลข 0/1 ซึ่งตรงกับการเทียบ `=== 1` ใน `graph.repository.ts`

## 4. จุดที่ควรระวัง

- **`entry_node` ไม่มี FK** จึงต้องพึ่งการตรวจใน `GraphRepository.buildGraph` และ `validate_graph.py` ว่าชี้โหนดที่มีจริง
- **เส้นเชื่อม `on_yes/on_no/next_node/on_invalid` ไม่มี FK** เช่นกัน (เก็บเป็น string) การชี้ไปโหนดที่ไม่มีจะพบตอนเดินกราฟ (`NodeNotFoundError`) ถ้าไม่ได้ตรวจก่อน
- `CREATE TABLE IF NOT EXISTS` ทำให้รันซ้ำได้ แต่ไม่ได้อัปเดตโครงสร้างตารางที่มีอยู่แล้ว (การเปลี่ยนโครงสร้างต้องทำด้วย migration ใหม่ เช่น 003–005)
- ENUM ของ `node_type` / `input_type` / `outcome_kind` ต้องตรงกับ type ใน `traversal-engine/types.ts` — ถ้าเพิ่มชนิดใหม่ต้องแก้ทั้งสองที่

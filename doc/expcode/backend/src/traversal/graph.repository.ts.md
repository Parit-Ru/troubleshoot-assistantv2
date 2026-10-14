# backend/src/traversal/graph.repository.ts

## 1. หน้าที่ของไฟล์

โหลดผังขั้นตอนแก้ปัญหา (graph) ทั้งหมดจาก MySQL เข้าหน่วยความจำ "ครั้งเดียวตอนบูต" โดยแปลงข้อมูลจากรูปแบบตาราง (แถวใน `graphs`, `nodes`, `manuals`) กลับเป็น `TroubleshootingGraph` (JSON) ที่ engine ต้องการ แล้วให้ service เรียกดูผ่าน `findById()` และ `listAll()`
เหตุผลที่โหลดตอนบูต (คอมเมนต์ 7–10): กราฟอ่านอย่างเดียว เปลี่ยนเฉพาะตอนรัน seed script ระดับร้อยกราฟกินหน่วยความจำไม่กี่ร้อย KB ทำให้ทุก request เดินกราฟได้โดยไม่แตะ DB

- **ใครเรียกใช้**: `graph.module.ts` (ลงทะเบียน provider), `traversal.service.ts`, `traversal.controller.ts`, `symptom-search.service.ts` (สร้างดัชนีอาการ) และ spec ของ service สองตัว
- **เรียกใช้**: `../database/database.constants` (`MYSQL_POOL`), `../traversal-engine/types` (type + `UnsupportedSchemaVersionError`), `mysql2/promise`, `@nestjs/common`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 13–27)
นำเข้า `Inject, Injectable, Logger, OnModuleInit`, type ของ `mysql2` และ type/error จาก `types.ts`

### บล็อก B — interface ของแถว SQL (บรรทัด 29–70)
- `GraphRow` (30–48): 1 แถว = 1 กราฟ (JOIN `manuals` แล้วเพื่อเอา `device_category`, `brand`, `model_pattern`) ฟิลด์ที่เป็น JSON (`entry_symptom_aliases`, `config`) ตั้งเป็น `unknown`
- `NodeRow` (51–70): 1 แถว = 1 โหนด คอลัมน์ใช้ร่วมทั้ง 5 ชนิด ที่ไม่เกี่ยวเป็น NULL; `safety_critical`, `has_image` เป็น `number` (0/1)
- ทั้งสองขยาย `RowDataPacket` ซึ่งมี index signature ทำให้การสะกดชื่อคอลัมน์ผิดไม่ถูก TypeScript จับ (อนุมานจากชนิด `RowDataPacket`)

### บล็อก C — `GraphSummary` (บรรทัด 72–82)
ข้อมูลย่อของกราฟ (`graphId`, `entrySymptom`, `entrySymptomTh?`, `deviceCategory`, `brand`, `modelPattern`, `severity?`, `difficulty?`) สำหรับ `GET /traversal/graphs`

### บล็อก D — `GraphDataIntegrityError` (บรรทัด 84–90)
error เฉพาะ เมื่อข้อมูลใน DB ไม่ครบหรือไม่ถูกต้อง (ไม่ได้ export จึงใช้ภายในไฟล์)

### บล็อก E — คลาส `GraphRepository` และ lifecycle (บรรทัด 92–107)
- `@Injectable()` และ `implements OnModuleInit`
- field `graphs: Map<string, TroubleshootingGraph>` (97) key = `graph_id`
- constructor รับ pool ด้วย `@Inject(MYSQL_POOL)` (99)
- `onModuleInit()` (105–107) `await this.loadAll()` — คอมเมนต์ 102–103: ถ้า throw แอปจะไม่บูต "ตั้งใจให้เป็นแบบนั้น"

### บล็อก F — API สาธารณะ (บรรทัด 109–130)
- `findById(graphId)` (114–116): คืนกราฟหรือ `undefined` — ให้ service ตัดสินใจเองว่าจะ 404 อย่างไร
- `listAll()` (119–130): แปลงทุกกราฟเป็น `GraphSummary[]` ตามลำดับที่ Map เก็บ (= ลำดับ `ORDER BY graph_id` ตอนโหลด)

### บล็อก G — `loadAll()` (บรรทัด 136–180)
1. query ที่ 1 (142–151): `SELECT … FROM graphs g JOIN manuals m … ORDER BY g.graph_id`
2. query ที่ 2 (153–161): `SELECT … FROM nodes ORDER BY graph_id, display_order`
3. จัดกลุ่มโหนดตาม `graph_id` ด้วย `Map` (166–171) — คอมเมนต์ 164–165: `node_id` ซ้ำข้ามกราฟได้ (PRIMARY KEY เป็นคู่ `(graph_id, node_id)`) จึงห้าม key ด้วย `node_id` อย่างเดียว
4. `graphs.clear()` แล้วสร้างกราฟทีละอันด้วย `buildGraph` (173–177)
5. log จำนวนกราฟ/โหนด (179)
- **ทำไมแยกเป็น 2 query ไม่ JOIN nodes**: คอมเมนต์ 137–140 บอกว่า JOIN จะทำให้ข้อมูลระดับกราฟซ้ำตามจำนวนโหนด (95 แถวแทน 13) ต้อง dedupe อยู่ดี

### บล็อก H — `buildGraph()` (บรรทัด 182–222)
- ตรวจ `schema_version !== 2` → `UnsupportedSchemaVersionError` (184–186) จากค่าจริงใน DB ไม่ใช่ค่าคงที่
- ไม่มีโหนดเลย → `GraphDataIntegrityError` (188–192)
- แปลงโหนดทั้งหมด (194)
- ตรวจว่า `entry_node` ชี้ไปโหนดที่มีจริง (196–202) เพราะไม่งั้น session แรกจะพังทันที
- คืนวัตถุ `TroubleshootingGraph` (204–221): ใส่ `schema_version: 2` เป็นค่าคงที่ (หลังผ่านการตรวจแล้ว), `page_range: [page_start, page_end]`, ค่า NULL เปลี่ยนเป็น `undefined`, JSON column ผ่าน `parseJsonColumn`

### บล็อก I — `buildNode()` (บรรทัด 224–303)
- สร้าง `base` ที่ใช้ร่วม (233–241): `safety_critical: row.safety_critical === 1`, `has_image: row.has_image === 1` ฯลฯ
- `switch (row.node_type)` แยก 5 ชนิด:
  - `checkpoint` (244–251): `question` = `text_content`, `on_yes`/`on_no` ผ่าน `required()`
  - `instruction` (253–259): `content`, `next` ผ่าน `required()`
  - `input` (261–275): ใช้ field `prompt` ไม่ใช่ `content` (คอมเมนต์ 262–263 เตือนว่าใส่ผิดจะได้ string ว่างโดยไม่มี error), `input_type`/`store_as`/`next` บังคับ, `pattern` (จาก `input_pattern`) และ `on_invalid` เป็น optional โดยตั้งใจ
  - `resolution` (277–283) และ `escalation` (285–291): `content`, `outcome_kind` บังคับ
  - `default` (293–301): ตัวช่วยให้ TypeScript ยืนยันว่า switch ครอบคลุมทั้ง 5 ชนิด (`never`) และเป็นด่านสุดท้ายหาก ENUM ใน DB หลุด

### บล็อก J — ตัวช่วย (บรรทัด 306–337)
- `required(value, column, row)` (314–322): ถ้าค่าเป็น `null` หรือ `''` โยน `GraphDataIntegrityError` ที่ระบุโหนด/กราฟ/คอลัมน์ — เป็นด่านเปลี่ยน "NULL ที่ตารางยอมได้" ให้เป็น "error ตอนบูต" (generic `T extends string` เพื่อคง type ของ enum)
- `parseJsonColumn<T>(value)` (329–337): รับทั้ง object (ที่ mysql2 แปลงให้) และ string (กรณี config พิเศษ) คืน `undefined` เมื่อว่าง ไม่ `JSON.parse` ซ้ำ

## 3. การส่งข้อมูล

```
MySQL (graphs + manuals + nodes)
   │  pool.query ×2 (ตอน onModuleInit)
   ▼
GraphRepository.graphs  (Map<graph_id, TroubleshootingGraph> ในหน่วยความจำ)
   ├─► findById()  → TraversalService / SymptomSearchService (สร้างดัชนี)
   └─► listAll()   → TraversalController (GET /traversal/graphs)
```
ตัวอย่างผลของ `listAll()` (ค่าจริงจากข้อมูลแอร์ ดู `data/index.json`): `{ "graphId":"samsung_ac_ar70h_improper_airflow_temperature", "entrySymptom":"Improper airflow temperature", "entrySymptomTh":"แอร์ไม่เย็น ลมออกมาไม่เย็น", "deviceCategory":"Air Conditioner", "brand":"Samsung", "modelPattern":"AR70H**D1***", "severity":"medium", "difficulty":"easy" }`

## 4. จุดที่ควรระวัง

- **ถ้าข้อมูลใน DB เสีย แอปไม่บูต** (ตั้งใจ ตามคอมเมนต์ 102–103) — ต้องรัน seed ใหม่แล้วเริ่มเซิร์ฟเวอร์ใหม่
- **ไม่มีเมธอด reload สาธารณะ**: `loadAll` เป็น private เรียกครั้งเดียวตอนบูต หากรัน seed ขณะเซิร์ฟเวอร์เปิดอยู่ ข้อมูลในหน่วยความจำจะไม่เปลี่ยนจนกว่าจะเริ่มใหม่ (อนุมานจากโค้ด)
- **`safety_critical === 1`** (บรรทัด 235): เทียบกับตัวเลข 1 โดยตรง ถ้า driver ถูกตั้งให้คืน boolean (เช่น ใช้ `typeCast`) ค่าจะกลายเป็น `false` เงียบๆ และด่านความปลอดภัยของโหนดนั้นจะหายไป — เป็นจุดที่ควรเทสอยู่เสมอ (อนุมานจากโค้ด)
- **ตรวจความสมบูรณ์แค่บางส่วน**: ตรวจ `entry_node` แต่ไม่ตรวจว่า `on_yes` / `on_no` / `next` / `on_invalid` ชี้ไปโหนดที่มีจริง (งานนั้นอยู่ที่ `scripts/validate_graph.py`) หากข้อมูลผิดจะไปพบตอนเดินกราฟเป็น `NodeNotFoundError`
- `parseJsonColumn<never>(row.external_reference)` (บรรทัด 240) ใช้ `never` เพื่อให้ type ผ่านโดยไม่ตรวจโครงสร้างจริง — เป็นการบังคับ type ไม่ใช่การตรวจข้อมูล
- `findById` คืนอ็อบเจ็กต์เดียวกับที่เก็บไว้ (ไม่คัดลอก) ถ้าผู้เรียกแก้ไขจะกระทบทุกคน; ปัจจุบัน engine เป็น pure function จึงไม่แก้ (อนุมานจากโค้ด `traversal-engine.ts`)

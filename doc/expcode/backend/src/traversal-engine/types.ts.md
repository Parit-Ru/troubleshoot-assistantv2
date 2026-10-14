# backend/src/traversal-engine/types.ts

## 1. หน้าที่ของไฟล์

ไฟล์นี้เป็น "พจนานุกรมรูปร่างข้อมูล" ของระบบเดินกราฟแก้ปัญหา (Traversal Engine) ทั้งหมด: นิยามโหนด 5 แบบ, กราฟ 1 อัน, สถานะ session, คำสั่ง (action) ที่ผู้ใช้ส่งมา, โหนดที่พร้อมแสดงผล (`RenderedNode`) และ error class ที่ engine โยนออกมา
ไฟล์นี้ไม่มี `import` ใดๆ เลย (บรรทัด 6–7 ระบุว่าตั้งใจให้ engine เทสได้เร็วโดยไม่ต้องรัน server)

- **ไฟล์ที่เรียกใช้ไฟล์นี้**: `traversal-engine.ts`, `symptom-matcher.ts`, `symptom-search.dto.ts`, `symptom-search.service.ts`, `equipment.repository.ts`, `graph.repository.ts`, `session.store.ts`, `traversal.dto.ts`, `traversal.exception.filter.ts`, `traversal.service.ts`, ไฟล์ spec หลายไฟล์ และฝั่ง frontend คือ `frontend/src/api/types.ts` กับ `frontend/src/mocks/mockServer.ts`
- **ไฟล์ที่ไฟล์นี้เรียกใช้**: ไม่มี

## 2. อธิบายทีละบล็อก

### บล็อก A — ชนิดของโหนด (บรรทัด 13–98)
| บรรทัด | สิ่งที่ประกาศ | ความหมาย |
|---|---|---|
| 17 | `NodeType` | ชนิดโหนด 5 แบบ: `checkpoint` (ถามใช่/ไม่ใช่), `instruction` (บอกให้ทำ), `input` (ให้พิมพ์ค่า), `resolution` (จบแบบแก้ได้/ปกติ), `escalation` (จบแบบส่งต่อช่าง) |
| 19 | `InputType` | ชนิดช่องกรอกของโหนด input: `error_code`, `model_number`, `number`, `text` |
| 28 | `OutcomeKind` | ผลลัพธ์ตอนจบ 4 แบบ: `user_fixed`, `normal_behavior`, `handoff_informed`, `handoff_unknown` (คำอธิบายแต่ละค่าอยู่ในคอมเมนต์ บรรทัด 21–27) |
| 30–35 | `ExternalReference` | อ้างอิงเอกสารภายนอก (document, section, page?, in_knowledge_base) — ไม่ได้ export ใช้ภายในไฟล์เท่านั้น |
| 38–48 | `BaseNode` | field ที่ทุกโหนดมีร่วมกัน: `node_id` (บังคับ) กับ `safety_critical`, `safety_warning`, `has_image`, `image_url`, `author_note`, `external_reference` (ไม่บังคับ) |
| 51–56 | `CheckpointNode` | มี `question`, `on_yes`, `on_no` (id ของโหนดถัดไปตามคำตอบ) |
| 59–63 | `InstructionNode` | มี `content`, `next` (ไปโหนดเดียวเสมอ) |
| 66–77 | `InputNode` | มี `prompt`, `input_type`, `pattern?` (regex ตรวจคำตอบ), `store_as` (ชื่อ key เก็บค่าใน `session.variables`), `next`, `on_invalid?` |
| 80–84 | `ResolutionNode` | โหนดจบ มี `content`, `outcome_kind` ไม่มีเส้นออก |
| 87–91 | `EscalationNode` | โหนดจบแบบส่งต่อช่าง โครงเหมือน Resolution |
| 93–98 | `TroubleshootingNode` | union ของโหนดทั้ง 5 โดยใช้ `type` เป็นตัวแยก (discriminated union) |

**ทำไมเขียนแบบนี้**: ให้ TypeScript ช่วยตรวจว่าแต่ละโหนดมี field ครบตามชนิด และให้ `switch (node.type)` ใน engine แคบ type อัตโนมัติ (อนุมานจากโค้ด; รูปแบบนี้ใช้ใน `traversal-engine.ts` บรรทัด 125 และ 209)
**หมายเหตุ**: ข้อความอธิบายในคอมเมนต์บรรทัด 9–10 ระบุว่ารูปร่างอ้างอิงจาก `data/schemas/troubleshooting-graph.v2.schema.json`

### บล็อก B — กราฟ 1 อัน และไฟล์คู่มือ (บรรทัด 100–152)
- **บรรทัด 104–109 `DeviceCategory`**: ประเภทเครื่อง 5 ค่า (Air Conditioner, Refrigerator, Washing Machine, Microwave, Television)
- **บรรทัด 111–112 `Severity`, `Difficulty`**: ระดับความรุนแรงและความยาก
- **บรรทัด 114–136 `TroubleshootingGraph`**: กราฟ 1 อาการ มี `schema_version: 2` (literal type), `graph_id`, `device_category`, `brand`, `model_pattern`, `entry_symptom` (+ `_th`, `_aliases` สำหรับค้นหา), `source`, `page_range`, `source_chunk_id`, `entry_node`, `nodes[]` ส่วน `config` (บรรทัด 133) เป็นแค่ provenance ที่มาของตัวเลข ไม่ถูก engine อ่าน (คอมเมนต์ 128–132)
- **บรรทัด 143–152 `ManualFile`**: รูปร่างไฟล์คู่มือ 1 ไฟล์ (เช่น `data/manuals/samsung_ac_ar70h.json`) ที่มี `graphs[]` หลายอัน

### บล็อก C — สถานะ session (บรรทัด 154–182)
- `SessionStatus` (158): `'in_progress' | 'completed'`
- `SessionHistoryEntry` (160–164): `nodeId` + `action?` (action ที่ใช้ออกจากโหนดนั้น)
- `SessionState` (166–182): `sessionId`, `graphId`, `currentNodeId`, `status`, `variables`, `confidence?`, `history[]`
- `confidence` (บรรทัด 180) คือคะแนน cosine ตอนค้นหาอาการ เป็น "แสดงผลอย่างเดียว" engine ไม่อ่านไปตัดสินใจ (คอมเมนต์ 173–179)

### บล็อก D — action ที่ผู้ใช้ส่งมา (บรรทัด 184–192)
`TraversalAction` เป็น union 4 แบบ: `answer` (yes/no), `continue`, `confirm_safety`, `input` (มี `value`) — 1 แบบต่อโหนด 1 ชนิด

### บล็อก E — ข้อมูลที่ส่งกลับให้ฝั่งแสดงผล (บรรทัด 194–219)
- `NodeReference` (198–201): `source` + `pageRange`
- `RenderedNode` (203–219): `nodeId`, `type`, `text` (แทน `{{ตัวแปร}}` แล้ว), `safetyCritical`, `safetyWarning?`, `requiresSafetyConfirmation`, `inputType?`, `isTerminal`, `outcomeKind?`, `reference`
- ข้อความบรรทัด 217 ระบุว่า reference ดึงจากระดับกราฟ ไม่ให้ LLM สร้างเอง

### บล็อก F — error class (บรรทัด 221–266)
| บรรทัด | class | เกิดเมื่อ |
|---|---|---|
| 226–231 | `TraversalError` | base class ของ error ทั้งหมด ตั้ง `this.name` เป็นชื่อ class |
| 234–238 | `UnsupportedSchemaVersionError` | กราฟไม่ใช่ `schema_version` 2 |
| 241–245 | `NodeNotFoundError` | อ้าง `node_id` ที่ไม่มีในกราฟ |
| 248–252 | `InvalidActionError` | action ไม่ตรงกับชนิดโหนด |
| 255–259 | `SafetyConfirmationRequiredError` | โหนด safety_critical แต่ส่ง `continue` |
| 262–266 | `SessionAlreadyCompletedError` | session จบแล้วแต่ยังส่ง action |

**ทำไม**: แยก error เป็น class เฉพาะเพื่อให้ชั้นบน (`traversal.exception.filter.ts`) แปลงเป็น HTTP status/รหัสข้อผิดพลาดได้ตามชนิด (อนุมานจากโค้ดและการใช้งานใน import graph)

## 3. การส่งข้อมูล

ไฟล์นี้ไม่ส่งข้อมูลเอง แต่เป็น "สัญญา" ที่ทุกไฟล์ใช้ร่วมกัน:
- กราฟ JSON จาก DB/ไฟล์ → ถูกแปลงเป็น `TroubleshootingGraph` โดย `graph.repository.ts`
- `SessionState` ↔ DB ผ่าน `session.store.ts`
- `RenderedNode` + `SessionState` ถูกส่งออกทาง REST เป็น JSON ให้ frontend (frontend นำ type เหล่านี้ไป re-export ใน `frontend/src/api/types.ts`)

ตัวอย่าง action: `{ "type": "answer", "value": "yes" }` / `{ "type": "input", "value": "E1" }`

## 4. จุดที่ควรระวัง

- ไฟล์นี้ไม่ใช่ "type ล้วน" เพราะมี class ที่รันจริง (บล็อก F) ดังนั้นถ้า frontend นำเข้าแบบไม่ใช่ `import type` ก็จะดึงโค้ด runtime ไปด้วย
- `this.name = this.constructor.name` (บรรทัด 229) พึ่งชื่อ class ตอนรัน ถ้าโค้ดถูก minify ในเบราว์เซอร์ ชื่ออาจถูกย่อ (อนุมานจากโค้ด)
- `DeviceCategory` ประกาศไว้ 5 ประเภท แต่ไฟล์คู่มือใน `data/manuals/` มีเพียงแอร์กับเครื่องซักผ้า (และ `data/index.json` ที่ไม่ทันสมัยระบุแค่แอร์) — ประเภทที่เหลือเป็นการเผื่อไว้ (อนุมานจากข้อมูล)
- คอมเมนต์บรรทัด 141 อ้างว่าการหยิบกราฟเป็นหน้าที่ของ retrieval "Phase 8" แต่ในโค้ดปัจจุบันงานนั้นอยู่ที่ `symptom-search` — คอมเมนต์อาจล้าสมัย
- `safety_critical` อยู่ใน `BaseNode` ทำให้โหนดทุกชนิดตั้งค่าได้ แต่คอมเมนต์บรรทัด 40 ระบุว่าใช้จริงกับ `instruction` เท่านั้น และ engine ก็บังคับเฉพาะ instruction (ดู `traversal-engine.ts` บรรทัด 136–148, 200)

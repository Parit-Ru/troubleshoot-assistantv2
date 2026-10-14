# backend/src/traversal-engine/traversal-engine.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของ "กฎ" ใน `traversal-engine.ts` โดยใช้ **กราฟจำลองขนาดเล็กที่สร้างในไฟล์นี้เอง** ไม่ใช้กราฟจริงจากคู่มือ — เหตุผล (คอมเมนต์ 6–8): เทสหนึ่งเคสควรพิสูจน์กฎหนึ่งข้อ ถ้าใช้กราฟจริง 16 โหนดแล้วเทสแดง จะแยกไม่ออกว่าพังเพราะ engine หรือข้อมูลกราฟเปลี่ยน ส่วนการเดินกราฟจริงอยู่ที่ `path-coverage.spec.ts`
มีทั้งหมด 37 เทส ใน 10 กลุ่ม

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `startSession`, `getCurrentNode`, `submitAction` จาก `./traversal-engine`; type และ error class จาก `./types`

## 2. อธิบายทีละบล็อก

### บล็อก A — ตัวช่วยสร้างกราฟ (บรรทัด 30–73)
- `makeGraph(nodes, entryNode, overrides?)` (38–57): สร้าง `TroubleshootingGraph` ที่ใส่ field บังคับครบ (`graph_id: 'test_graph'`, `source: 'TEST_MANUAL'`, `page_range: [43, 44]` ฯลฯ) ให้แต่ละเทสสนใจแค่ `nodes` กับ `entry_node`
- `resolved` (60–65): โหนดจบ `n_end` (resolution, `user_fixed`)
- `escalated` (68–73): โหนดจบ `n_call` (escalation, `handoff_unknown`)

### บล็อก B — 1) `startSession` (บรรทัด 79–122) — 5 เทส
เริ่มที่ `entry_node` พร้อมสถานะเริ่มต้น (`variables {}`, `history []`) · `sessionId` ไม่ซ้ำ · `reference` มาจากระดับกราฟ (`{source:'TEST_MANUAL', pageRange:[43,44]}`) · `schema_version = 1` → `UnsupportedSchemaVersionError` (จำลองด้วย cast) · `entry_node` ไม่มีจริง → `NodeNotFoundError`

### บล็อก C — 2) โหนด `checkpoint` (บรรทัด 128–178) — 5 เทส
`yes` → `on_yes`, `no` → `on_no` · ส่ง `continue` หรือ `input` ให้ checkpoint → `InvalidActionError` · `text` = `question` และ `isTerminal` false

### บล็อก D — 3) `instruction` ที่ไม่ใช่ safety_critical (บรรทัด 184–220) — 3 เทส
`continue` ไปต่อได้ · ส่ง `answer` → `InvalidActionError` · `requiresSafetyConfirmation` false, `safetyCritical` false, `safetyWarning` undefined

### บล็อก E — 4) 🔴 ด่านความปลอดภัย (บรรทัด 226–315) — 6 เทส
กราฟจำลอง `n_breaker` (instruction, `safety_critical`, มี `safety_warning`):
- 242: `continue` ถูกบล็อกด้วย `SafetyConfirmationRequiredError`
- 250: **session ไม่ขยับเมื่อถูกบล็อก** (`currentNodeId` เดิม, `status` `in_progress`, `history` ว่าง) — "หัวใจของข้ออ้างบังคับที่เซิร์ฟเวอร์" ถ้า engine บันทึกก่อนโยน error ผู้ใช้จะข้ามด่านด้วยการยิงซ้ำ
- 266: `confirm_safety` ผ่านไป `n_end`
- 273: ส่ง `answer` ก็ผ่านไม่ได้ (`InvalidActionError`) ไม่ใช่แค่ `continue` ที่ถูกกัน
- 281: ส่ง `requiresSafetyConfirmation` และ `safetyWarning` ให้หน้าจอครบ (บทเรียนจาก demo: กล่องเตือนขึ้นแต่ว่างเปล่า)
- 290: `checkpoint` ที่เผลอตั้ง `safety_critical` **ไม่** ทำให้ต้องยืนยัน (กฎ: มีผลกับ instruction เท่านั้น เพราะการตอบคำถามไม่มีอันตราย)

### บล็อก F — 5) โหนด `input` (บรรทัด 321–407) — 5 เทส
pattern `^[A-Za-z]{1,2}[0-9]{1,3}$`: ค่าตรง (`E1`) เดินต่อและเก็บลง `variables.error_code` · ค่าไม่ตรง (`ไม่รู้`) ไป `on_invalid` และไม่เก็บค่า · ไม่ระบุ `on_invalid` วนโหนดเดิม · ไม่ระบุ `pattern` รับทุกค่า (`'???'`) · `inputType` ส่งออกเป็น `error_code`

### บล็อก G — 6) การแทน `{{ตัวแปร}}` (บรรทัด 413–459) — 2 เทส
`{{error_code}}` ถูกแทนด้วย `E5` ในโหนดถัดไป · ตัวแปรที่ไม่มีค่าปล่อย `{{ไม่เคยเก็บ}}` ไว้ ไม่แทนด้วยช่องว่าง (ให้บั๊กเห็นชัด)

### บล็อก H — 7) โหนดจบ (บรรทัด 465–518) — 4 เทส
ถึง resolution/escalation แล้ว `status = 'completed'`, `isTerminal`, `outcomeKind` ถูกต้อง · ส่ง action หลังจบ → `SessionAlreadyCompletedError` · **เช็คสถานะจบก่อนเช็คความถูกต้องของ action** (ส่ง `input` ตอนจบแล้วต้องได้ `SessionAlreadyCompletedError` ไม่ใช่ `InvalidActionError`)

### บล็อก I — 8) ความเป็น pure function (บรรทัด 524–580) — 3 เทส
ไม่แก้ session เดิม (เทียบกับสำเนา JSON) และคืน object ใหม่ · ส่ง action เดิมซ้ำจาก session เดิมได้ผลเหมือนเดิม (คอมเมนต์ 551: นี่คือสิ่งที่ทำให้ระบบ "ผลลัพธ์ซ้ำได้" ต่างจาก LLM) · `history` สะสมตามลำดับ `[{nodeId:'a',action:continue},{nodeId:'b',action:continue}]`

### บล็อก J — 9) `getCurrentNode` และ 10) กราฟเสีย (บรรทัด 586–676) — 4 เทส
อ่านโหนดซ้ำได้โดยไม่เปลี่ยนสถานะ · แทนตัวแปรที่เก็บไว้ (`{{code}}` → `E7`) · `currentNodeId` ชี้โหนดที่ไม่มี → `NodeNotFoundError` · เส้น `on_yes` ชี้โหนดที่ไม่มี → `NodeNotFoundError` ตอน `submitAction` (ไม่เงียบหรือค้าง)

## 3. การส่งข้อมูล

```
Jest ─► makeGraph(...) (กราฟจำลองในหน่วยความจำ) ─► startSession / submitAction / getCurrentNode (function call) ─► ตรวจค่าที่คืน/error
```
ไม่มีไฟล์ข้อมูล / HTTP / DB

## 4. จุดที่ควรระวัง

- **ไม่มีเทสกรณี `entry_node` เป็นโหนดจบ**: เทส startSession ใช้กราฟที่โหนดเดียวเป็น `resolved` (บรรทัด 81) แต่ไม่ได้ตรวจ `status` จึงไม่ยืนยันว่า `startSession` ตั้ง `status` เป็น `in_progress` หรือ `completed` (อนุมานจากโค้ด `traversal-engine.ts` บรรทัด 56)
- **ไม่มีเทส regex เสีย**: ไม่มีกรณี `pattern` ผิดรูปที่ทำให้ `new RegExp` โยน `SyntaxError`
- **ไม่มีเทสกรณี `safetyWarning` ที่มี `{{ }}`**
- เทส 250 กลืน error ด้วย `catch {}` โดยตั้งใจเพื่อตรวจสถานะหลังจากนั้น

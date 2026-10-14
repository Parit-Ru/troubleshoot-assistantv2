# backend/src/traversal-engine/traversal-engine.ts

## 1. หน้าที่ของไฟล์

ตัวเดินกราฟแก้ปัญหาจริง: เริ่ม session ที่โหนดเริ่มต้น, ดูโหนดปัจจุบัน, และรับ action จากผู้ใช้เพื่อเดินไปโหนดถัดไป พร้อมบังคับด่านความปลอดภัย (safety gate) ทั้งหมดอยู่ในฟังก์ชันเดียว
เป็นฟังก์ชัน "บริสุทธิ์" (pure) คือไม่แก้ object เดิม คืนของใหม่เสมอ และไม่แตะ NestJS, DB หรือโมดูลเฉพาะ Node จึงรันได้ทั้ง server และเบราว์เซอร์ (คอมเมนต์บรรทัด 11–12)

- **ไฟล์ที่เรียกใช้ไฟล์นี้**: `traversal.service.ts` (ฝั่ง server), `frontend/src/mocks/mockServer.ts` (ฝั่งเบราว์เซอร์), และ spec 3 ไฟล์ (`traversal-engine.spec.ts`, `traversal-engine.confidence.spec.ts`, `path-coverage.spec.ts`)
- **ไฟล์ที่ไฟล์นี้เรียกใช้**: `./types.ts` เท่านั้น (type และ error class)

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 15–32)
นำเข้า type แบบ `import type` (บรรทัด 15–25) แยกจาก error class ที่ใช้ตอนรันจริง (บรรทัด 26–32) เพื่อให้ชัดว่าอะไรเป็นแค่ type อะไรเป็นโค้ดจริง

### บล็อก B — `startSession` (บรรทัด 38–63)
- **รับ**: `graph: TroubleshootingGraph`, `confidence: number | null = null`
- **คืน**: `{ session, node }` (session ใหม่ + โหนดแรกที่ render แล้ว)
- **ขั้นตอน**: ตรวจ schema (46) → หา `entry_node` (48) → สร้าง `SessionState` ใหม่ (50–60) โดยตั้ง `sessionId` จาก `globalThis.crypto.randomUUID()`, `status: 'in_progress'`, `variables: {}`, `history: []` → render โหนดแรก (62)
- **ทำไมใช้ `globalThis.crypto` แทน `node:crypto`**: คอมเมนต์ 51–52 บอกว่าเป็นมาตรฐานเว็บที่ Node 20+ มีให้ ทำให้รันในเบราว์เซอร์ได้ ผลลัพธ์เหมือนเดิม
- `confidence` แค่เก็บลง session ไม่ถูกอ่านไปตัดสินใจ (คอมเมนต์ 38–41)

### บล็อก C — `getCurrentNode` (บรรทัด 65–71)
- **รับ**: `session`, `graph` — **คืน**: `RenderedNode` ของ `session.currentNodeId`
- ใช้ตอนต้องการแสดงโหนดเดิมซ้ำ (เช่น refresh หน้าจอ ตามคอมเมนต์บรรทัด 7–8) ไม่เปลี่ยนสถานะอะไร

### บล็อก D — `submitAction` (บรรทัด 73–104) — หัวใจของไฟล์
ขั้นตอนตามลำดับ:
1. ตรวจ schema (78)
2. **ด่านแรก** (81–83): ถ้า `session.status === 'completed'` โยน `SessionAlreadyCompletedError` ไม่ว่า action จะเป็นอะไร
3. หาโหนดปัจจุบัน (85)
4. **ด่านที่สอง** (89): เรียก `resolveNextNode` — จุดเดียวที่เช็คว่า action ตรงกับชนิดโหนดและบังคับ safety gate
5. หาโหนดถัดไป (91) แล้วกำหนด status: ถ้าโหนดถัดไปเป็นโหนดจบ → `'completed'` ไม่เช่นนั้น `'in_progress'` (93)
6. สร้าง session ใหม่ด้วย spread (95–101): ย้าย `currentNodeId`, อัปเดต `variables`, ต่อท้าย `history` ด้วย `{ nodeId: โหนดที่เพิ่งออก, action }`
7. คืน `{ session: nextSession, node: renderNode(...) }` (103)

**ทำไม immutable**: ไม่แก้ session เดิม จึงเทสง่ายและถ้าบันทึก DB ล้มเหลว session เก่ายังอยู่ครบ (อนุมานจากโค้ด)

### บล็อก E — `findNode` (บรรทัด 106–113)
หาโหนดตาม `node_id` ด้วย `graph.nodes.find` (ค้นเชิงเส้น) ไม่พบโยน `NodeNotFoundError`

### บล็อก F — `resolveNextNode` (บรรทัด 120–178)
`switch (node.type)` ตัดสินว่า action นี้ใช้ได้ไหมและไปโหนดไหน:

| ชนิดโหนด | บรรทัด | กติกา |
|---|---|---|
| `checkpoint` | 126–134 | ต้องเป็น `answer` ไม่งั้น `InvalidActionError`; `yes` → `on_yes`, `no` → `on_no`; variables ไม่เปลี่ยน |
| `instruction` | 136–150 | ถ้า `safety_critical`: `continue` → `SafetyConfirmationRequiredError` (139–142), action อื่นที่ไม่ใช่ `confirm_safety` → `InvalidActionError`; ถ้าไม่ safety_critical ต้องเป็น `continue` เท่านั้น (146–148) แล้วไป `node.next` |
| `input` | 152–169 | ต้องเป็น `input`; ถ้าไม่มี `pattern` หรือค่าผ่าน regex → เก็บค่าที่ `variables[store_as]` แล้วไป `next`; ถ้าไม่ผ่าน → ไม่เก็บค่า ไป `on_invalid ?? node.node_id` (วนถามเดิม) |
| `resolution`, `escalation` | 171–176 | โยน `InvalidActionError` เสมอ (ปกติไม่ถึง เพราะ `submitAction` กันที่ status completed ไว้แล้ว ตามคอมเมนต์ 173–175) |

**จุดที่เป็น safety gate**: บรรทัด 137–148 — เซิร์ฟเวอร์บังคับเองไม่พึ่ง UI

### บล็อก G — `renderNode` (บรรทัด 184–206)
แปลงโหนดดิบ (snake_case) เป็น `RenderedNode` (camelCase) ที่หน้าจอใช้:
- `reference` ดึงจากระดับกราฟ (`graph.source`, `graph.page_range`) ทุกโหนดได้ที่มาเดียวกัน (189–192)
- `text` = ข้อความดิบผ่าน `interpolate` (197)
- `requiresSafetyConfirmation` = `type === 'instruction' && safety_critical === true` (200) — ค่านี้คือสิ่งที่ UI ใช้ตัดสินว่าต้องแสดงด่านคำเตือน
- `inputType` มีเฉพาะโหนด input (201); `isTerminal` และ `outcomeKind` มีเฉพาะโหนดจบ (202–203)

### บล็อก H — `getRawText` (บรรทัด 208–220)
เลือก field ข้อความตามชนิด: checkpoint→`question`, instruction/resolution/escalation→`content`, input→`prompt` (switch ครอบคลุมทุกกรณีจึงไม่ต้องมี default)

### บล็อก I — `isTerminalNode` (บรรทัด 222–225)
type guard บอก TypeScript ว่าโหนดที่ผ่านเป็น `ResolutionNode | EscalationNode` (เข้าถึง `.outcome_kind` ได้)

### บล็อก J — `interpolate` (บรรทัด 227–236)
แทน `{{key}}` ด้วยค่าใน `variables` โดย regex `/\{\{(\w+)\}\}/g` ถ้าไม่มี key จะ "ปล่อย `{{key}}` ไว้ตรงๆ" แทนที่จะแทนด้วยค่าว่าง เพื่อให้บั๊กเห็นชัด (คอมเมนต์ 229–230) ใช้ `hasOwnProperty.call` กัน key พิเศษของ prototype

### บล็อก K — `assertSupportedSchema` (บรรทัด 238–247)
เช็ค `schema_version !== 2` ตอนรันจริง เพราะข้อมูลมาจาก `JSON.parse` ที่ TypeScript ตรวจให้ไม่ได้ (คอมเมนต์ 239–242) ถูกเรียกต้นทุกฟังก์ชัน export

## 3. การส่งข้อมูล

- **เข้า**: `TroubleshootingGraph` (โหลดจาก DB โดย `graph.repository.ts` หรือจากไฟล์ JSON ฝั่ง mock), `SessionState` (โหลดจาก `session.store.ts`), `TraversalAction` (มาจาก body ที่ `traversal.dto.ts` ตรวจแล้ว)
- **ออก**: `{ session, node }` ผ่านการ return ของฟังก์ชัน (function call ธรรมดา ไม่มี I/O) แล้ว `traversal.service.ts` บันทึก session และส่งเป็น JSON ผ่าน HTTP

ตัวอย่างการเดิน: โหนด `checkpoint` + `{ "type":"answer","value":"no" }` → `nextNodeId = on_no` และ `history` เพิ่ม `{ nodeId: "n2", action: {type:"answer",value:"no"} }`

## 4. จุดที่ควรระวัง

- **regex จากข้อมูล** (บรรทัด 156): `new RegExp(node.pattern)` สร้างจากข้อมูลในกราฟ ถ้า pattern ผิดรูปจะโยน `SyntaxError` (ไม่ใช่ `TraversalError`) และ pattern ไม่ถูกบังคับให้มี `^…$` ครอบ ผลจึงขึ้นกับว่าข้อมูลเขียน pattern ไว้อย่างไร (อนุมานจากโค้ด)
- **`startSession` ตั้ง `status: 'in_progress'` เสมอ** (56) แม้โหนดเริ่มต้นเป็นโหนดจบ ในกรณีนั้น session จะค้างที่ in_progress และ `submitAction` จะโยน `InvalidActionError` — ปกติไม่เกิดถ้ากราฟผ่าน `validate_graph.py` (อนุมานจากโค้ด)
- **`safetyWarning` ไม่ผ่าน `interpolate`** (199) ต่างจาก `text` (197)
- **โหนดที่ไม่ใช่ instruction ที่ตั้ง `safety_critical: true`** จะทำให้ `safetyCritical` เป็น true ในผล render แต่ไม่มีด่านบังคับ (200 และ 126–134)
- `getCurrentNode` ไม่ตรวจ `status` ของ session
- `findNode` ค้นเชิงเส้น เหมาะกับกราฟขนาดเล็กในชุดข้อมูลนี้
- `globalThis.crypto.randomUUID()` ในเบราว์เซอร์ต้องอยู่ใน secure context (HTTPS หรือ localhost) (อนุมานจากข้อกำหนดของ Web Crypto)

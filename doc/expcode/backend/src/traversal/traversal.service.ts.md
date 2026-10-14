# backend/src/traversal/traversal.service.ts

## 1. หน้าที่ของไฟล์

ชั้น service ที่ "ต่อสาย" `GraphRepository`, `EquipmentRepository`, `SessionStore` และ `SymptomSearchService` เข้ากับ engine เดินกราฟ มี 6 เมธอดตรงกับ 6 endpoint ของ controller
**กฎของโครงงาน** (คอมเมนต์ 5–8): ไฟล์นี้ห้ามมีตรรกะเปลี่ยนสถานะเอง การตัดสินว่าขั้นถัดไปคืออะไรและ action ใช้ได้ไหมต้องมาจาก `startSession/getCurrentNode/submitAction` ของ engine เท่านั้น หน้าที่คือหาข้อมูลป้อน engine ส่งต่อผล และบันทึก

- **ใครเรียกใช้**: `traversal.controller.ts`, `traversal.module.ts`, `traversal.exception.filter.ts` (import error class), `traversal.service.spec.ts`, `traversal.exception.filter.spec.ts`
- **เรียกใช้**: `graph.repository`, `equipment.repository`, `session.store`, `symptom-search.service` (`scoreGraph`), `traversal.dto` (type), `traversal-engine/traversal-engine` และ `traversal-engine/types`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 15–33)
นำเข้า engine พร้อมตั้งชื่อใหม่ `startSession as engineStartSession`, `submitAction as engineSubmitAction` เพื่อไม่ชนกับชื่อเมธอดของ service

### บล็อก B — error ของ service (บรรทัด 35–76)
4 คลาสที่ extend `Error` (ไม่ extend `TraversalError` เพราะไม่ได้มาจาก engine — คอมเมนต์ 38–42):
- `GraphNotFoundError` (45–50) → filter แปลงเป็น 404
- `SessionNotFoundError` (52–57) → 404 (ครอบคลุมทั้งไม่เคยมีและหมดอายุ)
- `SessionNotCompletedError` (63–68) → 409 (บันทึกผลลัพธ์ได้เฉพาะ session ที่จบแล้ว)
- `OutcomeAlreadySubmittedError` (71–76) → 409

### บล็อก C — constructor (บรรทัด 78–85)
ฉีด `GraphRepository`, `EquipmentRepository`, `SessionStore`, `SymptomSearchService`

### บล็อก D — `listGraphs()` (บรรทัด 91–94)
คืน `graphRepository.listAll()` (ไม่ async)

### บล็อก E — `startSession(graphId, query?)` (บรรทัด 96–107)
1. `requireGraph` (98) 2. `computeConfidence` (99) 3. `engineStartSession(graph, confidence)` (103) 4. `sessionStore.create(session)` (104) 5. `toResponse` (106)
- ถ้า engine โยน error `create()` ไม่ถูกเรียก จึงไม่มี session ค้างครึ่งๆ กลางๆ (คอมเมนต์ 101–102)

### บล็อก F — `getSession(sessionId)` (บรรทัด 109–122)
`requireSession` → `requireGraph(session.graphId)` → `getCurrentNode` → ถ้า `status === 'completed'` จึงอ่าน `findOutcome` (ไม่เช่นนั้น `null`) → `toResponse` (คอมเมนต์ 116–117: ไม่เสีย SQL เพิ่มกับการเดินปกติและ engine ไม่เห็นค่านี้)

### บล็อก G — `submitAction(sessionId, action)` (บรรทัด 124–145) — ด่านความปลอดภัยหลัก
1. โหลด session และ graph (132–133)
2. `engineSubmitAction(session, graph, action)` (135) — ถ้าโยน error (เช่น `SafetyConfirmationRequiredError`) โค้ดออกจากฟังก์ชันทันที `sessionStore.update()` ไม่ถูกรัน session ใน DB จึงไม่ขยับ ไม่ต้องมีโค้ด "ย้อนสถานะ" (คอมเมนต์ 10–12, 127–130)
3. `sessionStore.update(result.session, { nodeId: session.currentNodeId, action })` (139–142) — `nodeId` ที่บันทึกคือโหนดที่ "ออกจาก" ไม่ใช่โหนดที่เพิ่งไปถึง (คอมเมนต์ 138)
4. `toResponse(result.session, result.node, graph)` (144)

### บล็อก H — `abandonSession` (บรรทัด 147–156)
`requireSession` ก่อนลบ จึงยกเลิกซ้ำครั้งที่สองได้ 404 ไม่ใช่ 204 เงียบๆ (ตรงกับพฤติกรรม mockServer ฝั่งหน้าจอ) แล้ว `sessionStore.delete`

### บล็อก I — `submitOutcome(sessionId, text)` (บรรทัด 158–191)
ลำดับตรวจ (คอมเมนต์ 165–168):
1. หา session (177) → ไม่พบ 404 `SESSION_NOT_FOUND`; หา graph (178)
2. `status !== 'completed'` → `SessionNotCompletedError` (180–182)
3. `saveOutcome` (184) → ได้ `false` → `OutcomeAlreadySubmittedError` (185–187)
4. `getCurrentNode` แล้ว `toResponse(..., text)` (189–190)
- ข้อ 3 ไม่เช็คก่อนเขียน ปล่อยให้ `UPDATE` คำสั่งเดียวตัดสินแบบ atomic (คอมเมนต์ 170–172) ไม่เรียก engine ที่เปลี่ยนสถานะ

### บล็อก J — ตัวช่วยภายใน (บรรทัด 193–251)
- `requireGraph` (198–202): คืนกราฟหรือโยน `GraphNotFoundError`
- `requireSession` (205–209): คืน session หรือโยน `SessionNotFoundError`
- `toResponse(session, node, graph, outcome = null)` (215–233): ประกอบ `SessionResponseDto` โดย `equipment` = `equipmentRepository.findByCategory(graph.device_category)`, `confidence = session.confidence ?? null`, `outcome` ส่งมาจากผู้เรียก (engine ไม่มีฟิลด์นี้)
- `computeConfidence(graphId, query?)` (244–251): ไม่มี `query` → `null`; มี → `symptomSearch.scoreGraph(query, graphId)`; ถ้าระบบค้นหาไม่พร้อมหรือล้ม → `null` (จับทุก error ด้วย `catch {}`) ไม่แต่งตัวเลข และไม่ทำให้การเริ่ม session ล้ม

## 3. การส่งข้อมูล

```
Controller → Service.submitAction
   ├─ SessionStore.find  (DB: sessions + session_history)  → SessionState
   ├─ GraphRepository.findById (หน่วยความจำ)                → TroubleshootingGraph
   ├─ engineSubmitAction (pure function)                    → { session, node }   ← ด่านความปลอดภัยอยู่ที่นี่
   ├─ SessionStore.update (transaction)                     → DB
   └─ toResponse + EquipmentRepository.findByCategory       → SessionResponseDto → JSON
```

## 4. จุดที่ควรระวัง

- **อ่านแล้วเขียนโดยไม่ล็อก** (`find` → engine → `update`): สองคำขอพร้อมกันบน session เดียวอาจคำนวณจากสถานะเดียวกัน ตัวที่แพ้จะชน UNIQUE KEY `(session_id, step_order)` ใน `session_history` แล้วได้ 500 (ตามที่ `session.store.ts` ยอมรับไว้)
- **`catch {}` ใน `computeConfidence` กลืน error ทุกชนิด** (บรรทัด 248–250) รวมถึงบั๊กของโค้ดค้นหา ผู้ใช้จะเห็นแค่ `confidence: null` ไม่มี log ในจุดนี้ (อนุมานจากโค้ด)
- **`submitOutcome`: `saveOutcome` คืน `false` ถูกตีความว่า "บันทึกไปแล้ว" เสมอ** (บรรทัด 185–187) แต่ `false` ก็เกิดได้ถ้า session ถูกลบ/ไม่ completed ระหว่างขั้นตอน (race) — คอมเมนต์ 171–172 ยอมรับกรณีหนึ่งไว้แล้ว
- `getSession` ไม่ต่ออายุ session (การต่ออายุเกิดตอน `update` เท่านั้น)
- `submitAction` ที่ทำให้ session จบ ตอบ `outcome: null` เสมอ (ถูกต้องเพราะยังไม่เคยมีผลลัพธ์ — คอมเมนต์ 228–231)

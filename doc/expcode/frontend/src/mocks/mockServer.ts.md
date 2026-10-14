# frontend/src/mocks/mockServer.ts

## 1. หน้าที่ของไฟล์

"เซิร์ฟเวอร์จำลอง" ที่รันในเบราว์เซอร์ตอนพัฒนา (เมื่อ `VITE_USE_MOCK === 'true'`) : จำลองเฉพาะชั้น HTTP โดย **ใช้ engine เดินกราฟของ backend ตัวเดียวกัน** (`traversal-engine.ts`) กับไฟล์ผัง `samsung_ac_ar70h.json` และ `equipment.json` ตัวเดียวกับ backend จึงไม่มีตรรกะเครื่องสถานะซ้ำสองชุด (เหตุผลในคอมเมนต์ 7–8: ถ้ามีสองชุดแล้วเพี้ยนกัน หน้าจอจะโกหกเรื่องด่านความปลอดภัย) session ทั้งหมดเก็บในหน่วยความจำของแท็บ (กด F5 หาย)

- **ใครเรียกใช้**: `api/traversal.ts` (ผ่าน `await import(...)` ใต้เงื่อนไข `VITE_USE_MOCK`), `mockServer.test.ts`
- **เรียกใช้**: `backend/src/traversal-engine/{types, traversal-engine}`, `backend/src/traversal/traversal.dto` (`parseOutcomeBody`, `InvalidOutcomeError`), `data/manuals/samsung_ac_ar70h.json`, `data/equipment/equipment.json`, `../api/http` (`ApiError`), `../api/types`
- ⚠️ ไฟล์นี้ต้องไม่หลุดเข้า build จริง (คอมเมนต์ 10–11)

## 2. อธิบายทีละบล็อก

### บล็อก A — import และข้อมูลตอนโหลด (บรรทัด 17–99)
- error class ของ engine import แบบปกติ (เป็น class จริง) ; ตัวตรวจ body ผลลัพธ์ใช้ของ backend ตรงๆ ไม่เขียนกฎซ้ำ
- `manual` (62) = ไฟล์ผังแอร์ ; `graphs` (65) = `Map` ตาม `graph_id` เลียนแบบ `GraphRepository` ; `sessions` (74) = `Map<string, SessionState>` ; `outcomes` (83) = `Map<string, string>` เก็บแยกเหมือน backend ; `equipmentFile` (99)

### บล็อก B — ตัวช่วย (บรรทัด 101–199)
- `DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 300` และ `delay()` (109–114): หน่วง 300 ms ให้เห็นสถานะโหลด ; ตอนเทสเป็น 0
- `equipmentFor(graph)` (120–134): หารายการอุปกรณ์ตามประเภทเครื่อง ประเภทที่ไม่มีข้อมูลคืน `[]`
- `toApiError(error)` (142–159): แปลง error ของ engine เป็น `ApiError` — `SafetyConfirmationRequiredError`→400 `SAFETY_CONFIRMATION_REQUIRED`, `InvalidActionError`→400 `INVALID_ACTION`, `SessionAlreadyCompletedError`→409 `SESSION_COMPLETED`, `NodeNotFoundError`→500 `GRAPH_NODE_MISSING`, `UnsupportedSchemaVersionError`→500 `GRAPH_SCHEMA_UNSUPPORTED`, อื่นๆ→500 `UNKNOWN_ERROR` (ตารางนี้เป็น "สัญญา" ที่ backend จริงต้องตรงกันทุกแถว)
- `toResponse(session, node, graph, outcome = null)` (168–183): ประกอบ `SessionResponse` โดย `confidence` เป็น `null` เสมอ
- `requireGraph`, `requireSession` (185–199): โยน `ApiError` 404 `GRAPH_NOT_FOUND` / `SESSION_NOT_FOUND`

### บล็อก C — ฟังก์ชันต่อ endpoint (บรรทัด 201–344)
| ฟังก์ชัน | พฤติกรรม |
|---|---|
| `listGraphs()` | map ทุกกราฟเป็น `GraphSummary` (ลอกจาก `listAll()`) |
| `searchSymptoms()` | **โยน 503 `SEARCH_UNAVAILABLE` เสมอ** ไม่แต่งผลค้นหาปลอม (เหมือนเซิร์ฟเวอร์จริงตอนปิดสวิตช์) ไม่รับ query |
| `startSession(graphId)` | `engineStartSession(graph)` (ไม่ส่ง confidence) เก็บใน `sessions` |
| `getSession(id)` | `getCurrentNode` + outcome (ถ้ามี) |
| `submitAction(id, action)` | `engineSubmitAction`; ถ้า engine โยน error → `catch` → `sessions.set` ไม่ถูกรัน สถานะไม่ขยับ |
| `submitOutcome(id, text)` | ลำดับตรวจเหมือน backend: (1) `parseOutcomeBody` → 400 `INVALID_OUTCOME` (2) หา session → 404 (3) ยังไม่จบ → 409 `SESSION_NOT_COMPLETED` (4) เคยบันทึก → 409 `OUTCOME_ALREADY_SUBMITTED` ; ไม่เรียก engine ที่เปลี่ยนสถานะ |
| `abandonSession(id)` | ตรวจว่ามี session แล้วลบทั้ง `sessions` และ `outcomes` |

## 3. การส่งข้อมูล

```
traversal.ts ─(VITE_USE_MOCK==='true')─► mockServer.* ─► engine (function call) ─► Map ในหน่วยความจำ
                                                       └► โยน ApiError (รูปแบบเดียวกับ http.request)
```
ไม่มี HTTP จริง

## 4. จุดที่ควรระวัง

- **ไม่ตรวจ body ของ action ด้วย `parseTraversalAction`** และไม่จำกัดความยาวค่า `input` (255) เหมือน backend — ใน mock ค่าผิดรูปจะไปถึง engine ตรงๆ (อนุมานจากโค้ด)
- **ไม่มี TTL ของ session** และไม่รองรับ `query` / `confidence` (`startSession` ไม่รับ query ; `toResponse` ใส่ `confidence: null`)
- **ไม่มีทางจำลอง `/health`** (`getHealth` ไม่ผ่านไฟล์นี้)
- นำเข้า JSON จากโฟลเดอร์นอก `frontend/` (`../../../data/…`) โดยตรง และคอมเมนต์ 13–14 อ้างว่าเป็น "จุดเดียวที่ import ของใน backend และ data" ทั้งที่ `api/types.ts` ก็ import type จาก backend เช่นกัน (ต่างกันตรงที่ type ล้วนไม่ติด build)
- ถ้า tree-shaking ล้มเหลว ข้อมูลผังและโค้ด engine จะเข้า bundle จริง (ตามคำเตือนใน `traversal.ts`)

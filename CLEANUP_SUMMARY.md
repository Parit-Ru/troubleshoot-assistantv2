# สรุปการ Clean up และ Simplify โปรเจกต์

วันที่ทำ: 7 ตุลาคม 2569 (2026-10-07)
เงื่อนไข: code ต้องทำงานเหมือนเดิมทุกอย่าง (behavior เดิม, output เดิม) ไม่เพิ่ม feature ไม่เปลี่ยนเวอร์ชัน dependency และไม่รันคำสั่ง git ที่เปลี่ยนประวัติ

## ภาพรวม

ซอร์สสะอาดอยู่แล้ว เพราะผ่านรอบ refactor มาก่อน (ดู `backend/docs/explained/14-19`) ตรวจแล้วไม่พบ unused import/local variable, โค้ดที่ comment ทิ้งไว้ หรือ TODO ที่ค้างอยู่
การแก้ไขรอบนี้จึงเน้นที่ **โค้ดซ้ำ**, **โค้ดที่ไม่มีใครเรียก** และ **การเขียนให้อ่านง่ายขึ้น** รวมแก้ 11 ไฟล์ เพิ่ม 2 ไฟล์

## วิธีที่ใช้หา

1. อ่านโค้ดทั้งโปรเจกต์: backend (NestJS), frontend (React + Vite), `scripts/` (Python) และ `backend/scripts/` (Node)
2. `tsc --noUnusedLocals --noUnusedParameters` ทั้งสองฝั่ง ผลคือไม่พบอะไร
3. สคริปต์หา export ที่ไม่มีใครอ้างอิง พบแค่ `ManualFile`, `instructionNode`, `inputNode` ซึ่งเทสใช้อยู่ จึงเก็บไว้
4. grep หา `console.*`, `debugger`, `TODO`, `FIXME` และโค้ดที่ comment ทิ้งไว้ พบแค่ `console.log` ตอนเปิดเซิร์ฟเวอร์ใน `main.ts` ซึ่งเป็น output ปกติ
5. สคริปต์ตรวจ Python ด้วย `ast` หา import และฟังก์ชันที่ไม่ถูกเรียก (เพราะไม่ได้ติดตั้ง pyflakes)

## สิ่งที่ลบ/แก้

### Backend

| ไฟล์ | สิ่งที่ทำ | เหตุผล |
|---|---|---|
| `backend/src/traversal-engine/traversal-engine.ts` | เพิ่ม helper `findNode(graph, nodeId)` แล้วใช้แทนโค้ด `graph.nodes.find(...)` + `throw new NodeNotFoundError(...)` ที่เขียนซ้ำ 4 ที่ (`startSession`, `getCurrentNode`, `submitAction` x2) | รวมโค้ดซ้ำ ลำดับการตรวจและ error ที่โยนเหมือนเดิม |
| `backend/src/symptom-search/embedding.service.ts` | ลบ getter `isLoaded` และแก้ spacing `MODEL_CACHE_DIR =path...` | `isLoaded` ไม่มีที่ไหนเรียกเลย (ตรวจใน src, spec และ scripts แล้ว) |
| `backend/src/symptom-search/symptom-matcher.ts` | เขียน nested ternary ใน comparator ของ `rankGraphs` เป็น `if` ธรรมดา | อ่านง่ายสำหรับมือใหม่ ลำดับผลลัพธ์เท่าเดิม |
| `backend/src/database/database.module.ts` | เพิ่มบรรทัดว่างก่อน `@Global()` และลบช่องว่างท้ายบรรทัดใน comment | จัด format เท่านั้น |

### Frontend

| ไฟล์ | สิ่งที่ทำ | เหตุผล |
|---|---|---|
| `frontend/src/mocks/mockServer.ts` | เพิ่ม `toResponse(session, node, graph, outcome)` แทน object response ที่เขียนซ้ำ 4 ที่ (`startSession`, `getSession`, `submitAction`, `submitOutcome`) | รวมโค้ดซ้ำ และตรงกับ `toResponse` ใน `traversal.service.ts` ของ backend |
| `frontend/src/lib/useSlowWait.ts` (ไฟล์ใหม่) | hook `useSlowWait(isWaiting)` รวมค่าคงที่ 4000 ms, state และ effect ตั้งเวลา | logic นี้เขียนซ้ำใน `SessionPage` กับ `SymptomsPage` |
| `frontend/src/components/SlowServerNotice.tsx` (ไฟล์ใหม่) | component กล่องข้อความ "เซิร์ฟเวอร์กำลังเริ่มทำงาน" | ข้อความซ้ำใน 2 หน้า |
| `frontend/src/pages/SessionPage.tsx` | ใช้ `useSlowWait` + `SlowServerNotice` แทนโค้ดเดิม ลบ import `Notice` ที่ไม่ใช้แล้ว | ตำแหน่งเรียก hook เหมือนเดิม (ก่อน early return) |
| `frontend/src/pages/SymptomsPage.tsx` | เช่นเดียวกัน และลบ import `useEffect` ที่ไม่ใช้แล้ว | |
| `frontend/src/components/ui/Button.tsx` | แก้ `type ButtonVariant ='...'` และเว้นบรรทัดที่ติดกัน | จัด format |
| `frontend/src/components/ui/Notice.tsx` | แก้ `type NoticeTone ='...'` | จัด format |

### Python และอื่นๆ

| ไฟล์ | สิ่งที่ทำ | เหตุผล |
|---|---|---|
| `scripts/validate_graph.py` | ลบฟังก์ชัน `validate_file` | ไม่มีใครเรียก (ทั้ง `main()` และไฟล์อื่น) และโค้ดข้างในซ้ำกับ `validate_manual` |
| `scripts/validate_graph.py` | แก้ docstring ส่วน Usage ให้ตรงกับการใช้งานจริง (เดิมอ้าง `validate_graph_v2.py`) และแก้ `print(f"Schema v2 loaded")` เป็น `print("Schema v2 loaded")` | ข้อความเดิมล้าสมัย / f-string ไม่มีตัวแปร output เท่าเดิม |
| `.gitignore` | ลบ `__pycache__/` และ `*.pyc` ที่ซ้ำ | `*.py[cod]` และ `__pycache__/` ในหมวด Python cache ครอบคลุมแล้ว |

## ผล test/build เทียบกับ baseline

| รายการ | ก่อนแก้ | หลังแก้ |
|---|---|---|
| backend jest | 10 suites / 183 tests ผ่าน | 10 suites / 183 tests ผ่าน |
| backend `tsc --noEmit` | สะอาด | สะอาด (เปิด noUnusedLocals/Parameters) |
| frontend vitest | 8 files / 84 tests ผ่าน | 8 files / 84 tests ผ่าน |
| frontend `tsc -b` | สะอาด | สะอาด |
| frontend eslint | สะอาด | สะอาด |
| frontend `vite build` | สำเร็จ JS 310.74 kB | สำเร็จ JS 310.37 kB (CSS ไฟล์เดิม) |
| `validate_graph.py --all` | exit 1 | exit 1 และ output เหมือนเดิมทุกไบต์ (เทียบ hash) |
| `simulate_paths.py --all` | exit 0 | exit 0 และ output เหมือนเดิมทุกไบต์ (เทียบ hash) |

**หมายเหตุ:** `validate_graph.py --all` ล้มเหลวอยู่แล้วก่อนแก้ ประมาณ 58 บรรทัดขึ้น `FAIL` (ส่วนที่เห็นคือกราฟเครื่องซักผ้า `oid84209_*`) เรื่องนี้ไม่เกี่ยวกับการ clean up และไม่ได้แก้ข้อมูล ควรตรวจแยกต่างหาก

## ส่วนที่ตั้งใจไม่แตะ

| ส่วน | เหตุผล |
|---|---|
| สคริปต์ใน `backend/scripts/` และ `scripts/` | ทุกไฟล์ถูกอ้างอิงจาก README/docs และใช้รันมือ ไม่ได้ถูก import จากโค้ดแอป |
| `connectionConfig()` ที่ซ้ำใน `seed-graphs.js`, `seed-equipment.js` (และคล้ายกันใน `run-migrations.js`, `show-session-history.js`) | รวมได้ แต่สคริปต์เหล่านี้เขียนลงฐานข้อมูล MySQL จริง ไม่ได้รันทดสอบ และแต่ละไฟล์ต่างกันเล็กน้อย |
| `instructionNode`, `inputNode` ใน `mocks/fixtures.ts` | ใช้แค่ใน `trail.test.ts` แต่ลบแล้วเทสจะพัง |
| `ManualFile` ใน `types.ts` | ใช้ใน spec และ `mockServer.ts` |
| `console.log` ใน `main.ts` | เป็นข้อความตอนเปิดเซิร์ฟเวอร์ ไม่ใช่ debug log |
| `toErrorBody` ของสอง exception filter และ `parse*Body` ใน DTO | ซ้ำกันบางส่วน แต่ error class ต่างกัน และ filter ต่างกันที่เงื่อนไข log (`>= 500` กับ `=== 500`) ถ้ารวมจะเปลี่ยน behavior |
| `package.json` และ dependency ทั้งหมด | ห้ามเปลี่ยนตามเงื่อนไข |
| `ROADMAP.md`, README/docs, โฟลเดอร์ `repository-backup.git` | ไม่ใช่โค้ด หรือเป็นงานที่ยังไม่ commit ของคุณ (`ROADMAP.md`) |

## สิ่งที่ควรรู้

- **งานที่ยังไม่ commit เดิม:** ก่อนเริ่มมีไฟล์ที่ถูกแก้ค้างอยู่ 3 ไฟล์ คือ `ROADMAP.md`, `database.module.ts` และ `traversal-engine.ts` (แทน `buildNodeIndex` ด้วย `find` และแทน `filter` ด้วย loop) รอบนี้แก้ต่อบนไฟล์ปัจจุบันในทิศทางเดียวกัน ไม่ได้ทับงานเดิม
- **ไม่ได้ทดสอบ UI ในเบราว์เซอร์:** หน้า `SessionPage` และ `SymptomsPage` ไม่มีเทสระดับหน้า ตรวจได้ด้วย type-check, eslint และ build เท่านั้น การแก้เป็นการย้ายโค้ดแบบ 1:1 และคงลำดับ hook เดิม แต่ควรลองกดใช้งานจริงสักรอบ โดยเฉพาะกรณีรอเซิร์ฟเวอร์เกิน 4 วินาที (กล่อง "เซิร์ฟเวอร์กำลังเริ่มทำงาน")
- **ไฟล์สำรอง:** ซอร์สก่อนแก้ถูกสำรองไว้ที่ `C:\Users\SPS\AppData\Local\Temp\claude\c--Users-SPS-Desktop-499\ce94846e-da9c-462f-869e-d574c36663ef\scratchpad\backup` (เป็นโฟลเดอร์ชั่วคราวของ session อาจถูกลบเมื่อเครื่องล้างไฟล์ temp)
- **ไม่มีการ commit/push:** การเปลี่ยนแปลงทั้งหมดอยู่ใน working directory ดูได้ด้วย `git status` และ `git diff`

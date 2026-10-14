# backend/src/traversal/traversal.service.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของ `TraversalService` ด้วย repository/store ปลอมที่เก็บในหน่วยความจำ รันได้โดยไม่ต่อ MySQL ตัวปลอมสร้างจากไฟล์ข้อมูลจริงชุดเดียวกับที่ `mockServer.ts` ฝั่ง frontend ใช้ (`data/manuals/samsung_ac_ar70h.json`, `data/equipment/equipment.json`) แล้ว "ลอก 10 กรณี" จาก `frontend/src/mocks/mockServer.test.ts` ตรงๆ
**เหตุผลที่ต้องลอกให้ตรง** (คอมเมนต์ 11–13): mock กับ service จริงต้องพฤติกรรมเดียวกันทุกกรณี เพราะ mock คือสิ่งที่หน้าจอใช้พัฒนามาตลอด ถ้าเพี้ยนกัน หน้าจอจะ "โกหก" ผู้ใช้เรื่องด่านความปลอดภัยโดยไม่มีใครรู้จนกว่าจะต่อเซิร์ฟเวอร์จริง
เทสชุดนี้พิสูจน์แค่ตรรกะของ `TraversalService` ไม่พิสูจน์ transaction ของ `SessionStore` กับ MySQL จริง (พิสูจน์แยกต่างหาก ตามคอมเมนต์ 15–17)

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `TraversalService` + error 4 ตัวจาก `./traversal.service`, `SafetyConfirmationRequiredError`/`SessionAlreadyCompletedError` จาก engine `types`, type ของ repository/store/`SymptomSearchService`, และไฟล์ข้อมูลทั้งสอง

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ที่ล้าสมัย (บรรทัด 19–20)
ข้อความว่า "npm test ล้มในตอนนี้ เพราะยังไม่มีไฟล์ traversal.service.ts (เขียนเทสก่อนเขียนโค้ดจริง)" เป็นร่องรอยของขั้นตอนเขียนเทสก่อน ปัจจุบันมีไฟล์ service แล้ว (อนุมานจากการมี `traversal.service.ts`)

### บล็อก B — โหลดข้อมูลจริง (บรรทัด 49–78)
อ่านด้วย `fs.readFileSync` + `JSON.parse` ไม่ใช้ `import` ตรงๆ เพราะ `backend/tsconfig.json` ไม่ได้เปิด `resolveJsonModule` และ `rootDir` ผูกกับ `backend/src` (คอมเมนต์ 52–56) ; ประกาศ `interface EquipmentFile` เฉพาะ field ที่ใช้

### บล็อก C — ตัวปลอมของชั้นข้อมูล (บรรทัด 80–214)
ไม่ extends ของจริงเพราะของจริงมี private `pool` ต้องใช้ `mysql2.Pool`; สร้าง "หน้าตาเดียวกัน" แล้ว cast ผ่าน `unknown`
- `FakeGraphRepository` (92–114): `findById`, `listAll` (ลอกจากของจริง)
- `FakeEquipmentRepository` (116–134): `findByCategory` (ลอกจาก `equipmentFor()` ของ mockServer)
- `FakeSessionStore` (137–187): เก็บ session ใน `Map`; `outcomes` แยกต่างหาก; `saveOutcome` ลอกเงื่อนไขของ UPDATE จริง (ต้องจบแล้วและยังไม่มีผลลัพธ์); `findOutcomeCalls` นับการเรียก; `storedOutcome` ให้เทสดูตรงๆ
- `FakeSymptomSearch` (193–202): มีแค่ `scoreGraph` เก็บประวัติ `calls`
- `makeService(search?, store?)` (204–214): ประกอบ `TraversalService`

### บล็อก D — ค่าคงที่และ `walk` (บรรทัด 216–233)
`STOPS_WORKING = 'samsung_ac_ar70h_stops_working'`, `ERROR_MESSAGE = 'samsung_ac_ar70h_error_message'`, `WATER_DRIPS = 'samsung_ac_ar70h_water_drips_outdoor'`, `YES`; `walk(service, graphId, actions)` เริ่ม session แล้วส่ง action ทีละตัว

### บล็อก E — `describe('TraversalService')` (บรรทัด 239–340) — 10 เทส (ลอกจาก mockServer.test.ts)
| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 240 | `listGraphs` คืน 13 อาการและทุกอาการมีชื่อไทย |
| 248 | เริ่ม session ได้โหนด `n1`, `in_progress`, และอุปกรณ์ 7 รายการ |
| 258 | **เทสสำคัญที่สุด**: เดิน yes,yes ถึง `n_fix_breaker` (requiresSafetyConfirmation) ส่ง `continue` → ถูกปฏิเสธด้วย `SafetyConfirmationRequiredError` ตรงๆ (ไม่ใช่ error ที่ service ห่อ) และอ่านซ้ำแล้วยังอยู่โหนดเดิม |
| 277 | `confirm_safety` แล้วเดินต่อถึง `n_recheck_breaker` |
| 285 | กรอกรหัสผิดรูป (`'12'`) → ไปโหนด `n_invalid_code` ยัง `in_progress` ไม่ใช่ error (service ห้ามตรวจรูปแบบเอง) |
| 295 | กรอก `E1` → หน้าจบ `handoff_informed` ข้อความมี `E1` และไม่มี `{{` ค้าง |
| 306 | ส่ง action ต่อหลังจบ → `SessionAlreadyCompletedError` |
| 316 | `sessionId` ไม่มี → `SessionNotFoundError` |
| 324 | `abandonSession` แล้ว session หายจริง |
| 335 | `graphId` ไม่มี → `GraphNotFoundError` |

### บล็อก F — `describe('… คะแนนความมั่นใจของ session')` (บรรทัด 342–426) — 7 เทส
- 350: ไม่ส่ง query → `confidence` null และไม่เรียกระบบค้นหา
- 360: ส่ง query → ได้คะแนนที่ระบบค้นหาคิดให้ (0.812) เรียกด้วย `{query, graphId}`
- 370: `getSession` ภายหลังได้ confidence เดิม
- 379: ระบบค้นหาคืน null → confidence null ไม่แต่งตัวเลข
- 387: คำนวณคะแนนล้ม (โยน error) → ยังเริ่ม session ได้ confidence null
- 400: `graphId` ไม่มี → `GraphNotFoundError` และไม่คำนวณคะแนน
- 410: คะแนนสูงสุด (1) ไม่ช่วยข้ามด่านความปลอดภัย

### บล็อก G — `describe('… ผลลัพธ์ที่ผู้ใช้กรอก')` (บรรทัด 428–605) — 13 `it` (ตัว `it.each` นับเป็น 2 กรณี)
- 436–441: `REACH_RESOLUTION` (WATER_DRIPS ตอบ yes) / `REACH_ESCALATION` (ERROR_MESSAGE yes + `E1`)
- 444: ข้อมูลทดสอบจบคนละชนิดจริง (resolution กับ escalation)
- 457: (`it.each`) บันทึกได้ทั้งสองแบบ และ response มี `outcome` ตามที่บันทึก
- 474: `getSession` หลังบันทึกได้ข้อความเดิม สถานะ/โหนดไม่เปลี่ยน
- 486: ไม่บังคับ — จบแล้วไม่กรอก `outcome` เป็น null
- 493: ไม่มี session → `SessionNotFoundError`
- 501: session ยังเดินอยู่ → `SessionNotCompletedError` และไม่มีอะไรถูกบันทึก
- 513: ส่งซ้ำ → `OutcomeAlreadySubmittedError` ข้อความแรกไม่ถูกเขียนทับ
- 527: สองคำขอพร้อมกัน (`Promise.allSettled`) → สำเร็จหนึ่ง ถูกปฏิเสธหนึ่ง
- 543: หลังบันทึก action ใหม่ยังถูกปฏิเสธด้วย `SessionAlreadyCompletedError` (ไม่ผ่าน engine)
- 554: ผลลัพธ์ไม่มีผลต่อเส้นทาง (มี/ไม่มี outcome จบที่โหนดเดียวกัน)
- 568: response ทุกชนิดมีฟิลด์ `outcome` (null) และการเดินปกติไม่เรียก `findOutcome` เลย (`findOutcomeCalls === 0`)
- 584: `getSession` ที่จบแล้วอ่านผลลัพธ์ 1 ครั้ง
- 594: `confidence` กับผลลัพธ์เป็นข้อมูลคนละอย่าง บันทึก outcome แล้ว confidence เดิมไม่เปลี่ยน

## 3. การส่งข้อมูล

```
data/manuals/samsung_ac_ar70h.json, data/equipment/equipment.json ──fs──► Fake*Repository / FakeSessionStore (Map ในหน่วยความจำ)
Jest ─► TraversalService (ของจริง) ─► engine (ของจริง) ─► Fake store     ← ด่านความปลอดภัยทดสอบด้วย engine จริง
```
ไม่มี HTTP / MySQL

## 4. จุดที่ควรระวัง

- **ตัวปลอมอาจเพี้ยนจากของจริง**: `FakeSessionStore.update(session)` รับแค่ `session` และไม่บันทึกประวัติ/ไม่ตรวจเงื่อนไข SQL อื่น; เทสพิสูจน์ตรรกะของ service เท่านั้น ส่วน transaction/UNIQUE KEY/`saveOutcome` atomic ต้องตรวจกับ MySQL จริงแยก (คอมเมนต์ 15–17)
- **ผูกกับข้อมูลจริง**: ตัวเลข 13 อาการ, อุปกรณ์ 7 รายการ และรหัสโหนด (`n1`, `n_fix_breaker`, `n_recheck_breaker`, `n_invalid_code`) ฝังตายตัว ถ้าแก้ข้อมูลกราฟ/อุปกรณ์เทสจะล้ม
- เทสที่ 527 (คำขอพร้อมกัน) ได้ผู้ชนะเดียวเพราะ `FakeSessionStore.saveOutcome` ไม่มี `await` ระหว่างเช็คกับเขียน — ไม่ได้พิสูจน์พฤติกรรมของฐานข้อมูลจริง (ตามที่คอมเมนต์ 166–169 ระบุ)

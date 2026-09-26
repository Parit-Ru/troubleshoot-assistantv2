# ขั้น A — REST API เชื่อมกลไกควบคุมเครื่องสถานะเข้ากับ HTTP

ก่อนขั้นนี้ กลไกควบคุมเครื่องสถานะ (`traversal-engine.ts`) ถูกต้องและมีเทสยืนยันแล้ว 82 ข้อ แต่เรียกใช้ได้แค่จากในโปรเซสเดียวกัน (เทส หรือ mock ที่รันในเบราว์เซอร์) ขั้นนี้ห่อกลไกนั้นด้วย REST API 5 endpoint เพื่อให้เรียกจากที่อื่นได้จริง โดย**ไม่เพิ่มตรรกะการเปลี่ยนสถานะใหม่แม้แต่บรรทัดเดียว** — ทุกไฟล์ในขั้นนี้มีหน้าที่แค่หาข้อมูลป้อนให้ engine, ส่งต่อผลลัพธ์ และแปลง error เป็นภาษาของ HTTP เท่านั้น

| ไฟล์ | หน้าที่ |
|---|---|
| `src/traversal/traversal.dto.ts` | รูปร่าง request/response + ตัวตรวจ body ที่เขียนเอง |
| `src/traversal/equipment.repository.ts` | โหลดรายการอุปกรณ์จาก MySQL เข้าหน่วยความจำตอนบูต |
| `src/traversal/session.store.ts` | อ่าน/เขียนตาราง `sessions` และ `session_history` |
| `src/traversal/traversal.service.spec.ts` | เทส 10 ข้อ ลอกจาก `mockServer.test.ts` ของ frontend |
| `src/traversal/traversal.service.ts` | ต่อสาย repository + store เข้ากับ engine |
| `src/traversal/traversal.exception.filter.ts` | แปลง error 8 ชนิด (+ 1 กรณีอื่นๆ) เป็น HTTP response |
| `src/traversal/traversal.controller.ts` | 5 endpoint — รับ request แล้วส่งต่อ ไม่มีตรรกะเอง |
| `src/traversal/traversal.module.ts` | ประกาศ provider/controller ของขั้นนี้ |
| `src/app.module.ts` | เพิ่ม `TraversalModule` เข้าแอป |

> **ศัพท์:** เอกสารนี้ใช้คำว่า เครื่องสถานะ / สถานะ / การเปลี่ยนสถานะ ตาม PROJECT_CONTEXT ข้อ 3
> ชื่อในโค้ดยังคงเดิม เช่น `GraphRepository`, `nodeId` — **graph ในโค้ด = ผังขั้นตอนการวินิจฉัย 1 อาการ, node ในโค้ด = สถานะ**

---

## 1. เรื่องที่เจอ/เปลี่ยนไประหว่างทำขั้นนี้

| เรื่อง | ที่พบ | ที่ทำจริง |
|---|---|---|
| คอมเมนต์ `migration 001` | บรรทัด `--graphs...` ไม่มีช่องว่างหลัง `--` ทำให้ MySQL ไม่ถือเป็นคอมเมนต์ ฐานข้อมูลใหม่ล้วนจะ migrate ไม่ผ่านไฟล์แรก | เติมช่องว่าง 1 ตัว (`-- graphs`) ก่อนใช้กับ Aiven จริง — แก้ได้เพราะยังไม่เคยรันไฟล์นี้กับฐานข้อมูลจริงมาก่อน |
| `tsconfig.json` → `ignoreDeprecations` | ตั้งไว้ `"6.0"` แต่ TypeScript ที่ล็อกไว้ (`^5.6.0`) รู้จักแค่ `"5.0"` ทำให้คอมไพล์ไม่ผ่านเลย (`TS5103`) | เปลี่ยนเป็น `"5.0"` |
| `tsconfig.json` → `incremental` ชนกับ `nest-cli.json` → `deleteOutDir` | สองค่านี้ใช้ร่วมกันไม่ได้: build ครั้งที่ 2 เป็นต้นไป TypeScript เห็นแคชแล้วไม่ยอมเขียนไฟล์ใหม่ ทั้งที่ `dist/` เพิ่งถูกลบ ทำให้ `nest start` หา `dist/main` ไม่เจอ **ทุกครั้งที่ปิดแล้วเปิดเซิร์ฟเวอร์ใหม่** | ปิด `incremental` (ทดสอบยืนยันด้วยการ build ติดกัน 4 รอบ) |
| กรณีกดเบิ้ล (ชน `UNIQUE KEY (session_id, step_order)`) | เสนอแปลงเป็น 409 `SESSION_CONFLICT` ได้ | **ตัดสินใจรับสภาพเป็น 500** ไม่เพิ่ม error class หรือรหัสใหม่ในสัญญา |
| status code ของ `POST /traversal/sessions` และ `.../actions` | ไม่ได้ใส่ `@HttpCode` เอง | ได้ **201** (ค่าเริ่มต้นของ Nest) ไม่ใช่ 200 — ไม่กระทบอะไรเพราะ frontend เช็คแค่ `response.ok` |

---

## 2. คำขอ 1 ครั้งเดินทางผ่านไฟล์ไหนบ้าง

```
Client
  │  POST /traversal/sessions/:id/actions   { type: 'continue' }
  ▼
traversal.controller.ts        รับ request, ดึง :id, ส่ง body ต่อ (ไม่แตะ)
  │
  ▼
traversal.dto.ts               parseTraversalAction(body)
  │                             ├─ รูปร่างผิด → throw InvalidRequestBodyError (จบที่นี่)
  │                             └─ รูปร่างถูก → คืน TraversalAction ที่ type ปลอดภัยแล้ว
  ▼
traversal.service.ts           submitAction(sessionId, action)
  │  1. sessionStore.find()         หา session — ไม่เจอ → SessionNotFoundError
  │  2. graphRepository.findById()  หากราฟของ session นั้น — ไม่เจอ → GraphNotFoundError
  │  3. engineSubmitAction()        ★ จุดตัดสินใจเพียงจุดเดียวของทั้งระบบ ★
  │        engine ปฏิเสธ (เช่นยังไม่ยืนยันคำเตือน) → throw ทันที
  │        ขั้นตอนที่ 4 จะไม่ถูกเรียกเลย — สถานะในฐานข้อมูลจึงไม่ขยับ
  │  4. sessionStore.update()       บันทึกเฉพาะตอน engine อนุมัติแล้วเท่านั้น
  ▼
traversal.exception.filter.ts  (ถ้ามี error หลุดออกมาจากข้อ 1-4 ข้างบน)
  │  instanceof ตรงกับ error ชนิดไหน → HTTP status + code ตามตาราง
  ▼
Response กลับไปหา Client
```

ไม่มีจุดไหนในเส้นทางนี้ตัดสินใจว่า "ขั้นถัดไปคืออะไร" นอกจาก `engineSubmitAction()` ข้อ 3 — เอกสารและเทสทั้งหมดของขั้นนี้ยืนยันข้อเท็จจริงนี้ซ้ำแล้วซ้ำเล่า เพราะเป็นคำตอบหลักของคำถาม "ต่างจากเอา PDF ให้ Gemini อ่านยังไง"

---

## 3. `traversal.dto.ts`

### ทำไมเขียนตัวตรวจ body เอง ไม่ใช้ `class-validator`

body ของ API นี้มีแค่ 2 รูปแบบ (`{ graphId }` และ `TraversalAction`) เรียบง่ายพอที่จะเขียนเป็นฟังก์ชันธรรมดา (`parseStartSessionBody`, `parseTraversalAction`) โดยไม่ต้องลงแพ็กเกจเพิ่มหรืออธิบาย decorator ให้กรรมการฟัง ฟังก์ชันทั้งสองสร้าง object ใหม่จากเฉพาะ field ที่รู้จักเท่านั้น — field แปลกปลอมที่แนบมาจะไม่หลุดรอดไปถึง engine หรือถูกบันทึกลงฐานข้อมูล

### `InvalidRequestBodyError` ไม่ extends `TraversalError`

เพราะไม่ได้มาจาก engine engine ไม่รู้จักคำว่า "HTTP request body" เลย ความผิดพลาดนี้เป็นเรื่องของชั้น API เท่านั้น การแยกคลาสชัดเจนแบบนี้ทำให้อธิบายได้ง่ายว่า engine ไม่มีทางรับรู้เรื่อง HTTP

### เพดาน 255 ตัวอักษรของ `input`

ตาราง `session_history.action_value` เป็น `VARCHAR(255)` ถ้าไม่ตรวจตั้งแต่ต้นทาง ค่าที่ยาวเกินจะทำให้การบันทึกล้มเป็น 500 ทั้งที่จริงเป็นความผิดของ request (ควรเป็น 400) จึงตรวจที่นี่ก่อนส่งเข้า engine

### `equipment` เป็น field บังคับ

ฝั่งเซิร์ฟเวอร์ส่ง `equipment: []` เสมอแม้ประเภทเครื่องนั้นยังไม่มีข้อมูล ส่วนฝั่งหน้าจอประกาศเป็น optional ได้โดยไม่ขัดกัน (รับ `[]` ได้อยู่แล้ว)

---

## 4. `equipment.repository.ts`

โหลดตาราง `equipment` JOIN `equipment_usage` เข้าหน่วยความจำครั้งเดียวตอนบูต แบบเดียวกับ `GraphRepository` เหตุผลเดียวกัน: ข้อมูลอ่านอย่างเดียว เปลี่ยนเฉพาะตอนรัน `npm run seed:equipment` และมีไม่กี่สิบรายการ

- **`NULL` จากฐานข้อมูล → `undefined` ในโค้ด** เพื่อให้ JSON ที่ส่งออกไปไม่มี field นั้นเลย ตรงกับที่ `mockServer.ts` ทำมาก่อนแล้ว หน้าจอจึงเห็นรูปร่างเดียวกันทั้งสองโหมด
- **`findByCategory()` คืนสำเนาของ array** กันผู้เรียกแก้ไขข้อมูลกลางในหน่วยความจำโดยไม่ตั้งใจ
- **ไม่ตรวจซ้ำว่าทุกชิ้นมีที่มา (`source_page`/`author_note`)** เพราะฐานข้อมูลมี `CHECK` บังคับไว้แล้ว การเขียนซ้ำในโค้ดจะเป็นเส้นทางที่ไม่มีวันทำงาน

---

## 5. `session.store.ts`

ไฟล์นี้เป็นชั้นเดียวที่ทำ SQL กับ `sessions`/`session_history` ไม่มีตรรกะการเปลี่ยนสถานะอยู่เลย

### ทำไม `update()` ต้องเป็น transaction เดียว

เขียนสถานะปัจจุบัน (`sessions`) กับบันทึกประวัติ (`session_history`) พร้อมกัน ถ้าอย่างใดอย่างหนึ่งล้ม ทั้งคู่ถูกยกเลิก สถานะกับประวัติจึงไม่มีทางไม่ตรงกัน

### ทำไมคำนวณเวลาใน SQL ไม่ใช้ `Date` ของ JavaScript

`NOW() + INTERVAL ? HOUR` และ `expires_at > NOW()` คำนวณฝั่ง MySQL ทั้งหมด เพราะคอลัมน์ `TIMESTAMP` ขึ้นกับ time zone ของ connection ถ้าเทียบเวลาจากสองที่ (Node กับ MySQL) อาจเห็น session หมดอายุผิดชั่วโมง

### การต่ออายุ session — 24 ชั่วโมง (ตัดสินใจข้อ B8)

ต่ออายุทั้งตอน `create()` และทุกครั้งที่ `update()` นับจากการใช้งานล่าสุด ยาวกว่ารอบรอที่นานที่สุดในข้อมูล (สถานะ `n_ventilate` ให้เปิดพัดลมทิ้งไว้ 3-4 ชั่วโมงโดยไม่มี action เกิดขึ้นเลย)

> **หมายเหตุ:** คอมเมนต์ใน `migration 002` เขียนไว้ว่า 2 ชั่วโมง ไม่ตรงกับค่าจริง 24 ชั่วโมงที่ใช้ ไม่แก้คอมเมนต์นั้นเพราะ migration นี้รันกับฐานข้อมูลจริงไปแล้ว (ต่างจาก migration 001 ที่แก้ได้เพราะยังไม่เคยรันกับฐานข้อมูลจริงมาก่อน) — ค่าจริงให้ยึดตาม `SESSION_TTL_HOURS` ในไฟล์นี้เสมอ

### กรณีกดเบิ้ล (ชน `UNIQUE KEY (session_id, step_order)`)

**ตัดสินใจแล้ว: รับสภาพเป็น 500** ไม่แปลงเป็น error หรือรหัสใหม่ ข้อมูลไม่เสียในทุกกรณี (transaction ยกเลิกทั้งก้อน) ต่างกันแค่ผู้ใช้เห็นข้อความกลางๆ แทนข้อความเฉพาะ

---

## 6. `traversal.service.ts` — หัวใจของขั้นนี้

### ทำไม service ไม่มีตรรกะการเปลี่ยนสถานะของตัวเองแม้แต่บรรทัดเดียว

ทุกการตัดสินใจว่า "ขั้นถัดไปคืออะไร" และ "action นี้ใช้กับสถานะปัจจุบันได้ไหม" มาจาก `startSession`/`getCurrentNode`/`submitAction` ของ engine เท่านั้น หน้าที่ของ service มีแค่: หาข้อมูลป้อนให้ engine (`GraphRepository`, `SessionStore`), ส่งต่อผลลัพธ์ และประกอบ response — ถ้าตัดชั้นนี้ออก แล้วเรียก engine ตรงๆ จากที่อื่น ผลลัพธ์ต้องเหมือนเดิมทุกกรณี

### ทำไมไม่บันทึกอะไรเมื่อ engine โยน error

`submitAction()` เรียก `engineSubmitAction()` ก่อน `sessionStore.update()` เสมอ เป็นลำดับโค้ดธรรมดา ไม่ใช่ if-else พิเศษ: ถ้า engine throw โค้ดกระโดดออกจากฟังก์ชันทันที บรรทัด `sessionStore.update()` จึงไม่ถูกรันเลย — **นี่คือกลไกที่พิสูจน์ด่านความปลอดภัยทั้งระบบ** ไม่ต้องเขียนโค้ดตรวจสอบหรือย้อนสถานะเพิ่มเติมใดๆ

### `GraphNotFoundError` / `SessionNotFoundError` ไม่ extends `TraversalError`

เหตุผลเดียวกับ `InvalidRequestBodyError`: ไม่ได้มาจาก engine engine ไม่รู้จักคำว่า "session" หรือ "กราฟที่ไม่มีอยู่จริง" — มันรับ `SessionState`/`TroubleshootingGraph` ที่มีอยู่แล้วมาทำงานเท่านั้น การหาไม่เจอเป็นเรื่องของชั้นข้อมูล service จึงต้องแปลงเป็น error เอง

---

## 7. `traversal.exception.filter.ts`

### ตารางแปลง error → HTTP response

| error | มาจาก | HTTP | code |
|---|---|---|---|
| `SafetyConfirmationRequiredError` | engine | 400 | `SAFETY_CONFIRMATION_REQUIRED` |
| `InvalidActionError` | engine | 400 | `INVALID_ACTION` |
| `InvalidRequestBodyError` | A.1 (dto) | 400 | `INVALID_ACTION` (ใช้ code เดียวกับแถวบน) |
| `SessionAlreadyCompletedError` | engine | 409 | `SESSION_COMPLETED` |
| `SessionNotFoundError` | A.5 (service) | 404 | `SESSION_NOT_FOUND` |
| `GraphNotFoundError` | A.5 (service) | 404 | `GRAPH_NOT_FOUND` |
| `NodeNotFoundError` | engine | 500 | `GRAPH_NODE_MISSING` |
| `UnsupportedSchemaVersionError` | engine | 500 | `GRAPH_SCHEMA_UNSUPPORTED` |
| อื่นๆ ทั้งหมด | ไม่ทราบ | 500 | `INTERNAL_ERROR` |

### ทำไมแยกฟังก์ชัน `toErrorBody()` ออกจากคลาส filter

ฟังก์ชันนี้เป็นตรรกะล้วน (รับ error คืน object) ทดสอบได้โดยไม่ต้องปลอม `ArgumentsHost`/`Response` ของ NestJS เลย

### ทำไม log เฉพาะ error ที่เป็น 500

400/404/409 คือผลปกติของการใช้งาน (กรอกผิด, session หมดอายุ, กดซ้ำ) ไม่ใช่เรื่องที่ต้องไล่ดู log ส่วน 500 ทุกกรณีคือสิ่งที่ไม่ควรเกิด (ข้อมูลกราฟเสีย, บั๊ก, หรือ error ที่ยังไม่รู้จัก) จึงต้องมี stack trace เสมอ

### ขอบเขตที่รู้อยู่แล้วและยังไม่แก้

filter นี้จับ error ได้เฉพาะที่เกิด "ระหว่างรัน route handler" ถ้า body เป็น JSON ที่ผิดไวยากรณ์ล้วนๆ (เช่น `{`) Express จะโยน `SyntaxError` จาก body-parser เองก่อนถึง Nest filter นี้จึงไม่ทำงาน ต่างจาก "JSON ถูกไวยากรณ์แต่ field ผิด" ที่ `parseTraversalAction` จับได้ปกติ

---

## 8. `traversal.controller.ts`

ตั้งใจให้ "โง่" ที่สุดเท่าที่เป็นไปได้: รับ request → ตรวจ body ด้วยฟังก์ชันจาก A.1 → ส่งต่อให้ service → คืนสิ่งที่ service ให้กลับมาตรงๆ ไม่มีการตัดสินใจอะไรเองเลยสักบรรทัด `@Body()` รับเป็น `unknown` เสมอ ไม่ประกาศเป็น DTO class เพราะตัดสินใจแล้วในขั้น A.1 ว่าจะไม่ใช้ `class-validator`

---

## 9. `traversal.module.ts` และ `app.module.ts`

`TraversalModule` ไม่ต้อง import `DatabaseModule` เอง แม้ว่า repository/store ทุกตัวต้องใช้ `MYSQL_POOL` ก็ตาม เพราะ `DatabaseModule` ประกาศตัวเองเป็น `@Global()` ไว้แล้ว พอลงทะเบียนที่ `AppModule` ครั้งเดียว ทุกโมดูลในแอปขอยืม `MYSQL_POOL` ได้เลย — ยืนยันด้วยการบูตทั้งสองโมดูลผ่าน `@nestjs/testing` จริง (ไม่ใช่แค่คอมไพล์ผ่าน) ก่อนแก้ `app.module.ts`

---

## 10. ตรวจสอบอย่างไร

| ระดับ | ผล |
|---|---|
| เทสอัตโนมัติ (`npm test`) | **92/92 ข้อผ่าน** (82 เดิมของ engine + 10 ใหม่ของ `traversal.service.spec.ts`) |
| `EquipmentRepository`/`SessionStore` กับ MySQL จริง | ทดสอบแยกด้วย MySQL 8.0 จริง (migration จริง + seed จริง) รวมกรณีชน `UNIQUE KEY` (ยืนยัน rollback จริง, errno 1062) และ transaction |
| REST API เต็มระบบ | บูต `AppModule` จริงด้วย `NestFactory`, MySQL จริง, ยิง HTTP จริง — 14/14 ข้อผ่าน รวมข้อสอบหลัก: `continue` ข้ามคำเตือน → 400 `SAFETY_CONFIRMATION_REQUIRED` → อ่านซ้ำสถานะไม่ขยับ |
| หน้าจอจริง (`VITE_USE_MOCK=false`) | เดิน session เต็มรอบผ่านเบราว์เซอร์จริง, กด F5 กลางทางยังอยู่ขั้นเดิม, แผงสาธิต `?demo=1` ที่สถานะเบรกเกอร์ได้ 400 จากเซิร์ฟเวอร์จริง |

ไม่ได้ทำ e2e ด้วย `supertest` ตามที่ตัดสินใจไว้ในข้อ 7 ของ HANDOFF — ใช้การทดสอบ HTTP จริงข้างต้นแทน ได้หลักฐานเดียวกันโดยไม่เพิ่ม dependency

---

## 11. เรื่องค้างจากขั้นนี้

| เรื่อง | สถานะ |
|---|---|
| ไม่มีตัวกวาด session ที่หมดอายุ | แถวเก่ายังอยู่ในตาราง แต่ `find()` มองไม่เห็น (กรองด้วย `expires_at > NOW()`) ข้อมูลระดับนี้ไม่เป็นปัญหา |
| body เป็น JSON ผิดไวยากรณ์ล้วนๆ ไม่ผ่าน filter นี้ | Express จัดการก่อนถึง Nest — ยังไม่ได้แก้ระดับ global exception handling |
| `POST /traversal/sessions` และ `.../actions` ตอบ 201 ไม่ใช่ 200 | ไม่กระทบ frontend (เช็คแค่ `response.ok`) ปล่อยไว้ตามค่าเริ่มต้นของ Nest |
| A.12 (สคริปต์สาธิตด่านความปลอดภัยผ่าน PowerShell) | ยังไม่ได้ทำ |

---

## 12. คำถามที่กรรมการอาจถาม

**"ทำไมไม่ใช้ `class-validator` ทั้งที่เป็นของมาตรฐานของ NestJS"**
> body ของ API นี้มีแค่ 2 รูปแบบและเรียบง่ายมากครับ เขียนเป็นฟังก์ชันตรวจเองได้ในไม่กี่สิบบรรทัด อธิบายได้ทุกบรรทัด และไม่ต้องเพิ่ม dependency กับ decorator ที่ต้องอธิบายกลไกภายในให้กรรมการฟัง

**"พิสูจน์ยังไงว่าด่านความปลอดภัยไม่ใช่สิ่งที่หน้าเว็บบังคับเอง"**
> `submitAction()` ใน service เรียกฟังก์ชันของ engine ก่อนบันทึกเสมอครับ ถ้า engine ปฏิเสธ โค้ดจะไม่ไปถึงบรรทัดที่บันทึกฐานข้อมูลเลย ทดสอบแล้วด้วยการยิง HTTP request ตรงเข้าเซิร์ฟเวอร์โดยไม่ผ่านหน้าเว็บเลย (สคริปต์ A.12) ได้ผลเหมือนกันทุกครั้ง

**"transaction ใน `session.store.ts` ป้องกันอะไร"**
> ป้องกันไม่ให้สถานะปัจจุบันกับประวัติการใช้งานไม่ตรงกันครับ ถ้าเขียนสถานะสำเร็จแต่บันทึกประวัติล้ม (หรือกลับกัน) จะเห็นข้อมูลครึ่งๆ กลางๆ transaction ทำให้ทั้งคู่สำเร็จหรือยกเลิกพร้อมกันเสมอ

**"ทำไม error บางตัว extends `TraversalError` บางตัวไม่"**
> ตัวที่มาจากกลไกควบคุมเครื่องสถานะโดยตรง (เช่น ยังไม่ยืนยันคำเตือน) extends `TraversalError` ครับ ส่วนตัวที่มาจากชั้น API เอง (เช่น หา session ไม่เจอ, body ผิดรูปแบบ) เป็นคลาสแยกต่างหาก เพราะ engine ไม่รู้จักสิ่งเหล่านี้เลย — engine เห็นแค่ข้อมูลที่ถูกต้องแล้วเท่านั้น
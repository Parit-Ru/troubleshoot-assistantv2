# backend/src/traversal/traversal.dto.ts

## 1. หน้าที่ของไฟล์

กำหนด "รูปร่างของ request/response" ของ REST API เดินขั้นตอน พร้อมฟังก์ชันตรวจ body ที่เขียนเอง 3 ตัว (`parseStartSessionBody`, `parseTraversalAction`, `parseOutcomeBody`) และ error class 2 ตัวที่ใช้ตอน body ผิดรูปแบบ
ไฟล์ไม่แตะ NestJS และไม่แตะ DB จึงเทสได้เร็ว (คอมเมนต์ 5–6) เหตุผลที่ไม่ใช้ `class-validator` (คอมเมนต์ 8–11): body มีแค่ 3 แบบ เรียบง่าย ไม่ต้องลงแพ็กเกจเพิ่ม และอธิบายได้ทุกบรรทัด

- **ใครเรียกใช้**: `traversal.controller.ts` (เรียก `parse*`), `traversal.exception.filter.ts` (ตรวจ `instanceof` error), `traversal.service.ts` (type `SessionResponseDto`), `equipment.repository.ts` (type `EquipmentItemDto`), `frontend/src/mocks/mockServer.ts` (นำ type/ค่าคงที่ไปใช้), และ spec 3 ไฟล์
- **เรียกใช้**: type จาก `../traversal-engine/types` และค่าคงที่ `MAX_QUERY_LENGTH` จาก `../symptom-search/symptom-search.dto` (เป็นการ import ค่าจริง ไม่ใช่แค่ type)

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่ (บรรทัด 25–46)
- `MAX_INPUT_LENGTH = 255` (36): เพดานความยาวค่าที่ผู้ใช้กรอกในโหนด input ให้ตรงกับ `session_history.action_value` (VARCHAR(255)) ถ้าไม่ตั้ง การบันทึกประวัติจะล้มเป็น 500 ทั้งที่เป็นความผิดของ request (ควรเป็น 400) — ไม่ได้ export
- `MAX_OUTCOME_LENGTH = 1000` (46, export): เพดานข้อความผลลัพธ์ที่ผู้ใช้กรอก นับหลัง trim นับเป็นหน่วย `.length` ของ JS (อีโมจินับ 2) ค่าเดียวกันถูกคัดลอกไปที่ frontend (ต้องแก้สองที่) และไม่ผูกกับคอลัมน์ (`outcome_text` เป็น TEXT)

### บล็อก B — error class (บรรทัด 48–79)
- `InvalidRequestBodyError` (60–65): body ของ request ทั่วไปผิดรูปแบบ — เป็น error ของเราเอง ไม่ใช่ของ Nest เพื่อให้ filter จับด้วย `instanceof` ได้ message ไว้ให้นักพัฒนา หน้าจอเลือกข้อความไทยจาก `code`
- `InvalidOutcomeError` (74–79): ใช้เฉพาะ body ของ outcome แยกรหัสเป็น `INVALID_OUTCOME` ไม่ปนกับ `INVALID_ACTION`

### บล็อก C — `StartSessionBody` และ `asObject` (บรรทัด 85–106)
- `StartSessionBody { graphId: string; query?: string }`
- `asObject(body: unknown)`: ตรวจว่าเป็น object ธรรมดา (ไม่ใช่ null/array/primitive; ระวัง `typeof null === 'object'`) ไม่ผ่านโยน `InvalidRequestBodyError('body ต้องเป็น JSON object')`

### บล็อก D — `parseStartSessionBody` (บรรทัด 114–139)
- ตรวจ `graphId` เป็น string ไม่ว่าง (118–120)
- ถ้าไม่ส่ง `query` คืน `{ graphId }` (124–127) — คอมเมนต์ 125: สร้าง object ใหม่จาก field ที่รู้จักเท่านั้น field แปลกปลอมไม่ผ่านต่อ
- ถ้าส่ง `query` ต้องเป็น string (128–130), trim แล้วไม่ว่าง (131–134), ไม่เกิน `MAX_QUERY_LENGTH` (135–137) แล้วคืน `{ graphId, query }` (query ที่ trim แล้ว)
- ส่ง `query: ""` ถือว่าผิด ไม่ตีเป็น "ไม่ส่ง" เพื่อให้หน้าจอที่พลาดเห็นชัด (คอมเมนต์ 123)
- ตรวจแค่รูปร่าง ส่วนว่ามี graph จริงไหมเป็นงาน service (404 `GRAPH_NOT_FOUND`)

### บล็อก E — `parseTraversalAction` (บรรทัด 151–192)
`switch (obj.type)`:
- `'answer'` (155–163): `value` ต้องเป็น `'yes'`/`'no'`
- `'continue'` (165–166) และ `'confirm_safety'` (168–169): คืน action เปล่า
- `'input'` (171–184): `value` ต้องเป็น string และ `length ≤ 255`
- `default` (186–190): ข้อความ error ไม่ใส่ค่าที่ผู้ใช้ส่งมา เพราะอาจยาวหรือแปลกปลอม (คอมเมนต์ 187)
- ไม่มีตรรกะเปลี่ยนสถานะเลย ว่า action ใช้กับโหนดนี้ได้ไหมหรือต้องยืนยันความปลอดภัยไหม เป็นเรื่องของ engine (คอมเมนต์ 146–149)
- **รับ**: `unknown` — **คืน**: `TraversalAction`

### บล็อก F — `OutcomeBody` และ `parseOutcomeBody` (บรรทัด 194–229)
- ตรวจ object (211–213) แล้วดึง `text` (215) ต้องเป็น string (216–218), `trim()` แล้วไม่ว่าง (220–223), ไม่เกิน `MAX_OUTCOME_LENGTH` (224–226) แล้วคืน `{ text }`
- ไม่ใช้ `asObject` (ใช้การตรวจซ้ำของตัวเอง) เพราะต้องโยน `InvalidOutcomeError` คนละชนิด
- ไม่กรองเนื้อหา (ไม่กรองข้อมูลส่วนตัว/คำต้องห้าม) — เป็นข้อมูลบันทึกอย่างเดียว (คอมเมนต์ 208)

### บล็อก G — Response DTO (บรรทัด 231–279)
- `EquipmentItemDto` (243–251): `equipmentId`, `nameTh`, `purposeTh`, `sourcePage?`, `authorNote?` — ต้องมีอย่างน้อยหนึ่งใน `sourcePage`/`authorNote` เสมอ (ตาราง `equipment_usage` มี CHECK บังคับตามคอมเมนต์ 239–241)
- `SessionResponseDto` (261–279): `sessionId`, `graphId`, `status`, `node` (ผลจาก engine ห้ามดัดแปลง), `equipment[]` (บังคับฝั่งเซิร์ฟเวอร์ ส่ง `[]` ถ้าไม่มี), `confidence` (cosine ปัด 3 ตำแหน่ง ไม่ใช่ความน่าจะเป็น; `null` = เลือกอาการจากรายการเอง หรือระบบค้นหาไม่พร้อม), `outcome` (`null` = ยังไม่กรอก/ยังไม่จบ; เป็นข้อมูลบันทึกอย่างเดียว ไม่ถูกนำไปตัดสินใจ)

## 3. การส่งข้อมูล

```
HTTP body (JSON) ──Nest @Body(): unknown──► parseXxx() ──► ค่าที่ type ปลอดภัย ──► TraversalService
                                                │ ผิดรูปแบบ
                                                └─► throw InvalidRequestBodyError / InvalidOutcomeError ──► ExceptionFilter ──► 400
TraversalService ──► SessionResponseDto ──► JSON response
```
ตัวอย่าง body ที่ผ่าน: `{"graphId":"<id>","query":"แอร์ไม่เย็น"}` / `{"type":"answer","value":"yes"}` / `{"text":"แก้ได้แล้ว"}`
ตัวอย่างที่ไม่ผ่าน: `{"type":"answer","value":"maybe"}` → `InvalidRequestBodyError` → 400 `INVALID_ACTION`

## 4. จุดที่ควรระวัง

- คอมเมนต์หัวไฟล์ว่า "ไม่ import NestJS ไม่แตะ DB" ถูกต้อง แต่ไฟล์พึ่ง `symptom-search.dto.ts` (ค่า `MAX_QUERY_LENGTH`) ทำให้โมดูล traversal ผูกกับ symptom-search ในระดับค่าคงที่
- `MAX_OUTCOME_LENGTH` ต้องตรงกับ `maxLength` ของช่องกรอกฝั่ง frontend (คอมเมนต์ 42) — ไม่มีกลไกอัตโนมัติรับรองว่าตรงกัน
- ความยาวนับด้วย `.length` (หน่วย UTF-16) ส่วน `VARCHAR(255)` ในฐานข้อมูลนับเป็นตัวอักษร จึงเป็นการนับแบบเข้มกว่าเล็กน้อยสำหรับอักขระนอก BMP (อนุมานจากโค้ด)
- `input` ไม่ถูก trim (ต่างจาก `query` และ `text`) ค่าที่ผู้ใช้ส่งมาจึงถูกเก็บตามเดิม และผ่าน regex ของ engine ตามที่เป็นอยู่
- JSON ที่ผิดไวยากรณ์ (เช่น `{`) ไม่เข้าถึงฟังก์ชันเหล่านี้ เพราะ Express ปฏิเสธก่อนถึง handler (ดูข้อจำกัดในคอมเมนต์ของ `traversal.exception.filter.ts`)

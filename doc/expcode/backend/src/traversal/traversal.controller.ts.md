# backend/src/traversal/traversal.controller.ts

## 1. หน้าที่ของไฟล์

ประตู HTTP ของ API เดินขั้นตอนตรวจอาการ: 6 endpoint ภายใต้ prefix `/traversal` ตั้งใจให้ "โง่" ที่สุด — รับ request, ตรวจรูปร่าง body ด้วยฟังก์ชัน `parse*`, ส่งต่อให้ `TraversalService`, คืนผลตรงๆ ไม่ตัดสินใจเอง (คอมเมนต์ 4–8) ไม่จับ error ใดเลย ปล่อยให้ `TraversalExceptionFilter` ที่ติดไว้ระดับ controller แปลง (คอมเมนต์ 10–12)

- **ใครเรียกใช้**: `traversal.module.ts` (ลงทะเบียน controller)
- **เรียกใช้**: `./traversal.dto` (`parse*`, type `SessionResponseDto`), `./traversal.exception.filter`, `./traversal.service`, type `GraphSummary` จาก `./graph.repository`

## 2. อธิบายทีละบล็อก

### บล็อก A — import และ decorator ระดับคลาส (บรรทัด 20–31)
- `@Controller('traversal')` และ `@UseFilters(TraversalExceptionFilter)` (28–29)
- constructor ฉีด `TraversalService` (31)
- `@Body()` รับเป็น `unknown` เสมอ ไม่ใช้ DTO class/class-validator; ความถูกต้องของ body พิสูจน์ผ่าน `parse*` (คอมเมนต์ 14–17)

### บล็อก B — `GET /traversal/graphs` (บรรทัด 33–38)
`listGraphs()` คืน `GraphSummary[]` จาก `traversalService.listGraphs()` — ไม่ async เพราะ service อ่านจากหน่วยความจำ

### บล็อก C — `POST /traversal/sessions` (บรรทัด 40–47)
`startSession(@Body() body)` → `parseStartSessionBody(body)` ได้ `{graphId, query?}` → `service.startSession(graphId, query)` คืน `SessionResponseDto` (status 201 ตามค่าเริ่มต้นของ Nest สำหรับ POST — คอมเมนต์ 71–72)

### บล็อก D — `GET /traversal/sessions/:id` (บรรทัด 49–53)
`getSession(@Param('id'))` → `service.getSession(id)`

### บล็อก E — `POST /traversal/sessions/:id/actions` (บรรทัด 55–63)
body คือ `TraversalAction` ตรงๆ ไม่ห่อ object; `parseTraversalAction(body)` → `service.submitAction(id, action)`

### บล็อก F — `POST /traversal/sessions/:id/outcome` (บรรทัด 65–82)
`@HttpCode(200)` — ตอบ 200 ไม่ใช่ 201 เพราะไม่ได้สร้างทรัพยากรใหม่ แค่บันทึกข้อมูลเพิ่มให้ session ที่มีอยู่ (คอมเมนต์ 71–72); `parseOutcomeBody(body)` → `service.submitOutcome(id, text)`; แยกจาก `/actions` โดยตั้งใจ ไม่ผ่าน `submitAction`/`resolveNextNode` (คอมเมนต์ 69)

### บล็อก G — `DELETE /traversal/sessions/:id` (บรรทัด 84–94)
`@HttpCode(204)` ตอบ 204 ไม่มี body; `abandonSession(id)` คืน `Promise<void>`

## 3. การส่งข้อมูล

| Method + Path | body เข้า | ตอบ |
|---|---|---|
| GET `/traversal/graphs` | – | `GraphSummary[]` |
| POST `/traversal/sessions` | `{graphId, query?}` | 201 `SessionResponseDto` |
| GET `/traversal/sessions/:id` | – | 200 `SessionResponseDto` |
| POST `/traversal/sessions/:id/actions` | `TraversalAction` | 201 `SessionResponseDto` |
| POST `/traversal/sessions/:id/outcome` | `{text}` | 200 `SessionResponseDto` |
| DELETE `/traversal/sessions/:id` | – | 204 |

ข้อมูลไหลเป็น JSON ผ่าน HTTP: `เบราว์เซอร์ → controller → parse* → service → (repository / engine / DB) → DTO → JSON`

## 4. จุดที่ควรระวัง

- **ไม่มี prefix เวอร์ชัน** (เช่น `/api/v1`) และ main.ts ไม่ตั้ง global prefix เส้นทางจึงขึ้นต้นที่ `/traversal`
- `id` ใน path ถูกใช้เป็น string ตรงๆ ไม่ตรวจรูปแบบ UUID ที่ controller — ค่าที่ไม่ใช่ session จริงจะได้ 404 `SESSION_NOT_FOUND` จาก service
- `POST /actions` ตอบ 201 (ค่าเริ่มต้นของ Nest) ทั้งที่ไม่ได้สร้างทรัพยากรใหม่ ขณะที่ `/outcome` ตั้งเป็น 200 — ความไม่สม่ำเสมอเล็กน้อยที่คอมเมนต์ยอมรับ (บรรทัด 71–72)
- error ทุกชนิดหลุดไปที่ filter ระดับ controller เท่านั้น — endpoint ของโมดูลอื่นต้องมี filter ของตัวเอง

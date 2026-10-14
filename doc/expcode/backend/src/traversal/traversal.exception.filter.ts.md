# backend/src/traversal/traversal.exception.filter.ts

## 1. หน้าที่ของไฟล์

แปลง error ที่เกิดระหว่างรัน `TraversalController` ให้เป็น HTTP response รูปแบบเดียวกันทุกกรณี `{ statusCode, code, message }` โดยใช้ `instanceof` กับคลาส error โดยตรง ไม่อ่านข้อความ error (เพราะ message เขียนให้นักพัฒนาอ่านและเปลี่ยนได้ตลอด — คอมเมนต์ 4–5)
แยกตรรกะแปลงเป็นฟังก์ชัน `toErrorBody()` ออกจากคลาส filter เพื่อเทสได้โดยไม่ต้องปลอม `ArgumentsHost` ของ Nest (คอมเมนต์ 11–13)

- **ใครเรียกใช้**: `traversal.controller.ts` (`@UseFilters`), `symptom-search.exception.filter.ts` (นำเข้าเฉพาะ type `ApiErrorBody` ไปใช้เป็นรูปร่าง response ร่วมกัน — ส่วน `toErrorBody` ของ symptom-search เขียนแยกเอง), `traversal.exception.filter.spec.ts`
- **เรียกใช้**: error จาก `./traversal.dto`, `./traversal.service`, `../traversal-engine/types` และ type `Response` จาก `express`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์และ import (บรรทัด 1–37)
- แหล่ง error 3 ที่ (คอมเมนต์ 7–9): engine (`types.ts`), service (`traversal.service.ts`), DTO (`traversal.dto.ts`)
- **ข้อจำกัดที่รู้อยู่** (คอมเมนต์ 15–18): filter ทำงานเฉพาะ error ที่เกิดระหว่างรัน route handler ถ้า body เป็น JSON ไวยากรณ์ผิด (เช่น `{`) Express/body-parser โยน `SyntaxError` เองก่อนถึง handler filter จึงไม่ทำงาน

### บล็อก B — `ApiErrorBody` (บรรทัด 39–44)
`{ statusCode: number; code: string; message: string }` ตรงกับ `ApiErrorBody` ฝั่งหน้าจอ

### บล็อก C — `toErrorBody(exception)` (บรรทัด 46–98)
ตารางแปลง (ลำดับสลับได้เพราะทุกคลาสเป็นพี่น้องกัน ไม่มีคลาสไหนเป็น superclass ของอีกคลาส — คอมเมนต์ 49–50):

| บรรทัด | error | HTTP | `code` |
|---|---|---|---|
| 59–61 | `SafetyConfirmationRequiredError` | 400 | `SAFETY_CONFIRMATION_REQUIRED` |
| 62–64 | `InvalidActionError` | 400 | `INVALID_ACTION` |
| 65–69 | `InvalidRequestBodyError` | 400 | `INVALID_ACTION` (ใช้รหัสเดียวกัน เพราะผู้ใช้เห็นข้อความไทยเดียวกัน) |
| 70–73 | `InvalidOutcomeError` | 400 | `INVALID_OUTCOME` |
| 74–76 | `SessionAlreadyCompletedError` | 409 | `SESSION_COMPLETED` |
| 77–80 | `SessionNotCompletedError` | 409 | `SESSION_NOT_COMPLETED` |
| 81–83 | `OutcomeAlreadySubmittedError` | 409 | `OUTCOME_ALREADY_SUBMITTED` |
| 84–86 | `SessionNotFoundError` | 404 | `SESSION_NOT_FOUND` |
| 87–89 | `GraphNotFoundError` | 404 | `GRAPH_NOT_FOUND` |
| 90–92 | `NodeNotFoundError` | 500 | `GRAPH_NODE_MISSING` |
| 93–95 | `UnsupportedSchemaVersionError` | 500 | `GRAPH_SCHEMA_UNSUPPORTED` |
| 97 | อื่นๆ ทั้งหมด | 500 | `INTERNAL_ERROR` |

- `message` = `exception.message` ถ้าเป็น `Error` ไม่เช่นนั้น `'ไม่ทราบสาเหตุ'` (57)
- แถวสุดท้ายดักทุกอย่างที่ไม่รู้จัก (บั๊ก, error ของ mysql2, error ชนิดใหม่ที่ยังไม่ใส่ตาราง) ต้องเป็น 500 เสมอเพราะไม่รู้สาเหตุ ใช้ `INTERNAL_ERROR` ไม่ใช่ `UNKNOWN_ERROR` ที่ mock ฝั่งหน้าจอใช้ (คอมเมนต์ 52–54)

### บล็อก D — คลาส `TraversalExceptionFilter` (บรรทัด 100–119)
- `@Catch()` (ไม่ระบุชนิด) จับทุก exception ที่เกิดใน controller
- `catch(exception, host)`: เรียก `toErrorBody` (105); **log เฉพาะ status ≥ 500** พร้อม stack (111–114) เพราะ 400/404/409 เป็นผลที่คาดไว้ (กรอกผิด, session หมดอายุ, กดซ้ำ) ส่วน 500 คือสิ่งที่ไม่ควรเกิดและต้องตามรอยได้ (คอมเมนต์ 107–110)
- เขียนผลลง `response.status(...).json(body)` (116–117)

## 3. การส่งข้อมูล

```
throw (ใน parse*/service/engine/DB) ──► Nest ส่งเข้า filter ──► toErrorBody() ──► response.status(n).json({statusCode, code, message})
                                                                      └─ ถ้า ≥500: Logger.error(stack)
```
ตัวอย่าง response: `{"statusCode":400,"code":"SAFETY_CONFIRMATION_REQUIRED","message":"โหนด '…' เป็น safety_critical ต้องส่ง action 'confirm_safety' เท่านั้น …"}`
ฝั่ง frontend อ่าน `code` ไปเลือกข้อความภาษาไทย (ดู `frontend/src/lib/errors.ts`)

## 4. จุดที่ควรระวัง

- **error ที่ไม่รู้จักทั้งหมดกลายเป็น 500** รวมถึง `HttpException` ของ Nest ที่ถูกโยนใน controller (ฟังก์ชันไม่ตรวจชนิด `HttpException`) (อนุมานจากโค้ด)
- **ข้อความ error ดิบส่งออกไปให้ client** แม้เป็น 500 (บรรทัด 57, 97) เช่นข้อความจาก mysql2 อาจมีรายละเอียดภายใน — เสี่ยงเปิดเผยข้อมูลใน production (อนุมานจากโค้ด)
- ผู้ที่เพิ่ม error class ชนิดใหม่ต้องมาเพิ่มในตารางนี้เอง ไม่เช่นนั้นจะได้ 500 `INTERNAL_ERROR`
- `ApiErrorBody` (บรรทัด 40–44) ถูกใช้ร่วมกับ filter ของ symptom-search จึงถ้าเปลี่ยนรูปร่าง response จะกระทบทั้งสอง API ส่วนตาราง `toErrorBody` ของ symptom-search แยกกัน (3 error + `INTERNAL_ERROR`) ต้องแก้แยกสองที่

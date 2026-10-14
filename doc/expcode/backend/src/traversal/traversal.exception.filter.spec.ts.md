# backend/src/traversal/traversal.exception.filter.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของ `toErrorBody` ใน `traversal.exception.filter.ts` เน้น "ส่วนของผลลัพธ์ที่ผู้ใช้กรอก" และแถวเดิมที่ใกล้เคียงกัน เพื่อกันรหัสสลับกัน (คอมเมนต์ 4–5) — ตัวคลาส filter เองแค่เรียกฟังก์ชันนี้แล้วเขียน response จึงไม่ต้องเทสแยก (คอมเมนต์ 7–9)

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `InvalidOutcomeError`, `InvalidRequestBodyError` (จาก `./traversal.dto`), `toErrorBody` (จาก `./traversal.exception.filter`), `OutcomeAlreadySubmittedError`, `SessionNotCompletedError`, `SessionNotFoundError` (จาก `./traversal.service`)

## 2. อธิบายทีละบล็อก

### บล็อก A — `describe('toErrorBody — ผลลัพธ์ที่ผู้ใช้กรอก')` (บรรทัด 19–55) — 5 เทส
| บรรทัด | อินพุต | ผลที่คาดหวัง |
|---|---|---|
| 20 | `InvalidOutcomeError('text ต้องไม่ว่าง')` | 400 `INVALID_OUTCOME` ข้อความเดิม |
| 28 | `SessionNotCompletedError('s1')` | 409 `SESSION_NOT_COMPLETED` |
| 34 | `OutcomeAlreadySubmittedError('s1')` | 409 `OUTCOME_ALREADY_SUBMITTED` |
| 40 | `InvalidRequestBodyError('x')` และ `SessionNotFoundError('s1')` | ยังเป็น `INVALID_ACTION` และ 404 `SESSION_NOT_FOUND` (รหัสผลลัพธ์ไม่ปนรหัสเดิม) |
| 48 | `new Error(...)` และสตริง | 500 `INTERNAL_ERROR` เสมอ |

## 3. การส่งข้อมูล

Jest เรียก `toErrorBody(<error>)` แล้วเทียบด้วย `toEqual` / `toMatchObject` — ไม่มีการส่งข้อมูลข้ามไฟล์

## 4. จุดที่ควรระวัง

- **ครอบคลุมเฉพาะบางแถวของตาราง**: ไม่พบเทสของ `SafetyConfirmationRequiredError`, `InvalidActionError`, `SessionAlreadyCompletedError`, `GraphNotFoundError`, `NodeNotFoundError`, `UnsupportedSchemaVersionError` ในไฟล์นี้ (อาจถูกทดสอบทางอ้อมที่อื่น)
- import `traversal.service` ทำให้โหลดโมดูล service ทั้งไฟล์ แต่ไม่ได้สร้าง instance จึงไม่ต้องใช้ DB

# frontend/src/api/http.test.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Vitest) ของ `request` และ `ApiError` ใน `http.ts` โดยแทนที่ `fetch` ด้วยตัวปลอม จึงไม่ต้องมีเซิร์ฟเวอร์จริง

- **ใครเรียกใช้**: Vitest (`npm test`)
- **เรียกใช้**: `vitest` (`afterEach, describe, expect, it, vi`), `./http` (`ApiError`, `request`)

## 2. อธิบายทีละบล็อก

### บล็อก A — ตัวช่วย (บรรทัด 4–22)
- `mockFetch(impl)`: `vi.stubGlobal('fetch', vi.fn(impl))` คืน spy
- `jsonResponse(status, body)`: สร้าง `Response` แบบ JSON
- `afterEach`: `vi.unstubAllGlobals()` และ `vi.unstubAllEnvs()` คืนของปลอมทั้งหมด ไม่ให้เทสถัดไปได้ผลข้างเคียง

### บล็อก B — `describe('request')` (บรรทัด 24–88) — 5 เทส
| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 25 | คืน JSON เมื่อสำเร็จ และเรียก `fetch` ที่ `http://localhost:3000/traversal/graphs` (ต่อ URL จาก `VITE_API_URL`) |
| 35 | ตอบ 400 พร้อม `code` → โยน `ApiError` ที่ `status = 400`, `code = 'SAFETY_CONFIRMATION_REQUIRED'` |
| 55 | ตอบ 500 แต่ body เป็น HTML → ยังโยน `ApiError` (`status 500`) ไม่พังด้วย error อื่น (เกิดได้จริงเมื่อ Render ส่งหน้า error) |
| 67 | `fetch` ล้ม (`TypeError: Failed to fetch`) → `ApiError` `code = 'NETWORK_ERROR'` |
| 77 | `VITE_API_URL` เป็นค่าว่าง → โยน error ที่ข้อความมี `VITE_API_URL` (กันบั๊กเดิมที่ถอยไป localhost เงียบๆ) |

## 3. การส่งข้อมูล

Vitest เรียก `request(...)` โดยตรง; `fetch` ถูกแทนด้วย spy ที่คืน `Response` สำเร็จรูป ไม่มีการเรียกเครือข่ายจริง

## 4. จุดที่ควรระวัง

- **ไม่มีเทสกรณี 204** (DELETE) และกรณี 2xx ที่ body ไม่ใช่ JSON (ซึ่งโค้ดจริงไม่ได้ดักไว้ — ดูสรุป `http.ts`)
- ใช้ `vi.stubEnv` ตั้ง `VITE_API_URL` ต่อเทส จึงพึ่งการที่ `http.ts` อ่าน env ในฟังก์ชัน (ไม่ใช่ตอน import)
- เทสใช้ `Response` ของ Node (Node 18+) ไม่ใช้ jsdom

# frontend/src/api/http.ts

## 1. หน้าที่ของไฟล์

ชั้นเรียก HTTP ชั้นเดียวของ frontend : ฟังก์ชัน `request<T>(path, options)` ที่ห่อ `fetch` แล้วแปลง "ความล้มเหลวทุกแบบ" ให้เป็น `ApiError` ตัวเดียว (`status`, `code`, `message`) เพื่อให้หน้าจอไม่ต้องแยกแยะเองว่าเน็ตหลุดหรือเซิร์ฟเวอร์ตอบผิด

- **ใครเรียกใช้**: `api/traversal.ts` (ทุก endpoint), `lib/errors.ts` (ตรวจ `ApiError`), `pages/SymptomsPage.tsx`, `mocks/mockServer.ts` (โยน `ApiError` แบบเดียวกัน), และเทส (`http.test.ts`, `errors.test.ts`, `mockServer.test.ts`)
- **เรียกใช้**: type `ApiErrorBody` จาก `./types` ; `fetch` ของเบราว์เซอร์ ; `import.meta.env.VITE_API_URL`

## 2. อธิบายทีละบล็อก

### บล็อก A — `class ApiError extends Error` (บรรทัด 10–20)
field `status` (HTTP status; `0` = ไม่ได้ต่อถึงเซิร์ฟเวอร์), `code` (รหัสจาก backend เช่น `SAFETY_CONFIRMATION_REQUIRED` หรือ `NETWORK_ERROR`/`UNKNOWN_ERROR` ที่ frontend ตั้งเอง), `message` ; เขียน field แยกบรรทัดแทนการย่อใน constructor เพราะ `erasableSyntaxOnly` ห้ามไวยากรณ์แบบย่อ (คอมเมนต์ 7–8)

### บล็อก B — `getBaseUrl()` (บรรทัด 22–37)
อ่าน `import.meta.env.VITE_API_URL` **ในฟังก์ชัน ไม่ใช่บนสุดของไฟล์** ด้วย 2 เหตุผล (คอมเมนต์ 23–26): (1) ถ้าอ่านตอน import แล้วค่าหาย แอปจะขาวก่อน React วาดอะไร ไม่มีที่แสดงสาเหตุ (2) เทสใช้ `vi.stubEnv` หลัง import ซึ่งไม่ทันถ้าอ่านตอน import
ถ้าไม่ตั้งค่า โยน `Error('ไม่ได้ตั้งค่า VITE_API_URL — …')` **ตั้งใจไม่มีค่าสำรองเป็น localhost** (คอมเมนต์ 28–29: เป็นบั๊กเดิมของ `lib/api.ts` ที่ทำให้เว็บที่ deploy แล้วไปเรียกเซิร์ฟเวอร์ในเครื่องของผู้ใช้เอง)

### บล็อก C — `RequestOptions` (บรรทัด 39–42)
`method?: 'GET' | 'POST' | 'DELETE'`, `body?: unknown`

### บล็อก D — `request<T>()` (บรรทัด 44–90)
1. ประกอบ URL = `getBaseUrl()` + `path` (path ต้องขึ้นต้น `/`; base ต้องไม่มี `/` ท้าย) (52)
2. `fetch` โดยใส่ `Content-Type: application/json` และ `JSON.stringify(body)` เฉพาะเมื่อมี body (56–60) ; ถ้า `fetch` โยน error (เน็ตหลุด/เซิร์ฟเวอร์ดับ/CORS) → `ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')` (61–65)
3. ถ้า `!response.ok`: พยายาม `response.json()` เป็น `ApiErrorBody` (ดักกรณี body ไม่ใช่ JSON เช่น Render ส่งหน้า HTML) แล้วโยน `ApiError(status, parsed?.code ?? 'UNKNOWN_ERROR', parsed?.message ?? 'เซิร์ฟเวอร์ตอบรหัส N')` (67–82)
4. ถ้า `status === 204` คืน `undefined as T` (DELETE ไม่มี body) (85–87)
5. มิฉะนั้นคืน `(await response.json()) as T` (89)

## 3. การส่งข้อมูล

```
traversal.ts ──request('/traversal/sessions', {method:'POST', body:{graphId}})──► fetch ──HTTP/JSON──► backend
            ◄── T (JSON) หรือ throw ApiError(status, code, message)
```
ตัวอย่างความล้มเหลว: backend ตอบ 400 `{"statusCode":400,"code":"SAFETY_CONFIRMATION_REQUIRED","message":"…"}` → `ApiError(400, 'SAFETY_CONFIRMATION_REQUIRED', …)`

## 4. จุดที่ควรระวัง

- **ตอบ 2xx แต่ body ไม่ใช่ JSON จะโยน `SyntaxError` ธรรมดา ไม่ใช่ `ApiError`** (บรรทัด 89 ไม่มี try/catch) — เช่น พร็อกซีตอบ 200 เป็น HTML (อนุมานจากโค้ด)
- **ไม่มี timeout / AbortController**: ถ้าเซิร์ฟเวอร์ไม่ตอบ (เช่น Render ฟรีกำลังตื่น) คำขอจะรอจนเบราว์เซอร์ตัดเอง — ฝั่งหน้าจอจึงมีตัวช่วยแจ้ง "เซิร์ฟเวอร์ช้า" แยกต่างหาก (ดู `SlowServerNotice`, `useSlowWait`)
- `VITE_API_URL` ที่มี `/` ท้ายจะทำให้ URL เป็น `//…` (ไม่มีการ normalize)
- `RequestOptions.method` จำกัด 3 แบบ ไม่รองรับ PUT/PATCH

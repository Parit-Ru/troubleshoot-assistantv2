# frontend/src/api/traversal.ts

## 1. หน้าที่ของไฟล์

หนึ่งฟังก์ชันต่อหนึ่ง endpoint ของ backend — เป็นจุดเดียวในทั้งแอปที่ "รู้ว่ามี mock อยู่" : ถ้า `VITE_USE_MOCK === 'true'` จะโหลด `mocks/mockServer` แบบ dynamic import มาตอบแทน ไม่ยิง HTTP หน้าจอเรียกฟังก์ชันเหล่านี้โดยไม่รู้ว่าข้างหลังเป็นของจริงหรือของจำลอง

- **ใครเรียกใช้**: `api/queries.ts` เท่านั้น
- **เรียกใช้**: `./http` (`request`), type จาก `./types`, และ `../mocks/mockServer` (ผ่าน `await import(...)` เฉพาะโหมดจำลอง)

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์เตือนเรื่อง mock (บรรทัด 4–16)
⚠️ เงื่อนไข `import.meta.env.VITE_USE_MOCK === 'true'` ต้องเขียนตรงๆ ในทุกฟังก์ชัน **ห้ามเก็บลงตัวแปรใช้ซ้ำ** เพราะตอน build Vite แทนค่าเป็นข้อความตรงๆ แล้วตัดโค้ดที่ไม่มีทางทำงานทิ้ง พร้อมไฟล์ `mockServer` ทั้งไฟล์ ถ้าเก็บลงตัวแปร Vite อาจตัดไม่ได้ และข้อมูลผังขั้นตอนจะหลุดเข้า build จริง ; ใช้ `await import(...)` ไม่ใช่ import ธรรมดาด้วยเหตุผลเดียวกัน

### บล็อก B — `HealthResponse` และ `getHealth` (บรรทัด 18–36)
`HealthResponse` = `{status: 'ok'|'degraded', service, database, timestamp, environment}` (ลอกจาก `health.controller.ts` — field `databaseError` ที่ backend ส่งเมื่อ DB ล้มไม่อยู่ในชนิดนี้) ; `getHealth()` เรียก `GET /health` เสมอ **ไม่มีทางไป mock** (หน้าที่คือเช็คเซิร์ฟเวอร์จริง ในโหมดจำลองหน้าจอไม่เรียก)

### บล็อก C — ฟังก์ชันของแต่ละ endpoint (บรรทัด 38–134)
| ฟังก์ชัน | endpoint | หมายเหตุ |
|---|---|---|
| `listGraphs()` | `GET /traversal/graphs` | |
| `startSession(graphId, query?)` | `POST /traversal/sessions` body `{graphId, query}` | `query` ส่งเฉพาะตอนเลือกจากผลค้นหา (เซิร์ฟเวอร์คำนวณคะแนนเอง); `undefined` ถูก `JSON.stringify` ตัดทิ้งเอง ; **โหมดจำลองเรียก `mock.startSession(graphId)` โดยไม่ส่ง query** |
| `searchSymptoms(query)` | `POST /symptom-search` body `{query}` | โหมดจำลองเรียก `mock.searchSymptoms()` ไม่ส่ง query |
| `getSession(sessionId)` | `GET /traversal/sessions/:id` | ใช้ `encodeURIComponent` เพราะ sessionId มาจาก URL ที่ผู้ใช้แก้เองได้ |
| `submitAction(sessionId, action)` | `POST …/actions` body = `TraversalAction` | |
| `submitOutcome(sessionId, text)` | `POST …/outcome` body `{text}` | |
| `abandonSession(sessionId)` | `DELETE …/:id` | คืน `void` |

## 3. การส่งข้อมูล

```
queries.ts ► traversal.startSession() ─(VITE_USE_MOCK==='true')► import('../mocks/mockServer') ► engine ในเบราว์เซอร์
                                      └(ปกติ)► http.request ► HTTP JSON ► backend
```

## 4. จุดที่ควรระวัง

- **โหมดจำลองกับของจริงต่างกัน** ที่ `startSession`/`searchSymptoms` : mock ไม่รับ `query` จึงไม่มี `confidence` (เป็น `null` เสมอ) และ `searchSymptoms` ของ mock โยน 503 `SEARCH_UNAVAILABLE` เสมอ ไม่ว่าจะค้นอะไร (ดู `mockServer.ts`)
- ชนิด `HealthResponse` ไม่มี field `databaseError` ที่ backend ส่งเมื่อ DB ล้ม (ตาม `health.controller.ts`) — TypeScript ไม่ฟ้องเพราะเป็นข้อมูลเกิน
- ข้อมูลผังขั้นตอนจะติดเข้า build จริงถ้าตัดโค้ดไม่สำเร็จ (ตามคำเตือน) จึงต้องรักษารูปแบบ `if (import.meta.env.VITE_USE_MOCK === 'true')` ไว้
- `getHealth` ไม่เป็น `async` แต่คืน Promise จาก `request` (สอดคล้องกับชนิดที่ประกาศ)

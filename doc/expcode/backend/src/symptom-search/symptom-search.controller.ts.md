# backend/src/symptom-search/symptom-search.controller.ts

## 1. หน้าที่ของไฟล์

ประตู HTTP ของงานค้นหาอาการ มี 2 endpoint: `POST /symptom-search` (ค้นหา) และ `GET /symptom-search/status` (ดูสถานะการโหลดโมเดลและหน่วยความจำ) ออกแบบให้ "โง่" เหมือน `TraversalController` คือตรวจรูปร่าง body ด้วย `parseSearchBody` แล้วส่งต่อ service ไม่จับ error เอง

- **ใครเรียกใช้**: `symptom-search.module.ts` (ลงทะเบียน controller); ฝั่ง frontend เรียกผ่าน `searchSymptoms()` ใน `frontend/src/api/traversal.ts`
- **เรียกใช้**: `./symptom-search.dto`, `./symptom-search.exception.filter`, `./symptom-search.service`

## 2. อธิบายทีละบล็อก

### บล็อก A — decorator ระดับคลาส (บรรทัด 24–27)
`@Controller('symptom-search')` + `@UseFilters(SymptomSearchExceptionFilter)`; constructor ฉีด `SymptomSearchService`

### บล็อก B — `POST /symptom-search` (บรรทัด 29–35)
`@Post()` + `@HttpCode(200)` — ตอบ 200 ไม่ใช่ 201 เพราะการค้นหาไม่ได้สร้างทรัพยากรใหม่ (คอมเมนต์ 11) ; `parseSearchBody(body)` ได้ `query` แล้ว `searchService.search(query)`
- **รับ**: `{ "query": "…" }` — **คืน**: `SymptomSearchResponseDto`

### บล็อก C — `GET /symptom-search/status` (บรรทัด 37–41)
`@Get('status')` → `searchService.getStatus()` คืน `SearchStatusDto` (ไว้ดูความคืบหน้าการโหลดโมเดล/หน่วยความจำ)

## 3. การส่งข้อมูล

| Method + Path | เข้า | ออก | error ที่อาจเกิด |
|---|---|---|---|
| POST `/symptom-search` | `{query}` JSON | 200 `SymptomSearchResponseDto` | 400 `INVALID_QUERY`, 503 `SEARCH_NOT_READY`, 503 `SEARCH_UNAVAILABLE`, 500 `INTERNAL_ERROR` |
| GET `/symptom-search/status` | – | 200 `SearchStatusDto` | – |

## 4. จุดที่ควรระวัง

- `GET /symptom-search/status` เปิดเผยข้อมูลภายใน (ขนาด RAM, ชื่อโมเดล, ข้อความ error ของการโหลด) ให้ทุกคนที่เรียกได้ โดยไม่มีการยืนยันตัวตน (อนุมานจากโค้ด; เหมาะกับการใช้ตรวจบน Render)
- ไม่มีการจำกัดอัตราการเรียก (rate limit) ในไฟล์นี้ ขณะที่การค้นหาแต่ละครั้งรันโมเดลบน CPU (อนุมานจากโค้ด)

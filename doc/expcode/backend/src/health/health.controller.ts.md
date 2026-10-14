# backend/src/health/health.controller.ts

## 1. หน้าที่ของไฟล์

เปิด endpoint `GET /health` เพื่อบอกว่าบริการยังทำงานอยู่ไหมและฐานข้อมูลตอบสนองไหม โดยยิง `SELECT 1` ไปที่ MySQL

- **ใครเรียก**: `health.module.ts` (ลงทะเบียนเป็น controller); ฝั่ง frontend เรียก endpoint นี้ผ่าน `getHealth()` ใน `frontend/src/api/traversal.ts` (แสดงที่ `ServerStatus`)
- **เรียกใช้**: `../database/database.constants` (token `MYSQL_POOL`) และ type `Pool` จาก `mysql2/promise`

## 2. อธิบายทีละบล็อก

### บล็อก A — import และ decorator (บรรทัด 1–7)
`@Controller('health')` ทำให้เส้นทางฐานคือ `/health`

### บล็อก B — constructor (บรรทัด 8–14)
- รับ `pool` ด้วย `@Inject(MYSQL_POOL)`
- คอมเมนต์ 11–12 บอกว่า `health.module.ts` ไม่ได้ import `DatabaseModule` แต่ขอ pool ได้เพราะ `DatabaseModule` เป็น `@Global()`

### บล็อก C — `check()` ที่ `@Get()` (บรรทัด 16–38)
- **ทำอะไร**: (บรรทัด 20–28) ตั้ง `database = 'ok'` แล้วลอง `pool.query('SELECT 1')` ถ้า error เปลี่ยนเป็น `'error'` และเก็บข้อความ error
- **ทำไม**: ใช้ `SELECT 1` เพราะเบากว่าการนับแถวและไม่ผูกกับตารางใด (คอมเมนต์ 18–19)
- **คืน** (บรรทัด 30–37) object JSON:
  - `status`: `'ok'` ถ้า DB ปกติ ไม่เช่นนั้น `'degraded'`
  - `service`: `'fixbot-backend'` (ค่าคงที่)
  - `database`: `'ok' | 'error'`
  - `databaseError` (เฉพาะเมื่อมี error — ใช้ spread แบบมีเงื่อนไข บรรทัด 34)
  - `timestamp`: ISO string ปัจจุบัน
  - `environment`: `NODE_ENV` หรือ `'development'`

## 3. การส่งข้อมูล

`เบราว์เซอร์/frontend → GET /health → controller → pool.query('SELECT 1') → MySQL`
ตอบกลับเป็น JSON เช่น

```json
{ "status": "ok", "service": "fixbot-backend", "database": "ok",
  "timestamp": "2026-10-05T10:00:00.000Z", "environment": "development" }
```

เมื่อ DB ล้ม ตอบเป็น `status: "degraded"`, `database: "error"` พร้อม `databaseError`

## 4. จุดที่ควรระวัง

- **ตอบ HTTP 200 แม้ DB ล้ม** (ไม่มี throw) ผู้เรียกต้องอ่าน field `status` เอง ไม่ใช่ดู status code
- **`databaseError` ส่งข้อความ error ดิบของ DB ออกไปให้ผู้เรียก** ซึ่งอาจเปิดเผยรายละเอียดภายใน (เช่น ชื่อ host) ในสภาพแวดล้อม production (อนุมานจากโค้ด)
- ชื่อ service เป็น `fixbot-backend` ซึ่งต่างจากชื่อโฟลเดอร์ FixStep
- endpoint นี้ไม่ตรวจสถานะการโหลดโมเดล embedding / ดัชนีค้นหาอาการ — แสดงเฉพาะสถานะ DB

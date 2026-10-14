# backend/src/database/database.module.ts

## 1. หน้าที่ของไฟล์

สร้าง connection pool ของ MySQL (`mysql2/promise`) ตอนเปิดเซิร์ฟเวอร์ ทดสอบการเชื่อมต่อทันที แล้วแจก pool ให้ทุกโมดูลผ่าน token `MYSQL_POOL` และปิด pool ตอนแอปปิดตัว

- **ใครเรียก**: `app.module.ts` (import เป็นโมดูลแรก)
- **เรียกใช้**: `./database.constants` (token), `mysql2/promise`, `@nestjs/common`
- **ใครใช้ pool ต่อ**: `health.controller.ts`, `graph.repository.ts`, `equipment.repository.ts`, `session.store.ts`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 1–4)
นำเข้า decorator ของ Nest (`Global`, `Module`, `Logger`, `OnApplicationShutdown`, `Inject`), `mysql2/promise` และ token

### บล็อก B — `normalizePem` (บรรทัด 6–11)
- **รับ**: string ใบรับรอง CA — **คืน**: string ที่แปลงอักษร `\n` (ทับ+n สองตัว) เป็นการขึ้นบรรทัดจริงแล้ว `trim()`
- **ทำไม**: คอมเมนต์ 6–8 บอกว่าบางแพลตฟอร์มเก็บ env หลายบรรทัดเป็นบรรทัดเดียว ถ้ามีขึ้นบรรทัดจริงอยู่แล้วฟังก์ชันไม่เปลี่ยนอะไร

### บล็อก C — `buildPoolOptions` (บรรทัด 13–44)
- **บรรทัด 14–25**: ตรวจ env ที่จำเป็น 4 ตัว `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` ถ้าขาดจะโยน `Error` พร้อมข้อความภาษาไทยบอกให้คัดลอก `backend/.env.example` เป็น `backend/.env`
- **บรรทัด 27–43**: คืน `PoolOptions` — `host`, `port` (แปลงเป็น Number), `user`, `password` (ไม่มีให้ใช้ `''`), `database`, `charset: 'utf8mb4'` (รองรับภาษาไทย/อีโมจิ), `waitForConnections: true`, `connectionLimit: 5` (คอมเมนต์ 37: พอสำหรับงานขนาดนี้และปลอดภัยกับ MySQL cloud ฟรี), `queueLimit: 0` (ไม่จำกัดคิวรอ), `ssl` — ถ้ามี `DB_SSL_CA` ใช้ `{ ca: normalizePem(...) }` ไม่มีให้ `undefined`
- `DB_PASSWORD` และ `DB_SSL_CA` ไม่อยู่ในรายการ "จำเป็น" (เป็นตัวเลือก)

### บล็อก D — `@Global() @Module(...)` provider (บรรทัด 46–75)
- `@Global()` (46): ทำให้ `MYSQL_POOL` ใช้ได้ทุกโมดูลโดยไม่ต้อง import `DatabaseModule` ซ้ำ (ยืนยันจากคอมเมนต์ใน `health.controller.ts`, `graph.module.ts`, `traversal.module.ts`)
- provider (48–72) เป็นแบบ `useFactory` แบบ async:
  1. สร้าง `Logger('DatabaseModule')` (56)
  2. สร้างตัวเลือก (57) และ `mysql.createPool` (58)
  3. ลอง `getConnection` → `ping` → `release` (60–62) แล้ว log "เชื่อมต่อ MySQL สำเร็จ" (64)
  4. ถ้าล้มเหลว log error แล้ว `throw err` (65–68) — ทำให้แอปไม่บูต
  5. คืน `pool` (70)
- `exports: [MYSQL_POOL]` (74)

### บล็อก E — `class DatabaseModule implements OnApplicationShutdown` (บรรทัด 76–82)
constructor ขอ pool (77) และ `onApplicationShutdown` เรียก `pool.end()` แล้ว log "ปิดการเชื่อมต่อ MySQL แล้ว" (78–81)

## 3. การส่งข้อมูล

- **เข้า**: ตัวแปรสภาพแวดล้อม `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA` (อ่านจาก `process.env` ซึ่งถูกโหลดโดย `dotenv/config` ใน `main.ts`) — ค่าจริงในไฟล์ `.env` ไม่ถูกเปิดอ่านในการสรุปนี้
- **ออก**: object `mysql.Pool` ถูกเก็บไว้ใน container ของ Nest แล้วฉีดเข้า constructor ของ repository/controller ต่างๆ
- **ปลายทาง**: เครือข่ายไปยังเซิร์ฟเวอร์ MySQL (TCP + TLS เมื่อมี CA)

## 4. จุดที่ควรระวัง

- **pool ไม่ถูกปิดเมื่อ ping ล้มเหลว** (บรรทัด 65–68): โค้ดโยน error ออกไปโดยไม่เรียก `pool.end()` — แอปไม่บูตอยู่แล้วจึงมีผลน้อย
- **`onApplicationShutdown` จะถูกเรียกก็ต่อเมื่อมีการเปิด `enableShutdownHooks()` หรือเรียก `app.close()`**: `main.ts` ไม่ได้เรียก `enableShutdownHooks` ตามธรรมชาติของ NestJS ดังนั้นการกด Ctrl+C อาจไม่ผ่านเมธอดนี้ (อนุมานจากโค้ด `main.ts` + พฤติกรรมมาตรฐานของ Nest)
- ถ้าเซิร์ฟเวอร์ MySQL ใช้ TLS แต่ไม่ตั้ง `DB_SSL_CA` จะต่อแบบไม่ใส่ CA ซึ่งขึ้นกับการตั้งค่าฝั่งเซิร์ฟเวอร์
- `connectionLimit: 5` เป็นค่าคงที่ในโค้ด ปรับไม่ได้ผ่าน env

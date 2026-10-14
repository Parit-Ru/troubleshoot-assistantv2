# backend/src/main.ts

## 1. หน้าที่ของไฟล์

จุดเริ่มต้นของ backend (NestJS): โหลดตัวแปรสภาพแวดล้อมจาก `.env`, สร้างแอปจาก `AppModule`, เปิด CORS ให้ frontend เรียกข้ามโดเมนได้ แล้วเริ่มฟังพอร์ต

- **ใครเรียก**: ไม่มีไฟล์ไหน import ไฟล์นี้ — เป็น entry point ที่ถูกรันโดย `nest start` / `nest start --watch` (สคริปต์ `start`, `start:dev` ใน `backend/package.json`) และ `node dist/main.js` (สคริปต์ `start:prod`) โดย `nest-cli.json` ตั้ง `sourceRoot` เป็น `src`
- **เรียกใช้**: `dotenv/config`, `@nestjs/core` (`NestFactory`) และ `./app.module`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 1–3)
- บรรทัด 1 `import 'dotenv/config'` อ่านไฟล์ `.env` เข้า `process.env` ตั้งแต่ต้น ต้องอยู่ก่อน `AppModule` เพราะโมดูลอื่นอ่าน env ตอน import/สร้าง (อนุมานจากลำดับ import)
- บรรทัด 2–3 นำเข้า `NestFactory` และ `AppModule`

### บล็อก B — `bootstrap()` (บรรทัด 5–16)
- **บรรทัด 6**: `NestFactory.create(AppModule)` สร้างแอป Nest ซึ่งจะประกอบโมดูลทั้งหมด (Database, Health, Traversal, SymptomSearch) และรัน lifecycle เช่น การเชื่อมต่อ DB / โหลดโมเดล
- **บรรทัด 8–11**: `app.enableCors({ origin, credentials: true })` — `origin` มาจาก `process.env.CORS_ORIGIN` ถ้าไม่ตั้งใช้ `http://localhost:5173` (พอร์ตมาตรฐานของ Vite) เพื่อให้ browser ยอมให้ frontend เรียก API ได้
- **บรรทัด 13**: `port = process.env.PORT ?? 3000`
- **บรรทัด 14**: `await app.listen(port)` เริ่มรับ request
- **บรรทัด 15**: log ว่า "FixBot backend running on port …"

### บล็อก C — เรียกใช้ (บรรทัด 18)
`bootstrap();` เรียกโดยไม่มี `.catch`

- **รับอะไร**: env `CORS_ORIGIN`, `PORT` (และ env อื่นที่โมดูลลูกอ่าน)
- **คืนอะไร**: ไม่คืนค่า มีผลข้างเคียงคือเปิด HTTP server

## 3. การส่งข้อมูล

ไฟล์นี้ไม่ได้ส่งข้อมูลธุรกิจ แต่กำหนด "ประตู" ที่ HTTP request เข้ามา:
`ผู้ใช้/เบราว์เซอร์ → HTTP :PORT → Nest (Controller ในแต่ละโมดูล)`
CORS ตอบ header ให้ origin เดียวที่กำหนด (เช่น `http://localhost:5173`)

## 4. จุดที่ควรระวัง

- **ไม่มี global prefix, ไม่มี `ValidationPipe`**: ไฟล์นี้ไม่ตั้งค่าเหล่านี้ การตรวจ body ไปอยู่ที่ฟังก์ชัน `parse*` ใน DTO ที่เขียนเอง (อนุมานจากโค้ด)
- **`bootstrap()` ไม่มี try/catch หรือ `.catch`**: ถ้าสร้างแอปล้มเหลว (เช่น ต่อ DB ไม่ได้) จะเกิด unhandled rejection
- **CORS รองรับ origin เดียว**: ใส่หลายโดเมนไม่ได้ผ่าน env ตัวนี้ตรงๆ
- **`credentials: true`** เปิดไว้ แม้โค้ดที่เห็นยังไม่มีส่วนที่ใช้ cookie (อนุมานจากโค้ด)
- ข้อความ log ใช้ชื่อ "FixBot" ต่างจากชื่อโปรเจกต์ FixStep ในโฟลเดอร์ — อาจเป็นชื่อเดิมที่ยังไม่ถูกเปลี่ยน
- `process.env.PORT` เป็น string ส่วน `3000` เป็น number แต่ `listen` รับได้ทั้งสองแบบ

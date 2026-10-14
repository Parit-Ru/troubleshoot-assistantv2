# backend/src/health/health.module.ts

## 1. หน้าที่ของไฟล์

โมดูล Nest ขนาดเล็กที่ลงทะเบียน `HealthController` เป็นโมดูลย่อยของแอป ไม่มี provider หรือ import อื่น

- **ใครเรียก**: `app.module.ts`
- **เรียกใช้**: `./health.controller`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 1–2)
นำเข้า `Module` และ `HealthController`

### บล็อก B — `@Module({ controllers: [HealthController] })` (บรรทัด 4–7)
- **ทำอะไร**: บอก Nest ว่า `HealthController` อยู่ในโมดูลนี้
- **ทำไมไม่ต้อง import `DatabaseModule`**: `DatabaseModule` เป็น `@Global()` (ดู `database.module.ts` บรรทัด 46) จึงให้ `MYSQL_POOL` กับ controller ได้เอง
- **รับ/คืน**: ไม่มี

## 3. การส่งข้อมูล

ไม่มีการส่งข้อมูลโดยตรง ทำหน้าที่ต่อ controller เข้ากับแอป: `AppModule → HealthModule → HealthController (GET /health)`

## 4. จุดที่ควรระวัง

ไม่พบจุดน่าสงสัย ไฟล์เรียบง่ายตามแบบมาตรฐานของ Nest

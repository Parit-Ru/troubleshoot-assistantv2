# backend/nest-cli.json

## 1. หน้าที่ของไฟล์

ไฟล์ตั้งค่าของ Nest CLI (`nest build`, `nest start`) บอกว่าซอร์สโค้ดอยู่ที่ไหนและให้ลบโฟลเดอร์ผลลัพธ์ก่อน build ใหม่

- **ใครเรียกใช้**: Nest CLI เมื่อรันสคริปต์ `build`, `start`, `start:dev` ใน `backend/package.json`
- **เรียกใช้**: `@nestjs/schematics` (ระบุเป็น `collection`)

## 2. อธิบายทีละบล็อก

| บรรทัด | key | ค่า | ความหมาย |
|---|---|---|---|
| 2 | `$schema` | `https://json.schemastore.org/nest-cli` | ให้ editor ตรวจ/เติมโครงสร้างไฟล์ |
| 3 | `collection` | `@nestjs/schematics` | ชุดแม่แบบสำหรับคำสั่ง generate ของ Nest |
| 4 | `sourceRoot` | `src` | โฟลเดอร์ซอร์ส (ที่มี `main.ts`) |
| 5–7 | `compilerOptions.deleteOutDir` | `true` | ลบโฟลเดอร์ผลลัพธ์ (`dist`) ก่อน build ใหม่ |

## 3. การส่งข้อมูล

ไม่มีการส่งข้อมูล: CLI อ่านไฟล์นี้ + `tsconfig.json` / `tsconfig.build.json` → คอมไพล์ `src/` ออกเป็น `dist/` (ตาม `outDir` ใน `tsconfig.json`) แล้ว `start:prod` รัน `node dist/main.js`

## 4. จุดที่ควรระวัง

- `deleteOutDir: true` จะลบ `dist/` ทั้งโฟลเดอร์ทุกครั้งที่ build — ห้ามเก็บไฟล์อื่นไว้ใน `dist/`
- ไม่ได้ระบุ `tsConfigPath` เอง Nest CLI จึงใช้ค่าเริ่มต้น (`tsconfig.build.json` สำหรับ `nest build`) ซึ่งตัดไฟล์ `*spec.ts` ออกจากการ build (ดูสรุป `tsconfig.build.json`)
- ไม่ได้ตั้ง `assets` ดังนั้นไฟล์ที่ไม่ใช่ `.ts` ใน `src/` จะไม่ถูกคัดลอกไป `dist/` — ข้อมูลโมเดลอยู่นอก `src` (`backend/model-slim`) จึงเข้าถึงด้วย path สัมพัทธ์จาก `dist` (ดู `embedding.service.ts`)

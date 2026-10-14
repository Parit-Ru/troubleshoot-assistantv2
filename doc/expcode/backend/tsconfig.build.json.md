# backend/tsconfig.build.json

## 1. หน้าที่ของไฟล์

config สำหรับ "build จริง" (`nest build`): สืบทอดทุกอย่างจาก `tsconfig.json` แล้วจำกัดให้คอมไพล์เฉพาะ `src/**/*` และตัดไฟล์เทส (`*spec.ts`) ออก

- **ใครเรียกใช้**: Nest CLI (`nest build`) ใช้เป็นค่าเริ่มต้น
- **เรียกใช้**: `./tsconfig.json` (ผ่าน `extends`)

## 2. อธิบายทีละบล็อก

| บรรทัด | key | ค่า | ความหมาย |
|---|---|---|---|
| 2 | `extends` | `./tsconfig.json` | รับ option ทั้งหมดจากไฟล์หลัก |
| 3 | `include` | `["src/**/*"]` | คอมไพล์ทุกไฟล์ใต้ `src` |
| 4 | `exclude` | `["node_modules","dist","**/*spec.ts"]` | ไม่คอมไพล์ `node_modules`, `dist` และไฟล์ที่ลงท้าย `spec.ts` |

## 3. การส่งข้อมูล

`nest build` → อ่านไฟล์นี้ → คอมไพล์ `src` ยกเว้นเทส → `dist/`

## 4. จุดที่ควรระวัง

- `exclude` รูปแบบ `**/*spec.ts` ตัดเฉพาะชื่อที่ลงท้าย `spec.ts` ถ้ามีไฟล์เทสชื่ออื่น (เช่น `*.test.ts`) จะถูก build เข้าไปด้วย — ปัจจุบันเทสทุกไฟล์ใช้ `.spec.ts`
- เนื่องจากไฟล์ spec ถูกตัดออกจาก build แต่ `tsconfig.json` ยังมี `types: ["node","jest"]` type ของ Jest จึงไม่ได้ถูกใช้ในโค้ดที่ build

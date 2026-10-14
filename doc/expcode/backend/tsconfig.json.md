# backend/tsconfig.json

## 1. หน้าที่ของไฟล์

ตั้งค่าคอมไพเลอร์ TypeScript ของ backend (NestJS): รูปแบบโมดูล, เป้าหมาย JS, โฟลเดอร์ซอร์ส/ผลลัพธ์ และระดับความเข้มงวดของการตรวจ type

- **ใครเรียกใช้**: Nest CLI (`nest build`/`start`), `ts-jest` (ตอนรันเทส), editor; และ `tsconfig.build.json` ที่ `extends` ไฟล์นี้
- **เรียกใช้**: ไม่มี

## 2. อธิบายทีละบล็อก

| บรรทัด | option | ค่า | ความหมาย |
|---|---|---|---|
| 3 | `module` | `commonjs` | ออกโค้ดแบบ `require`/`module.exports` ที่ Nest 10 ใช้ |
| 4 | `types` | `["node","jest"]` | โหลด type ของ Node และ Jest เท่านั้น |
| 5 | `declaration` | `true` | สร้างไฟล์ `.d.ts` |
| 6 | `removeComments` | `true` | ตัดคอมเมนต์ออกจาก JS ที่คอมไพล์ |
| 7–8 | `emitDecoratorMetadata`, `experimentalDecorators` | `true` | จำเป็นกับ decorator + DI ของ Nest |
| 9 | `allowSyntheticDefaultImports` | `true` | ยอม `import x from` กับโมดูลที่ไม่มี default |
| 10 | `target` | `ES2021` | ระดับภาษา JS ที่ออก |
| 11 | `sourceMap` | `true` | สร้าง source map |
| 13–14 | `rootDir` / `outDir` | `./src` / `./dist` | ซอร์สอยู่ `src` ผลลัพธ์ไป `dist` |
| 16 | `incremental` | `false` | ไม่ใช้ build แบบเพิ่มทีละส่วน |
| 17 | `skipLibCheck` | `true` | ข้ามการตรวจไฟล์ `.d.ts` ของ library |
| 18 | `strictNullChecks` | `true` | ตรวจ `null`/`undefined` เข้มงวด |
| 19 | `noImplicitAny` | `false` | ยอมให้ type เป็น `any` โดยไม่ประกาศ |
| 20 | `strictBindCallApply` | `false` | ผ่อน strict ของ bind/call/apply |
| 21 | `forceConsistentCasingInFileNames` | `true` | ห้ามสะกดตัวพิมพ์เล็กใหญ่ของชื่อไฟล์ไม่ตรงกัน |
| 22 | `noFallthroughCasesInSwitch` | `false` | ยอมให้ `case` ตกต่อกัน |

## 3. การส่งข้อมูล

ไม่มีการส่งข้อมูล: `src/**/*.ts` → คอมไพล์ → `dist/**/*.js` (เช่น `src/main.ts` → `dist/main.js`)

## 4. จุดที่ควรระวัง

- **ไม่เปิด `strict` ทั้งชุด**: เปิดเฉพาะ `strictNullChecks`; `noImplicitAny: false` จึงมี `any` ที่ไม่ถูกจับได้ (เช่นกับ `RowDataPacket`)
- **`rootDir: ./src` ทำให้ import ข้ามไป `data/` (นอก backend) ด้วยไวยากรณ์ import ตรงๆ ไม่ได้** และไม่ได้เปิด `resolveJsonModule` — ตามที่ `traversal.service.spec.ts` อธิบาย เทสและสคริปต์จึงอ่านไฟล์ JSON ด้วย `fs.readFileSync`
- **ผลต่อ path ของโมเดล**: เมื่อ `rootDir=./src` และ `outDir=./dist` ไฟล์ `src/symptom-search/embedding.service.ts` ถูกคอมไพล์เป็น `dist/symptom-search/embedding.service.js` ดังนั้น `path.resolve(__dirname, '../../model-slim')` ชี้ `backend/model-slim` ทั้งตอนรันจาก `src` และ `dist` ตรงกับคอมเมนต์ในโค้ด
- **`module: commonjs` กับ dynamic `import('@huggingface/transformers')`**: TypeScript จะคอมไพล์เป็นการเรียก `require` ซึ่งใช้ได้เมื่อแพ็กเกจให้ entry แบบ CommonJS (อนุมานจากโค้ด; ระบบรันได้จริงตามบันทึกใน `backend/docs/`)
- `types: ["node","jest"]` ทำให้โค้ดโปรดักชันมองเห็น type ของ Jest ด้วย (ใช้ร่วมกับ `tsconfig.build.json` ที่ตัดไฟล์ spec ออก)

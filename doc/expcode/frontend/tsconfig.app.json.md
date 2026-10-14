# frontend/tsconfig.app.json

## 1. หน้าที่ของไฟล์

ตั้งค่าการตรวจ type ของโค้ดแอปใน `frontend/src` (React + TypeScript แบบ bundler mode, ไม่ปล่อยไฟล์ `noEmit`)

- **ใครเรียกใช้**: `tsc -b` ผ่าน `tsconfig.json` ; editor
- **เรียกใช้**: ไม่มี ; `types: ["vite/client"]` ทำให้รู้จัก `import.meta.env` และ asset import

## 2. อธิบายทีละบล็อก

| บรรทัด | option | ค่า | ความหมาย |
|---|---|---|---|
| 3 | `tsBuildInfoFile` | `./node_modules/.tmp/tsconfig.app.tsbuildinfo` | เก็บแคช build แบบเพิ่มทีละส่วน |
| 4–5 | `target`, `lib` | `es2023`, `["ES2023","DOM"]` | ภาษา JS และ type ของเบราว์เซอร์ |
| 6 | `module` | `esnext` | |
| 7 | `types` | `["vite/client"]` | |
| 8–9 | `allowArbitraryExtensions`, `skipLibCheck` | `true` | |
| 12 | `moduleResolution` | `bundler` | ให้ตัว bundler (Vite) จัดการ resolve |
| 13 | `allowImportingTsExtensions` | `true` | import ไฟล์ `.ts` ด้วยนามสกุลได้ |
| 14 | `verbatimModuleSyntax` | `true` | บังคับใช้ `import type` กับ type ล้วน |
| 15 | `moduleDetection` | `force` | ทุกไฟล์เป็น module |
| 16–17 | `noEmit`, `jsx` | `true`, `react-jsx` | ไม่ปล่อยไฟล์ ; JSX แบบ runtime ใหม่ |
| 20–23 | `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch` | `true` | จับตัวแปร/พารามิเตอร์ที่ไม่ใช้ ; ห้ามไวยากรณ์ TS ที่ไม่ใช่ type ล้วน (enum, namespace, parameter properties) ; ห้าม switch ตกต่อกัน |
| 25 | `include` | `["src"]` | ตรวจทุกไฟล์ใน `src` (รวม `*.test.ts`) |

## 3. การส่งข้อมูล

ไม่มี (config) : `src/**/*.{ts,tsx}` → ตรวจ type → รายงาน error ; Vite/esbuild เป็นตัวแปลงจริง

## 4. จุดที่ควรระวัง

- ไม่ได้ใช้ `"strict": true` โดยตรง — แม่แบบ Vite รุ่นนี้ไม่ได้ระบุ `strict` ไว้ในไฟล์ ดังนั้น strict mode ขึ้นกับค่าเริ่มต้นของ TypeScript 6 (อนุมานจากไฟล์ ; ไม่ได้ทดลองตรวจ)
- `erasableSyntaxOnly` + `verbatimModuleSyntax` ทำให้ต้องเขียน `import type { … }` และห้ามใช้ enum — มีผลต่อรูปแบบโค้ดทั้ง frontend (เช่น การ re-export type จาก backend ผ่าน `export type {…} from`)
- `include: ["src"]` รวมไฟล์เทสด้วย จึงต้อง type ถูกต้องเมื่อ `npm run build`

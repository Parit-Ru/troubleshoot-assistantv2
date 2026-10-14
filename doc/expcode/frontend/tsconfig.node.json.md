# frontend/tsconfig.node.json

## 1. หน้าที่ของไฟล์

ตั้งค่าการตรวจ type สำหรับไฟล์ config ที่รันบน Node (เฉพาะ `vite.config.ts`) แยกจากโค้ดแอปที่รันในเบราว์เซอร์

- **ใครเรียกใช้**: `tsc -b` ผ่าน `tsconfig.json` ; editor
- **เรียกใช้**: ไม่มี ; `types: ["node"]` (ต้องมี `@types/node`)

## 2. อธิบายทีละบล็อก

| บรรทัด | option | ค่า | ความหมาย |
|---|---|---|---|
| 3 | `tsBuildInfoFile` | `./node_modules/.tmp/tsconfig.node.tsbuildinfo` | แคช build |
| 4–6 | `target`, `lib`, `types` | `es2023`, `["ES2023"]`, `["node"]` | ไม่มี DOM ; รู้จัก API ของ Node |
| 7 | `skipLibCheck` | `true` | |
| 10 | `module` | `nodenext` | ตามกติกา ESM ของ Node |
| 11–15 | `allowImportingTsExtensions`, `verbatimModuleSyntax`, `moduleDetection`, `noEmit` | | |
| 17–20 | ตรวจตัวแปรที่ไม่ใช้, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch` | `true` | |
| 22 | `include` | `["vite.config.ts"]` | ตรวจไฟล์เดียวนี้ |

## 3. การส่งข้อมูล

ไม่มี (config)

## 4. จุดที่ควรระวัง

- ครอบคลุมเฉพาะ `vite.config.ts` ; ไฟล์ `eslint.config.js`, `postcss.config.js`, `tailwind.config.js` (JavaScript) ไม่ถูกตรวจ type
- ไม่มี DOM type จึงใช้ `window`/`document` ใน `vite.config.ts` ไม่ได้ (ไม่จำเป็นอยู่แล้ว)

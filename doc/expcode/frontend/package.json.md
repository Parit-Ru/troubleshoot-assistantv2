# frontend/package.json

## 1. หน้าที่ของไฟล์

ประกาศแพ็กเกจ frontend (React + Vite + TypeScript + Tailwind): ชื่อ, สคริปต์ (dev/build/preview/test/deploy), dependencies

- **ใครเรียกใช้**: `npm` / Vite / Vitest / gh-pages
- **เรียกใช้**: สคริปต์ชี้ไป `vite`, `tsc -b`, `vitest`, `gh-pages` ; รากโปรเจกต์ `package.json` เรียก `npm run dev` ผ่านสคริปต์ `dev:frontend`

## 2. อธิบายทีละบล็อก

### บล็อก A — ข้อมูลแพ็กเกจ (บรรทัด 2–5)
`name: frontend`, `private: true`, `version: 0.0.0`, **`type: "module"`** (ไฟล์ `.js` ถือเป็น ES module — จึงเขียน `eslint.config.js`, `postcss.config.js`, `tailwind.config.js` ด้วย `export default`)

### บล็อก B — `scripts` (บรรทัด 6–13)
| สคริปต์ | คำสั่ง | ความหมาย |
|---|---|---|
| `dev` | `vite` | รัน dev server |
| `build` | `tsc -b && vite build` | ตรวจ type ก่อน แล้ว build เป็น `dist/` |
| `preview` | `vite preview` | พรีวิวผล build |
| `test` | `vitest run` | รันเทสครั้งเดียว |
| `test:watch` | `vitest` | รันเทสแบบเฝ้าดู |
| `deploy` | `npm run build && gh-pages -d dist` | build แล้วเผยแพร่โฟลเดอร์ `dist` ขึ้น GitHub Pages |

### บล็อก C — `dependencies` (บรรทัด 14–19)
`@tanstack/react-query` (^5.102.8, จัดการข้อมูลจาก API), `react` / `react-dom` (^19.2.8), `react-router-dom` (^7.18.3)

### บล็อก D — `devDependencies` (บรรทัด 20–38)
ESLint + ปลั๊กอิน (`@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `globals`), `typescript` (~6.0.2), `vite` (^8.2.2) + `@vitejs/plugin-react`, `vitest` (^4.1.11), `tailwindcss` (^3.4.19) + `postcss` + `autoprefixer`, `gh-pages`, ชนิดข้อมูล `@types/node`, `@types/react`, `@types/react-dom`

## 3. การส่งข้อมูล

ไม่มีการส่งข้อมูลระหว่างไฟล์ — ใช้ชี้คำสั่ง ; `npm run deploy` ส่งโฟลเดอร์ `dist/` ขึ้น branch `gh-pages` ของ repo ผ่าน `gh-pages`

## 4. จุดที่ควรระวัง

- **ไม่มี `@tanstack/react-query-devtools`, ไม่มีไลบรารี UI/HTTP อื่น** — ใช้ `fetch` ธรรมดา (ตามชั้น `http.ts`)
- **เทสไม่มี `jsdom`/Testing Library** : เทสในโปรเจกต์ (`*.test.ts`) เป็นเทสตรรกะล้วน ไม่เทส component (อนุมานจากรายการ dependencies และชื่อไฟล์เทส)
- Tailwind เป็น v3 (`^3.4.19`) แต่ใช้กับ Vite 8 ผ่านปลั๊กอิน PostCSS (`postcss.config.js`) ไม่ใช่ปลั๊กอิน Vite ของ Tailwind v4
- เวอร์ชันของเครื่องมือหลักค่อนข้างใหม่ (React 19, ESLint 10, TypeScript 6, Vite 8, Vitest 4) — ต้องตรวจความเข้ากันได้เมื่ออัปเกรด
- `deploy` ต้องมีสิทธิ์ push ไป repo (ผ่านการตั้งค่า git ของเครื่อง)

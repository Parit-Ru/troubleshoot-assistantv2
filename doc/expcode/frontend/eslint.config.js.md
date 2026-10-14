# frontend/eslint.config.js

## 1. หน้าที่ของไฟล์

ตั้งค่า ESLint (flat config) ของ frontend : ตรวจไฟล์ `.ts`/`.tsx` ด้วยกฎแนะนำของ JavaScript, TypeScript, React Hooks และ React Refresh (Vite)

- **ใครเรียกใช้**: ESLint (`npx eslint .`) และ editor
- **เรียกใช้**: `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `eslint/config`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 1–6)
นำเข้ากฎและตัวช่วย `defineConfig`, `globalIgnores`

### บล็อก B — `defineConfig([...])` (บรรทัด 8–22)
- `globalIgnores(['dist'])` (9): ไม่ตรวจโฟลเดอร์ผล build
- ชุดกฎสำหรับ `**/*.{ts,tsx}` (10–21): `extends` = `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite` ; `languageOptions.globals = globals.browser`

## 3. การส่งข้อมูล

ไม่มี : ESLint อ่านไฟล์ต้นทางใน `src/` แล้วรายงานปัญหาออก terminal

## 4. จุดที่ควรระวัง

- ไม่ได้ตรวจไฟล์ `.js` (เช่น `postcss.config.js`, `tailwind.config.js`) เพราะ `files` จำกัดเฉพาะ `.ts`/`.tsx`
- ใช้กฎ `recommended` ไม่ใช่ `strict`/type-aware จึงไม่ตรวจกฎที่ต้องอาศัย type เต็มรูปแบบ
- `reactHooks.configs.flat.recommended` ของปลั๊กอินเวอร์ชันใหม่มีกฎเข้มข้นเกี่ยวกับ React Compiler ; แพ็กเกจนี้ไม่ได้ใช้ React Compiler แต่กฎจะยังตรวจรูปแบบการเขียน hooks (อนุมานจากเวอร์ชันปลั๊กอินใน `package.json`)

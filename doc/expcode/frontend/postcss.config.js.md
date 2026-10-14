# frontend/postcss.config.js

## 1. หน้าที่ของไฟล์

บอก PostCSS (ที่ Vite เรียกใช้อัตโนมัติ) ให้รันปลั๊กอิน 2 ตัวกับ CSS: `tailwindcss` (แปลง directive เช่น `@tailwind` เป็น CSS จริง ตาม `tailwind.config.js`) และ `autoprefixer` (เติม vendor prefix)

- **ใครเรียกใช้**: Vite (ตอน dev/build ประมวลผล CSS เช่น `src/index.css`)
- **เรียกใช้**: `tailwindcss`, `autoprefixer`

## 2. อธิบายทีละบล็อก

`export default { plugins: { tailwindcss: {}, autoprefixer: {} } }` (บรรทัด 1–6) — ลำดับ Tailwind มาก่อน autoprefixer

## 3. การส่งข้อมูล

`src/index.css` → PostCSS (Tailwind สแกนคลาสในไฟล์ตาม `content` ของ `tailwind.config.js`) → CSS สุดท้าย → ฝังในหน้าเว็บ

## 4. จุดที่ควรระวัง

- ใช้รูปแบบ Tailwind v3 (ปลั๊กอินชื่อ `tailwindcss`) ; ถ้าอัปเกรดเป็น Tailwind v4 ต้องเปลี่ยนเป็น `@tailwindcss/postcss`
- ไฟล์เป็น ES module (`export default`) เพราะ `package.json` ตั้ง `"type": "module"`

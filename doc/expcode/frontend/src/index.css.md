# frontend/src/index.css

## 1. หน้าที่ของไฟล์

ไฟล์ CSS รากของแอป : เปิดใช้ชั้นสไตล์ของ Tailwind ทั้ง 3 ชั้น และตั้งสีพื้นหลัง/สีตัวอักษรเริ่มต้นที่ `body`

- **ใครเรียกใช้**: `frontend/src/main.tsx` (`import './index.css'`)
- **เรียกใช้**: Tailwind (ผ่าน PostCSS) ; ค่าสี `canvas`, `ink` มาจาก `tailwind.config.js`

## 2. อธิบายทีละบล็อก

| บรรทัด | โค้ด | ความหมาย |
|---|---|---|
| 1–3 | `@tailwind base; @tailwind components; @tailwind utilities;` | แทรกสไตล์พื้นฐาน, คอมโพเนนต์ และ utility ของ Tailwind |
| 5–10 | `@layer base { body { @apply bg-canvas text-ink; } }` | ตั้งพื้นหลัง `canvas` (`#0B0F1A`) และสีตัวอักษร `ink` ที่ `body` |

คอมเมนต์บรรทัด 6: ตั้งที่ `body` ไม่ใช่ `#root` เพื่อให้สีพื้นเต็มจอแม้เนื้อหาสั้น

## 3. การส่งข้อมูล

`index.css` → PostCSS/Tailwind → CSS สุดท้ายที่ Vite ฝังในหน้าเว็บ

## 4. จุดที่ควรระวัง

- คำสั่ง `@tailwind`/`@apply` ใช้ได้เฉพาะผ่าน PostCSS ของ Tailwind v3 (ถ้าเปิดไฟล์ด้วยตัวตรวจ CSS ทั่วไป editor อาจเตือนว่าไม่รู้จัก at-rule)
- ไม่มีการตั้ง `font-family` ที่นี่ — ฟอนต์มาจาก `fontFamily.sans` ใน `tailwind.config.js` ซึ่ง Tailwind ใช้เป็น `font-sans` ค่าเริ่มต้นใน base layer

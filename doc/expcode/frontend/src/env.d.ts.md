# frontend/src/env.d.ts

## 1. หน้าที่ของไฟล์

ไฟล์ประกาศชนิด (type declaration) ล้วน ไม่มีโค้ดทำงาน : บอก TypeScript ว่า `import.meta.env` มีตัวแปร `VITE_API_URL` และ `VITE_USE_MOCK` ชนิด `string` เพื่อดักการพิมพ์ชื่อผิดและใช้ผิดประเภท

- **ใครเรียกใช้**: TypeScript (รวมเข้าโปรเจกต์ผ่าน `include: ["src"]`) — ไม่มีไฟล์ import ตรง
- **เรียกใช้**: `vite/client` (ผ่าน `/// <reference types="vite/client" />`)

## 2. อธิบายทีละบล็อก

| บรรทัด | สิ่งที่ประกาศ | ความหมาย |
|---|---|---|
| 1 | `/// <reference types="vite/client" />` | ดึง type ของ Vite (`import.meta.env` ฯลฯ) |
| 11–21 | `interface ImportMetaEnv { VITE_API_URL: string; VITE_USE_MOCK: string }` | ตัวแปรจากไฟล์ `.env` : `VITE_API_URL` = ที่อยู่ backend ไม่มี `/` ท้าย ; `VITE_USE_MOCK` เป็น `string` ไม่ใช่ boolean เพราะค่าจาก `.env` เป็นข้อความเสมอ ต้องเทียบ `=== 'true'` (ข้อความ `'false'` ถือเป็นจริงใน JavaScript) |
| 23–25 | `interface ImportMeta { readonly env: ImportMetaEnv }` | ผูก `env` เข้ากับ `import.meta` |

## 3. การส่งข้อมูล

ไม่มี (compile-time เท่านั้น) : ช่วยให้ `import.meta.env.VITE_API_URL` ใน `http.ts` มีชนิด `string`

## 4. จุดที่ควรระวัง

- **ต้องเพิ่มชื่อตัวแปรใหม่ที่นี่ทุกครั้ง** ที่เพิ่มใน `.env` (คอมเมนต์ 9)
- ชนิดบอกว่า `string` เสมอ แต่ค่าจริงอาจเป็น `undefined` ถ้าไม่ได้ตั้ง : `http.ts` จึงตรวจ `if (!baseUrl)` ด้วยตัวเอง

# frontend/index.html

## 1. หน้าที่ของไฟล์

หน้า HTML เดียว (single-page app) ที่ Vite ใช้เป็นจุดเข้า : กำหนดภาษา ธีมสี คำอธิบายเว็บ และจุดเมาท์ `<div id="root">` ที่ React จะวาดแอปลงไป แล้วโหลดสคริปต์ `/src/main.tsx`

- **ใครเรียกใช้**: Vite (dev server/ตอน build) และเบราว์เซอร์ผู้ใช้
- **เรียกใช้**: `/src/main.tsx` (บรรทัด 18), `/favicon.svg` (ไฟล์ใน `public/` ซึ่งไม่ได้สรุปเพราะเป็นรูปภาพ)

## 2. อธิบายทีละบล็อก

| บรรทัด | องค์ประกอบ | ความหมาย |
|---|---|---|
| 2 | `<html lang="th">` | ภาษาไทย (ช่วย screen reader/ฟอนต์) |
| 4–8 | `meta charset`, `link icon`, `viewport`, `theme-color #0B0F1A`, `color-scheme dark` | ตั้งค่าพื้นฐาน; สีธีมตรงกับ `canvas` ใน `tailwind.config.js` ; ประกาศว่าเป็นเว็บธีมมืด |
| 9–12 | `meta description` | "ผู้ช่วยตรวจอาการเครื่องใช้ไฟฟ้าทีละขั้น ตามลำดับขั้นตอนในคู่มือของผู้ผลิต พร้อมด่านยืนยันคำเตือนก่อนขั้นตอนที่เกี่ยวกับไฟฟ้า" |
| 14 | `<title>` | "FixStep ผู้ช่วยตรวจอาการเครื่องใช้ไฟฟ้า" |
| 17 | `<div id="root">` | จุดที่ React เมาท์ |
| 18 | `<script type="module" src="/src/main.tsx">` | จุดเริ่มโค้ด frontend |

## 3. การส่งข้อมูล

`เบราว์เซอร์ ► index.html ► โหลด main.tsx (JS ที่ build แล้ว) ► React วาด UI ลงใน #root` — Vite ปรับ URL ของ asset ให้ขึ้นต้นด้วย `base` (`/troubleshoot-assistantv2/`) ตอน build

## 4. จุดที่ควรระวัง

- ชื่อเว็บในที่นี้คือ "FixStep" ขณะที่ backend ใช้ "FixBot", `package.json` ราก ใช้ "fixgraph" — ชื่อผลิตภัณฑ์ไม่สอดคล้องกันทั้งโปรเจกต์
- `color-scheme: dark` และ `theme-color` ผูกกับธีมมืดเท่านั้น
- ลิงก์ `/favicon.svg` ชี้ไปที่ไฟล์ใน `public/` : Vite จะใส่ `base` ให้เองตอน build

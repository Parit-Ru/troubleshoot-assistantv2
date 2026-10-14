# frontend/vite.config.ts

## 1. หน้าที่ของไฟล์

ไฟล์ตั้งค่า Vite: เปิดปลั๊กอิน React และกำหนด `base` (พาธรากของเว็บ) เป็น `/troubleshoot-assistantv2/` เพื่อให้ไฟล์ที่ build วางบน GitHub Pages ใต้พาธชื่อ repo ได้ถูกต้อง

- **ใครเรียกใช้**: Vite ทุกคำสั่ง (`dev`, `build`, `preview`) และ Vitest (อ่าน config เดียวกัน)
- **เรียกใช้**: `@vitejs/plugin-react`, `vite` ; ถูกตรวจชนิดด้วย `tsconfig.node.json` (ระบุ `include: ["vite.config.ts"]`)

## 2. อธิบายทีละบล็อก

| บรรทัด | โค้ด | ความหมาย |
|---|---|---|
| 1–2 | `import react …`, `import { defineConfig } …` | นำเข้าปลั๊กอินและตัวช่วย config |
| 5–8 | `export default defineConfig({ plugins: [react()], base: '/troubleshoot-assistantv2/' })` | เปิดการรองรับ JSX/React Fast Refresh และตั้งฐาน URL ของเว็บ |

- **รับ/คืน**: ไม่มี ส่งออกอ็อบเจ็กต์ config ให้ Vite

## 3. การส่งข้อมูล

ไม่มีข้อมูลธุรกิจ : Vite อ่านไฟล์นี้ → URL ของ asset ในผล build ขึ้นต้นด้วย `/troubleshoot-assistantv2/` (เช่น `/troubleshoot-assistantv2/assets/…`) ซึ่งตรงกับที่ GitHub Pages เสิร์ฟ repo นี้

## 4. จุดที่ควรระวัง

- **`base` ตายตัว**: ผูกกับชื่อ repo ถ้าเปลี่ยนชื่อ repo หรือย้ายไปโดเมนอื่นต้องแก้ ; บนเครื่อง `npm run dev` ก็เสิร์ฟใต้พาธนี้ด้วย (เปิด `http://localhost:5173/troubleshoot-assistantv2/`) (อนุมานจากพฤติกรรมมาตรฐานของ Vite)
- `App.tsx` ใช้ HashRouter ตามที่ import graph/ไฟล์ดังกล่าวสื่อ (ดูสรุปของ `App.tsx`) เพื่อไม่ต้องตั้งค่า server-side fallback บน GitHub Pages
- ไม่มีการตั้งค่า proxy สำหรับ API ในโหมด dev — การเรียก backend ใช้ `VITE_API_URL` และต้องพึ่ง CORS ของ backend
- ไม่มี `test` config ใน vite.config.ts : Vitest จึงใช้ค่าเริ่มต้น

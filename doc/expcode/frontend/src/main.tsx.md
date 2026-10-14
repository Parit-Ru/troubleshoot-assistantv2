# frontend/src/main.tsx

## 1. หน้าที่ของไฟล์

จุดเริ่มต้นของโค้ด frontend: หาองค์ประกอบ `#root` ใน `index.html` แล้วให้ React วาดคอมโพเนนต์ `App` ลงไป ห่อด้วย `StrictMode` พร้อมโหลดสไตล์ `index.css`

- **ใครเรียกใช้**: `frontend/index.html` (`<script type="module" src="/src/main.tsx">`)
- **เรียกใช้**: `react` (`StrictMode`), `react-dom/client` (`createRoot`), `./index.css`, `./App.tsx`

## 2. อธิบายทีละบล็อก

| บรรทัด | โค้ด | ความหมาย |
|---|---|---|
| 1–4 | import | นำเข้า React, ReactDOM, CSS (Tailwind) และ `App` |
| 6 | `createRoot(document.getElementById('root')!)` | สร้างรากของ React ที่ `#root` (`!` บอก TypeScript ว่าไม่เป็น null) |
| 7–9 | `.render(<StrictMode><App /></StrictMode>)` | วาดแอปในโหมด StrictMode |

- **รับ/คืน**: ไม่มี (รันทันทีเมื่อโมดูลถูกโหลด)

## 3. การส่งข้อมูล

`index.html` → โหลด `main.tsx` → `createRoot().render(<App/>)` → React สร้าง DOM ใน `#root`

## 4. จุดที่ควรระวัง

- `StrictMode` ในโหมด dev ทำให้ effect/ฟังก์ชัน render ถูกเรียกซ้ำเพื่อตรวจปัญหา — โค้ดที่มีผลข้างเคียงใน `useEffect` (เช่นตัวจับเวลา) ต้องล้างให้ถูกต้อง ; ไม่มีผลต่อ production build
- ถ้าไม่พบ `#root` (เช่น แก้ `index.html` ผิด) จะเกิด error ตอนรัน เพราะใช้ `!` แทนการตรวจ

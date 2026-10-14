# frontend/tailwind.config.js

## 1. หน้าที่ของไฟล์

ตั้งค่า Tailwind CSS v3 : ระบุไฟล์ที่ต้องสแกนหาชื่อคลาส (`content`) และขยาย theme ด้วยสีและฟอนต์ของแอป (ธีมมืด)

- **ใครเรียกใช้**: Tailwind (ผ่าน PostCSS ตาม `postcss.config.js`)
- **เรียกใช้**: ไม่มี ; คลาสที่นิยามที่นี่ (เช่น `bg-canvas`, `text-ink-soft`, `border-line`, `text-accent`) ถูกใช้ในคอมโพเนนต์ `.tsx` ทั้งหมด

## 2. อธิบายทีละบล็อก

### บล็อก A — `content` (บรรทัด 3–6)
สแกน `./index.html` และ `./src/**/*.{js,ts,jsx,tsx}` : Tailwind สร้าง CSS เฉพาะคลาสที่พบเขียนเป็นข้อความเต็มในไฟล์เหล่านี้

### บล็อก B — `theme.extend.colors` (บรรทัด 9–24)
| ชื่อ | ค่า | ใช้เป็น |
|---|---|---|
| `canvas` | `#0B0F1A` | พื้นหลังหน้า (ตรงกับ `theme-color` ใน `index.html`) |
| `panel` | `#0E1422` | พื้นการ์ด/แผง |
| `line` | `#1E293B` | เส้นขอบ |
| `accent` | `#F59E0B` | สีเน้น (เหลืองอำพัน) |
| `ink` | DEFAULT `#F1F5F9`, `soft` `#94A3B8`, `faint` `#78879D` | สีตัวอักษร 3 ระดับ |
| `success` | `#4ADE80` | สถานะสำเร็จ |
| `info` | `#60A5FA` | ข้อมูล |
| `danger` | `#F87171` | อันตราย/คำเตือน |

### บล็อก C — `fontFamily` (บรรทัด 26–29)
- `sans`: "Leelawadee UI", "Noto Sans Thai", Thonburi, Tahoma, sans-serif (ฟอนต์ไทยที่มากับระบบ ไม่โหลดจากเน็ต)
- `mono`: Consolas, "Courier New", monospace

## 3. การส่งข้อมูล

คลาสในไฟล์ `.tsx` (เช่น `className="bg-panel text-ink"`) → Tailwind สแกนตาม `content` → สร้าง CSS ตาม theme นี้ → แสดงผลบนหน้าเว็บ

## 4. จุดที่ควรระวัง

- **Tailwind ต้องเห็นชื่อคลาสเต็ม** ในซอร์ส การประกอบคลาสด้วยสตริงต่อกัน (เช่น `` `text-${tone}` ``) จะไม่ถูกสร้างเป็น CSS
- มีเฉพาะธีมมืด (ไม่มี dark/light toggle) สอดคล้องกับ `<meta name="color-scheme" content="dark">`
- ค่า `ink.faint` ถูกตั้งเป็น `#78879D` (ต่างจากค่า Tailwind slate ทั่วไป) — น่าจะปรับเพื่อคอนทราสต์บนพื้นมืด (อนุมานจากค่า)
- ไฟล์ไม่ได้ตั้ง `darkMode` และไม่มีปลั๊กอิน

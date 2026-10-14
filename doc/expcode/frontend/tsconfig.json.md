# frontend/tsconfig.json

## 1. หน้าที่ของไฟล์

ไฟล์ tsconfig ราก (แบบ "solution") ของ frontend ไม่คอมไพล์ไฟล์เอง (`files: []`) แต่ชี้ไปยัง 2 โปรเจกต์ย่อย: `tsconfig.app.json` (โค้ดในแอป) และ `tsconfig.node.json` (ไฟล์ config ฝั่ง Node)

- **ใครเรียกใช้**: `tsc -b` ในสคริปต์ `build` ของ `package.json`, editor
- **เรียกใช้**: `./tsconfig.app.json`, `./tsconfig.node.json`

## 2. อธิบายทีละบล็อก

`{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }` (บรรทัด 1–7)

## 3. การส่งข้อมูล

`tsc -b` → build โปรเจกต์ย่อยตามลำดับอ้างอิง → ตรวจ type (ไม่ปล่อยไฟล์ เพราะ `noEmit: true` ในโปรเจกต์ย่อย)

## 4. จุดที่ควรระวัง

ไม่พบจุดน่าสงสัย เป็นรูปแบบมาตรฐานของแม่แบบ Vite + React + TypeScript

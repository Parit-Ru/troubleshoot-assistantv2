# package.json (รากโปรเจกต์)

## 1. หน้าที่ของไฟล์

ไฟล์ npm ระดับรากของ repo ไม่มี dependency มีเพียงชื่อโปรเจกต์ `fixgraph` และ "ทางลัดคำสั่ง" 4 อัน สำหรับเรียกสคริปต์ Python ตรวจกราฟ และเปิดเซิร์ฟเวอร์พัฒนาของ backend / frontend จากรากโฟลเดอร์

- **ใครเรียกใช้**: คนพิมพ์ `npm run <ชื่อ>` ที่รากของ repo
- **เรียกใช้**: `scripts/validate_graph.py`, `scripts/simulate_paths.py`, และสคริปต์ `start:dev` ของ `backend/package.json` กับ `dev` ของ `frontend/package.json`

## 2. อธิบายทีละบล็อก

| บรรทัด | key | ค่า | ความหมาย |
|---|---|---|---|
| 2 | `name` | `fixgraph` | ชื่อแพ็กเกจ |
| 3 | `private` | `true` | ห้ามเผยแพร่ขึ้น npm |
| 5 | `scripts.validate` | `python scripts/validate_graph.py --all` | ตรวจกราฟทุกคู่มือ |
| 6 | `scripts.simulate` | `python scripts/simulate_paths.py --all` | จำลองเดินทุกเส้นทาง |
| 7 | `scripts.dev:backend` | `cd backend && npm run start:dev` | รัน Nest แบบ watch |
| 8 | `scripts.dev:frontend` | `cd frontend && npm run dev` | รัน Vite dev server |

## 3. การส่งข้อมูล

ไม่มี: เป็นเพียงตัวเรียกคำสั่ง (`npm run validate` → `python …`)

## 4. จุดที่ควรระวัง

- **ผลที่ยืนยันแล้ว**: `npm run validate` (= `validate_graph.py --all`) ปัจจุบันจบด้วย exit 1 เพราะกราฟเครื่องซักผ้า 29 กราฟไม่ผ่าน schema (13/42 ผ่าน) — ดูสรุปของ `scripts/validate_graph.py`
- ต้องมี `python` ใน PATH (และ `jsonschema` ถ้าต้องการตรวจ schema)
- `cd backend && …` ต้องการ shell ที่รองรับ `&&` (cmd และ bash ใช้ได้ ส่วน Windows PowerShell 5.1 ใช้ `&&` ไม่ได้ตรงๆ แต่ npm เรียกผ่าน cmd จึงใช้ได้) (อนุมานจากพฤติกรรมของ npm)
- ชื่อ `fixgraph` ต่างจากชื่อโฟลเดอร์ (`troubleshoot-assistantv2`) และจากชื่อในข้อความ (FixBot, FixStep)
- ไม่มีสคริปต์ติดตั้ง dependency ทั้ง backend และ frontend ในคำสั่งเดียว

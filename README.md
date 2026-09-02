# FixGraph

ระบบผู้ช่วยแก้ปัญหาเครื่องใช้ไฟฟ้า ด้วยการเดิน troubleshooting graph
ที่ควบคุมด้วยอัลกอริทึม ไม่ใช่ให้ LLM ตัดสินใจขั้นตอนเอง

## โครงสร้าง

- `backend/` — NestJS + PostgreSQL
- `frontend/` — React + Vite + TypeScript + Tailwind
- `data/` — troubleshooting graph และ schema
- `scripts/` — เครื่องมือ Python สำหรับตรวจสอบ graph

## เริ่มใช้งาน

Backend:

    cd backend
    npm install
    npm run start:dev

Frontend:

    cd frontend
    npm install
    npm run dev

## ตรวจสอบ graph

    python scripts/validate_graph.py --all data/graphs/
    python scripts/simulate_paths.py --all data/graphs/
# backend/package.json

## 1. หน้าที่ของไฟล์

ไฟล์ประกาศแพ็กเกจของ backend: ชื่อ, สคริปต์ที่สั่งงานได้ (build/start/test/migrate/seed), รายการ dependencies และเวอร์ชัน Node ขั้นต่ำ

- **ใครเรียกใช้**: `npm` / Nest CLI / Jest (และขั้นติดตั้งตอน deploy)
- **เรียกใช้ไฟล์ในโปรเจกต์**: สคริปต์ชี้ไป `scripts/run-migrations.js`, `scripts/seed-graphs.js`, `scripts/seed-equipment.js` และ `dist/main.js`

## 2. อธิบายทีละบล็อก

### บล็อก A — ข้อมูลแพ็กเกจ (บรรทัด 2–5)
`name: "fixgraph-backend"`, `version: "0.1.0"`, `private: true`, `description: "FixBot backend — NestJS + raw MySQL, traversal engine controls diagnostic flow"` — ชื่อแพ็กเกจ (fixgraph) กับ description (FixBot) ใช้ชื่อโปรเจกต์ต่างกัน

### บล็อก B — `scripts` (บรรทัด 6–15)
| สคริปต์ | คำสั่ง | ความหมาย |
|---|---|---|
| `build` | `nest build` | คอมไพล์ `src/` → `dist/` |
| `start` | `nest start` | รันครั้งเดียว |
| `start:dev` | `nest start --watch` | รันพร้อมรีสตาร์ตเมื่อไฟล์เปลี่ยน |
| `start:prod` | `node dist/main.js` | รันตัวที่ build แล้ว (ใช้ตอน deploy) |
| `test` | `jest` | รันเทส (ตั้งค่าใน `jest.config.js`) |
| `migrate` | `node scripts/run-migrations.js` | รันไฟล์ SQL ใน `migrations/` |
| `seed` | `node scripts/seed-graphs.js` | โหลดกราฟจาก `data/manuals/*.json` ลง MySQL |
| `seed:equipment` | `node scripts/seed-equipment.js` | โหลดอุปกรณ์จาก `data/equipment/equipment.json` ลง MySQL |

### บล็อก C — `dependencies` (บรรทัด 16–28)
- `@huggingface/transformers` `4.3.0` (ตรึงเวอร์ชันตรงตัว) — รันโมเดล embedding
- `@nestjs/cli`, `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/schematics` (`^10.x`) — เฟรมเวิร์ก (`platform-express` = ใช้ Express เป็น HTTP layer)
- `dotenv` `^16.4.5` — โหลด `.env`
- `mysql2` `^3.24.3` — ไดรเวอร์ MySQL
- `reflect-metadata`, `rxjs` — ที่ Nest ต้องใช้
- `ts-node` — อยู่ใน dependencies (ไม่ใช่ dev)

### บล็อก D — `devDependencies` (บรรทัด 29–36)
`@types/express`, `@types/jest`, `@types/node`, `jest`, `ts-jest`, `typescript` (`^5.6.0`)

### บล็อก E — `engines` (บรรทัด 37–39)
`node >= 20.0.0` (สอดคล้องกับ `traversal-engine.ts` ที่ใช้ `globalThis.crypto` ซึ่งต้องการ Node 20+)

## 3. การส่งข้อมูล

ไม่มีการส่งข้อมูลระหว่างไฟล์ ใช้เป็นตัวชี้คำสั่ง: `npm run <script>` → รันคำสั่งตามตาราง; ตอนติดตั้ง `npm install` อ่าน dependencies แล้วโหลดจาก registry (อ่านร่วมกับ `package-lock.json` ซึ่งไม่ถูกสรุปตามกติกา)

## 4. จุดที่ควรระวัง

- **ไม่มีสคริปต์ lint/format** และไม่มี eslint ใน devDependencies ของ backend
- **`@nestjs/cli` และ `ts-node` อยู่ใน `dependencies`** ซึ่งทำให้ขั้นติดตั้งแบบ production มีเครื่องมือ build ด้วย (อนุมานจากโค้ด — เหมาะกับการ build บนเซิร์ฟเวอร์ deploy)
- **เวอร์ชัน `@huggingface/transformers` ตรึงตรงตัว** (`4.3.0`) ขณะที่แพ็กเกจอื่นใช้ `^` — ควรอัปเดตอย่างระวัง เพราะโมเดล/ไฟล์ใน `backend/model-slim` ต้องสอดคล้อง
- `description` ระบุ "raw MySQL" ตรงกับโค้ดที่ไม่ใช้ ORM (`session.store.ts`)

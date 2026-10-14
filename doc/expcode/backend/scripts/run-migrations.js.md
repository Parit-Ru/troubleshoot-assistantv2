# backend/scripts/run-migrations.js

## 1. หน้าที่ของไฟล์

สคริปต์ Node (JavaScript ธรรมดา ไม่ผ่านการ compile) สำหรับนักพัฒนา ใช้รันไฟล์ `.sql` ในโฟลเดอร์ `backend/migrations/` ตามลำดับชื่อไฟล์ และ "จำ" ว่าไฟล์ไหนรันไปแล้วด้วยตาราง `schema_migrations` เพื่อไม่ให้รันซ้ำ

- **ใครเรียกใช้**: คนรันผ่าน `npm run migrate` (สคริปต์ `migrate` ใน `backend/package.json`) หรือ `node scripts/run-migrations.js --status`
- **เรียกใช้**: `dotenv/config`, `node:fs`, `node:path`, `mysql2/promise`, ไฟล์ `.sql` ใน `../migrations` และตัวแปร `DB_*` จาก `.env`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์วิธีใช้ (บรรทัด 1–12)
- `npm run migrate` รัน migration ที่ยังไม่เคยรัน; `node scripts/run-migrations.js --status` ดูสถานะอย่างเดียว
- ⚠️ ห้ามใช้ `npm run migrate -- --status` บน PowerShell 5.1 เพราะมันตัด `--` ทิ้ง แล้วรัน migration จริงโดยไม่ตั้งใจ (เคยเกิดกับ migration 005)
- เขียนเป็น JS ธรรมดาเพราะเป็นเครื่องมือนักพัฒนา ไม่ใช่ส่วนของแอป

### บล็อก B — `connectionConfig()` (บรรทัด 26–54)
ตรวจ env บังคับ `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` ถ้าขาดโยน `Error` พร้อมวิธีแก้ ; คืน config: `charset: 'utf8mb4'` (ไม่งั้นภาษาไทยกลายเป็น `????`), **`multipleStatements: true`** (จำเป็นเพราะ 1 ไฟล์มีหลายคำสั่ง ตัวแอปจริงไม่เปิดเพราะเพิ่มความเสี่ยง SQL injection), `ssl` จาก `DB_SSL_CA` (Aiven และ cloud ส่วนใหญ่บังคับ TLS)

### บล็อก C — ตารางจำสถานะ (บรรทัด 56–85)
- `ensureMigrationsTable` สร้าง `schema_migrations(filename PK, applied_at)` ถ้ายังไม่มี
- `appliedFilenames` คืน `Set` ของชื่อไฟล์ที่รันแล้ว
- `migrationFiles` อ่านชื่อไฟล์ `.sql` และ `sort()` — จึงต้องตั้งชื่อขึ้นต้นด้วยเลข `001_`, `002_`, …

### บล็อก D — `main()` (บรรทัด 91–135)
1. เชื่อมต่อ (93) ; `--status` ตั้งโหมดอ่านอย่างเดียว (92)
2. คำนวณ `pending` = ไฟล์ที่ยังไม่อยู่ใน `schema_migrations` (98–100) แล้วพิมพ์สรุป
3. โหมด `--status`: พิมพ์ ✅/⬜ ต่อไฟล์แล้วออก (105–110) ; ไม่มีค้าง: พิมพ์ "ไม่มี migration ที่ต้องรัน" (112–115)
4. วนรันทีละไฟล์ที่ค้าง: อ่านไฟล์, `conn.query(sql)`, แล้ว `INSERT INTO schema_migrations` (117–129) — **ไม่ครอบ transaction** เพราะ MySQL ทำ DDL แบบ implicit commit อยู่แล้ว rollback ไม่ได้จริง ถ้าไฟล์พังกลางคันต้องแก้ด้วยมือ จึงควรเขียน migration ให้เล็ก
5. `finally` ปิด connection (132–134)

### บล็อก E — จัดการ error (บรรทัด 137–140)
`main().catch(...)` พิมพ์ข้อความแล้ว `process.exit(1)`

## 3. การส่งข้อมูล

```
.env ─dotenv─► process.env ─► mysql2.createConnection ─► MySQL
migrations/*.sql ─fs.readFileSync─► conn.query(sql) ─► (หลังสำเร็จ) INSERT schema_migrations(filename)
```
รับ argument: `--status` ; ผลลัพธ์ออก stdout (ข้อความ) และ exit code 0/1

## 4. จุดที่ควรระวัง

- **ไม่ atomic ต่อไฟล์**: ถ้าไฟล์ที่มีหลายคำสั่งล้มกลางคัน คำสั่งก่อนหน้า commit แล้ว แต่ไม่ได้บันทึกใน `schema_migrations` — รันซ้ำจะรันไฟล์เดิมทั้งไฟล์อีกครั้ง (เช่น `ALTER TABLE … ADD COLUMN` ซ้ำจะ error) (อนุมานจากโค้ด)
- **ssl ส่ง `DB_SSL_CA` ตรงๆ ไม่ผ่าน `normalizePem`** ต่างจาก `database.module.ts` ของแอป — ถ้าค่า CA ถูกเก็บเป็นบรรทัดเดียวที่มี `\n` เป็นอักขระ อาจต่อ TLS ไม่ติดเฉพาะสคริปต์นี้ (อนุมานจากโค้ด)
- คำเตือนเรื่อง PowerShell 5.1 ตัด `--` ในคอมเมนต์ยังเป็นกับดักจริง ควรเรียก `node scripts/run-migrations.js --status` ตรงๆ
- `multipleStatements: true` เปิดเฉพาะสคริปต์นี้

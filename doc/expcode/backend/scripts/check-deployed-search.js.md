# backend/scripts/check-deployed-search.js

## 1. หน้าที่ของไฟล์

สคริปต์ตรวจระบบค้นหาอาการบนเซิร์ฟเวอร์ที่ deploy แล้ว (หรือรันในเครื่อง) ขั้น 1.11: เรียก API จริงผ่าน HTTP เพื่อตรวจสุขภาพ (`/health`), การตั้งค่า CORS, สถานะการโหลดโมเดล, เวลาตอบของคำค้น และวัดหน่วยความจำ ใช้เฉพาะ `GET /health`, `OPTIONS /symptom-search`, `GET /symptom-search/status`, `POST /symptom-search` — **ไม่สร้าง session และไม่เขียน DB** (คอมเมนต์ 21)

- **ใครเรียกใช้**: คนรัน เช่น `node scripts/check-deployed-search.js https://troubleshoot-assistantv2.onrender.com` ; ตัวเลือก `--queries N` (ค่าเริ่มต้น 10), `--wait วินาที` (240), `--origin <url>`
- **เรียกใช้**: `fetch` / `AbortSignal` ที่มากับ Node (ไม่ import แพ็กเกจใด) ; API ของ backend ตามไฟล์ controller ที่เกี่ยวข้อง

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ (บรรทัด 1–25)
อธิบายวิธีรันและ 4 ขั้นของการตรวจ ; ⚠️ เกณฑ์เตือนหน่วยความจำ `WARN_RSS_MB` เป็นข้อเสนอของผู้พัฒนา ไม่ใช่ค่าที่วัดจาก Render (เพดานจริง 512 MB) ; รหัสออก 0 = ปกติ (รวมกรณีปิดสวิตช์) · 1 = พบปัญหา

### บล็อก B — อ่านพารามิเตอร์ (บรรทัด 27–52)
- `optStr`, `opt` อ่านค่าหลัง `--ชื่อ`
- `WEB_ORIGIN` ค่าเริ่มต้น `https://parit-ru.github.io` (origin ของหน้าเว็บที่ใช้ตรวจ CORS ; ค่า `CORS_ORIGIN` บน Render ต้องเท่ากันเป๊ะๆ) ; ตัด `/` ท้าย
- `BASE` = อาร์กิวเมนต์ `http(s)://` ตัวแรกที่ไม่ใช่ค่าของ `--origin` ; ไม่มีให้พิมพ์วิธีใช้แล้ว `exit(1)`
- `N_QUERIES`, `WAIT_S`, `WARN_RSS_MB = 450`, `HEALTH_TIMEOUT_MS = 120_000`

### บล็อก C — ข้อมูลและตัวช่วย (บรรทัด 54–78)
`QUERIES` 10 ข้อ (เช่น 'แอร์ไม่เย็น', 'วันนี้ฝนจะตกไหม', 'error code on display') ; `sleep`, `fmtS`, ตัวนับ `problems` + `fail()` ; `getJson(path, timeoutMs)` ใช้ `fetch` + `AbortSignal.timeout`

### บล็อก D — `main()` ขั้น 1) `/health` (บรรทัด 83–110)
วนลองซ้ำทุก 3 วินาทีจนครบ 120 วินาที (เซิร์ฟเวอร์ Render ฟรีหลับ/เพิ่ง deploy อาจตอบ 502/503 หรือต่อไม่ติด จึงไม่ถือเป็นล้มเหลวจริงจนกว่าจะหมดเวลา) ; พิมพ์เวลาที่ใช้ (เกิน 8 วินาทีแจ้งว่า "ช้า") และ body ; ถ้า `status !== 'ok'` ถือว่าพบปัญหา (ฐานข้อมูลอาจต่อไม่ได้)

### บล็อก E — ขั้น 1b) CORS (บรรทัด 112–136)
ส่ง preflight `OPTIONS /symptom-search` พร้อม `Origin`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: content-type` แล้วเทียบ `access-control-allow-origin` กับ `WEB_ORIGIN` — ไม่ตรงถือว่าพบปัญหา (เหตุการณ์จริงที่เคยเกิด: `CORS_ORIGIN` บน Render ถูกตั้งเป็น URL ของ repo แทน origin ของ GitHub Pages)

### บล็อก F — ขั้น 2) `/symptom-search/status` (บรรทัด 138–182)
404 → เซิร์ฟเวอร์ยังเป็นโค้ดเก่า ; `disabled` → จด `memoryRssMb` แล้วจบ (ถือว่าปกติ) ; `loading` → รอทุก 3 วินาทีไม่เกิน `WAIT_S` ; `failed` → แสดง `error` ; ไม่ใช่ `ready` หลังรอ → พบปัญหา ; `ready` → ตรวจ `modelFilesFoundLocally` และจด RSS ก่อนยิง

### บล็อก G — ขั้น 3) ยิงคำค้น (บรรทัด 184–216)
`POST /symptom-search` จำนวน `N_QUERIES` ครั้ง วนใช้ `QUERIES` ; พิมพ์อันดับ 1 (ตัดคำนำหน้า `samsung_ac_ar70h_`) เฉพาะ 10 ครั้งแรก ; นับครั้งที่ไม่ใช่ 200 ; คำนวณ median/max ของเวลาตอบ (รวมเครือข่าย)

### บล็อก H — ขั้น 4) หน่วยความจำและการจบ (บรรทัด 218–232)
อ่าน `memoryRssMb` หลังยิง เทียบกับก่อนยิง ; ถ้า ≥ 450 MB ถือว่าพบปัญหา (แนะนำปิด `SYMPTOM_SEARCH_ENABLED`) ; ท้ายไฟล์ `main().catch(fail).finally(...)` พิมพ์ "ไม่พบปัญหา"/"พบปัญหา N รายการ" แล้ว `process.exit(0|1)`

## 3. การส่งข้อมูล

```
สคริปต์ ──HTTP GET /health──────────────► backend (Render/localhost)
        ──HTTP OPTIONS /symptom-search───► (ตรวจ header CORS)
        ──HTTP GET /symptom-search/status► SearchStatusDto (JSON: state, memoryRssMb, loadMs, …)
        ──HTTP POST /symptom-search ×N───► {query} → {matches:[…]} (JSON)
```
ผลเป็นข้อความที่ stdout และ exit code

## 4. จุดที่ควรระวัง

- **ค่าเริ่มต้นของ `--origin`** ฝังโดเมน GitHub Pages ของผู้พัฒนาไว้ในโค้ด ถ้านำไป deploy ที่อื่นต้องส่ง `--origin` เอง
- `/health` ตอบ 200 แม้ฐานข้อมูลล้ม (`status: "degraded"`) สคริปต์จึงต้องอ่าน field `status` เอง (ทำแล้วที่บรรทัด 110)
- เวลาตอบที่วัดรวมเครือข่ายและไม่รวมกรณีเซิร์ฟเวอร์หลับ (ขั้น 1 ปลุกเซิร์ฟเวอร์ไปแล้ว)
- หมายเหตุหน่วยความจำ (บรรทัด 221) บอกว่าในเครื่องผู้พัฒนา RSS ขึ้นช่วงแรกราว 750 ข้อความแล้วนิ่ง ~290–320 MB ส่วนบน Render "ยังไม่เคยวัด" ณ ตอนเขียนสคริปต์
- การยิงคำค้นจริงทำให้เซิร์ฟเวอร์ที่ deploy ใช้ CPU (0.1 CPU บน Render free) ควรใช้ `--queries` ค่าน้อย

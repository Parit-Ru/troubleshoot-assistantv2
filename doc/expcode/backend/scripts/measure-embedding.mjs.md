# backend/scripts/measure-embedding.mjs

## 1. หน้าที่ของไฟล์

สคริปต์วัดครั้งเดียว (ขั้น 1.1) ว่าโมเดลค้นหาอาการรันบน Render free (RAM 512 MB) ได้หรือไม่: โหลดโมเดล MiniLM q8, สร้างดัชนีจากข้อความอาการจริงของ 13 ผังแอร์, ยิงคำค้นตัวอย่าง 7 ข้อ, แล้วรายงานเวลาโหลด/ค้น และหน่วยความจำ (RSS) พร้อมตัดสิน "ผ่าน / เสี่ยง / ไม่ผ่าน" ไม่ใช่ส่วนของเซิร์ฟเวอร์ แต่ใช้ค่าตั้งชุดเดียวกับที่ `EmbeddingService` ใช้ (โมเดล, `q8`, 1 เธรด)

- **ใครเรียกใช้**: คนรันด้วยมือ (ตามคอมเมนต์: `node scripts/measure-embedding.js` ที่โฟลเดอร์ `backend/`) — ไม่มีไฟล์โค้ดอื่น import
- **เรียกใช้**: `node:fs`, `node:path`, `@huggingface/transformers`, ไฟล์ `data/manuals/samsung_ac_ar70h.json`, โฟลเดอร์ cache `backend/model-cache`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์วิธีใช้ (บรรทัด 1–16)
ครั้งแรกต้องต่ออินเทอร์เน็ตเพื่อดาวน์โหลดโมเดล ~118 MB ลง `backend/model-cache/` ควรรัน 2 รอบเพราะรอบแรกรวมเวลาดาวน์โหลด ; เป็นเครื่องมือวัดครั้งเดียว เขียนเป็น JS ธรรมดาเหมือน `run-migrations.js`

### บล็อก B — ค่าตั้ง (บรรทัด 21–52)
`MODEL_ID`, `DTYPE='q8'` (รุ่น quantized ~118 MB แทน fp32 ~470 MB), `CACHE_DIR = ../model-cache` (ต้องอยู่ใน `.gitignore`), `MANUAL_FILE`, เกณฑ์ตัดสิน `OK_LIMIT_MB=350` และ `RISKY_LIMIT_MB=450`, และ `SAMPLE_QUERIES` 7 ข้อ (`expect` = graph_id ที่ควรได้อันดับ 1 หรือ `null` = นอกขอบเขต) เช่น "แอร์ไม่เย็นเลย", "เครื่องซักผ้าน้ำไม่ไหลออก"

### บล็อก C — ตัวช่วย (บรรทัด 54–110)
- `toMb`, `rssMb`, `peakRssMb` (`process.resourceUsage().maxRSS` = หน่วยความจำสูงสุดตั้งแต่เริ่มโปรเซส ค่านี้สำคัญที่สุดเพราะ Render ปิดโปรเซสทันทีที่เกิน 512 MB แม้ชั่วขณะ)
- `cosine(a, b)`, `symptomTexts(graphs)` (ไทย + อังกฤษ + คำพ้อง), `rankGraphs(queryVector, index)` — เป็นสำเนาของตรรกะใน `symptom-matcher.ts` เขียนซ้ำในสคริปต์ (ไม่ได้ import) และ `rankGraphs` ที่นี่ไม่มีการตัดสินเสมอด้วย `graphId` ต่างจากของจริง

### บล็อก D — `main()` (บรรทัด 116–216)
1. พิมพ์ข้อมูลสภาพแวดล้อม (Node, โมเดล, โฟลเดอร์, RSS เริ่มต้น)
2. `require('@huggingface/transformers')` ตั้ง `env.cacheDir` (122–125)
3. โหลด pipeline `feature-extraction` พร้อม `intraOpNumThreads: 1` และจับเวลา (128–137)
4. `embed()` = mean pooling + normalize (139–142)
5. สร้างดัชนีจากข้อความจริงของ 13 ผัง จับเวลา (144–158)
6. ค้นตัวอย่าง พิมพ์ 3 อันดับแรก/คำค้น ตรวจ "อันดับ 1 ตรงตามคาด" และเก็บคะแนนสูงสุดของคำค้นนอกขอบเขต (160–188)
7. สรุป: เวลาโหลด/สร้างดัชนี/ค้นเฉลี่ย (ไม่นับครั้งแรก), จำนวนที่ตรงตามคาด, RSS สุดท้ายและ peak (190–205) แล้วตัดสิน `ผ่าน` (≤350) / `เสี่ยง` (350–450) / `ไม่ผ่าน` (>450) (207–213)
8. `main().catch` พิมพ์ error แล้ว `exit(1)` (218–221)

## 3. การส่งข้อมูล

```
data/manuals/samsung_ac_ar70h.json ─fs─► symptomTexts ─► embed (ONNX) ─► index (หน่วยความจำ)
SAMPLE_QUERIES ─► embed ─► rankGraphs ─► พิมพ์ผลที่ stdout
โมเดลจาก backend/model-cache (ดาวน์โหลดจาก HuggingFace ครั้งแรก)
```

## 4. จุดที่ควรระวัง

- **⚠️ สคริปต์นี้รันไม่ได้ตามสภาพปัจจุบัน** — ไฟล์มีนามสกุล `.mjs` (ES module) แต่ใช้ `require('node:fs')` (บรรทัด 18, 19, 123) และ `__dirname` (บรรทัด 33, 36) ซึ่งไม่มีใน ES module ผมทดลองรัน `node scripts/measure-embedding.mjs` (Node v22.17.0) แล้วขึ้น `ReferenceError: require is not defined in ES module scope` ที่บรรทัด 18 ทันที ส่วนคอมเมนต์ในไฟล์ (บรรทัด 1, 6) อ้างชื่อ `measure-embedding.js` (นามสกุล `.js`) — จึงน่าจะเป็นสคริปต์ CommonJS ที่ถูกตั้งนามสกุลเป็น `.mjs` (อนุมานจากโค้ด; ประวัติ git ของชื่อไฟล์นี้มีคอมมิตเดียว)
- ใช้โฟลเดอร์ `model-cache/` (ถูก ignore) ไม่ใช่ `model-slim/` ที่แอปจริงใช้ — ผลวัดจึงอาจต่างเล็กน้อยจากโมเดลที่ตัดคำศัพท์แล้ว
- ผลวัดเป็นของเครื่องผู้พัฒนา; คอมเมนต์เตือนเองว่า Render (Linux, CPU 0.1) จะช้ากว่านี้มาก และ RSS ที่วัดยังไม่รวมส่วนของ NestJS

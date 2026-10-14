# backend/scripts/eval-symptom-search.js

## 1. หน้าที่ของไฟล์

วัด "คุณภาพการค้นหาอาการ" ด้วยชุดคำค้นใน `data/eval/` (ขั้น 1.9.2) ใช้โค้ดชุดเดียวกับเซิร์ฟเวอร์จริง (โหลดจาก `dist/`: `EmbeddingService`, `buildSymptomTexts`, `rankGraphs`, `selectMatches`) จึงวัดของจริง ต่างข้อเดียวคืออ่านผังจากไฟล์ `data/manuals/samsung_ac_ar70h.json` โดยตรง ไม่ต่อ MySQL
มี 2 โหมด: **ชุดตั้งเกณฑ์ (`tuning`)** กวาดหลายเกณฑ์และดูรายข้อที่พลาด ; **ชุดรายงานผล (`report`)** วัดที่เกณฑ์เดียวที่เลือกไว้แล้ว โดยมีกติกาบังคับด้วยโค้ด

- **ใครเรียกใช้**: คนรัน (ต้อง `npm run build` ก่อน 1 ครั้ง) เช่น `node scripts/eval-symptom-search.js`, `--from 0.4 --to 0.8 --step 0.02`, `--show 0.6`, `--set report --threshold 0.62`
- **เรียกใช้**: `reflect-metadata`, `node:fs`, `node:path`, `node:child_process`, ไฟล์ `scripts/validate-eval-queries.js` (รันเป็น process ลูก), `dist/symptom-search/embedding.service.js` และ `symptom-matcher.js`, ไฟล์ข้อมูล `data/eval/queries_<set>.json`, `data/manuals/samsung_ac_ar70h.json`
- **เขียนไฟล์**: `data/eval/report_runs.jsonl` (เฉพาะโหมด report) และไฟล์ผลละเอียดตาม `--json`

## 2. อธิบายทีละบล็อก

### บล็อก A — กติกาชุดรายงานผล (คอมเมนต์ 19–23)
บังคับด้วยโค้ด: ต้องเป็น `status: "frozen"` และผ่านตัวตรวจ `--strict` ทั้งสองชุด ; ต้องระบุ `--threshold` เอง (เลือกจากชุดตั้งเกณฑ์) ไม่กวาดเกณฑ์บนชุดนี้ ; ทุกการรันถูกบันทึกลง `report_runs.jsonl` เป็นหลักฐานจำนวนครั้ง ; ห้ามนำรายข้อที่พลาดในชุดนี้ไปแก้ระบบ ถ้าแก้ชุดนี้ใช้รายงานผลไม่ได้อีก

### บล็อก B — พารามิเตอร์ (บรรทัด 33–52)
`SET` (tuning|report), `DIST`, `MAX_RESULTS` (3 — ต้องตรงกับ `MAX_RESULTS` ใน `symptom-search.service.ts`), `FROM/TO/STEP` (0.3/0.9/0.05), `JSON_OUT`, `THRESHOLD`, `SHOW` (0.55 = `MATCH_THRESHOLD`) ; path ของ `data/eval`, ไฟล์คู่มือ, ตัวตรวจ และ `RUN_LOG`

### บล็อก C — ด่านตรวจก่อนทำงาน (บรรทัด 54–90)
- `die()` พิมพ์ ❌ แล้ว `exit(1)`
- `--set` ต้องเป็น tuning/report ; report ต้องมี `--threshold` ; `--threshold` ต้องอยู่ใน (0, 1] ; ต้องมี `dist/symptom-search/embedding.service.js` (ไม่งั้นบอกให้ `npm run build`)
- รัน `validate-eval-queries.js` (โหมด report ใส่ `--strict`) ด้วย `spawnSync` ถ้าไม่ผ่านให้หยุด
- อ่าน `queries_<set>.json` ; report ต้อง `status === 'frozen'` ; ต้องมีคำค้นอย่างน้อย 1 ข้อ

### บล็อก D — โหลดโค้ดจริงและตัวช่วย (บรรทัด 92–103)
`require` ตัวที่ build แล้วจาก `dist/` ; ฟังก์ชันจัดรูปแบบ `shortId`, `f3`, `pad`, `rpad`

### บล็อก E — `main()` (บรรทัด 105–280)
1. โหลดโมเดล สร้างดัชนีแบบเดียวกับ `SymptomSearchService.prepareIndex` (106–116)
2. จัดอันดับทุกคำค้นต่อทั้ง 13 ผังครั้งเดียว เก็บ `best`, `margin` (อันดับ 1 ลบ 2), `rankOfExpected` (120–133)
3. แยกชุดในขอบเขต/นอกขอบเขต (135–136)
4. ผลที่ไม่ขึ้นกับเกณฑ์: อันดับ 1 / ใน 3 อันดับแรก, แยกตามลักษณะคำค้น (style), การกระจายคะแนนสูงสุดของสองกลุ่ม พร้อมเตือนถ้าช่วงซ้อนทับ (141–176)
5. `at(t)`: คำนวณที่เกณฑ์ t — จำนวนที่ผ่านเกณฑ์, ถูกปฏิเสธ, ผังถูกอันดับ 1, ผังถูกใน 3 อันดับ, นอกขอบเขตที่ปฏิเสธถูก (181–194) แล้วสร้างตารางกวาดหรือค่าเดียว (196–214)
6. โหมดกวาด: บอกเกณฑ์ต่ำสุดที่ไม่มีคำค้นนอกขอบเขตหลุดผ่าน (216–227)
7. รายข้อที่ต้องดู: ในขอบเขตที่ผังถูกไม่ได้อยู่อันดับ 1, ที่ถูกปฏิเสธ, นอกขอบเขตที่หลุดผ่าน (232–251)
8. สรุปเป็น `summary`; `--json` เขียนผลละเอียด; โหมด report `appendFileSync` ลง `report_runs.jsonl` และพิมพ์ลำดับครั้งที่รัน กับคำเตือนห้ามแก้ระบบ (256–278)
9. `process.exit(0)` (279) — error ใน `catch` ออก 1

## 3. การส่งข้อมูล

```
data/eval/queries_{tuning|report}.json ─┐
data/manuals/samsung_ac_ar70h.json ─────┼─► สคริปต์ ─► EmbeddingService (dist) ─► rankGraphs/selectMatches (dist)
validate-eval-queries.js (process ลูก) ─┘                 │
                                                          ├─► stdout (ตารางสรุป)
                                                          ├─► --json <ไฟล์>
                                                          └─► data/eval/report_runs.jsonl (เฉพาะ report)
```

## 4. จุดที่ควรระวัง

- **ต้อง build ก่อน** (`dist/` ต้องมี) ไม่เช่นนั้นสคริปต์หยุดทันที
- **`rankOfExpected` เป็น 0 เมื่อไม่พบผัง** (`findIndex + 1`) ซึ่งสรุปในรายการ "ผังถูกไม่อยู่อันดับ 1" จะพิมพ์ "อยู่อันดับ 0" (อนุมานจากโค้ด; กรณีนี้ไม่น่าเกิดเพราะ `rankGraphs` คืนทุกผังที่มีข้อความ)
- **ค่า `MAX_RESULTS` และ `SHOW` ซ้ำกับค่าใน service** ต้องแก้พร้อมกัน (คอมเมนต์เตือนที่บรรทัด 41, 47)
- **การรันชุด report มีผลถาวร** (เพิ่มบรรทัดใน `report_runs.jsonl`) ไม่ควรรันเล่น
- ตัวเลขจากชุดตั้งเกณฑ์เป็นแนวทางเลือกเกณฑ์ ไม่ใช่ผลรายงาน (บรรทัด 226) และ `MATCH_THRESHOLD` ใน service ระบุว่ายังไม่ได้ยืนยันด้วยชุดรายงานผล
- `require('reflect-metadata')` ถูกเรียกเพราะ `dist/` มี decorator ของ Nest

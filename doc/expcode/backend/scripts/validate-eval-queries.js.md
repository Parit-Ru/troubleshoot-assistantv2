# backend/scripts/validate-eval-queries.js

## 1. หน้าที่ของไฟล์

ตรวจชุดคำค้น (`data/eval/queries_tuning.json` และ `queries_report.json`) ก่อนนำไปวัดผลการค้นหาอาการ (ขั้น 1.9.1) ตรวจรูปแบบไฟล์/ฟิลด์, id ซ้ำ, ผังที่คาดหวังมีจริงไหม, คำค้นซ้ำ (รวมข้ามสองชุด), และห้ามคำค้นเหมือนข้อความตัวแทนของผัง "ทุกตัวอักษร" (เพราะจะได้คะแนน 1.0 เสมอ ทำให้ผลวัดดูดีเกินจริง) ไม่โหลดโมเดล ไม่ต่อ DB

- **ใครเรียกใช้**: คนรัน `node scripts/validate-eval-queries.js [--strict]` และ `eval-symptom-search.js` (เรียกเป็น process ลูกก่อนวัดผล โหมด report ใช้ `--strict`)
- **เรียกใช้**: `node:fs`, `node:path` ; ไฟล์ `data/eval/queries_tuning.json`, `queries_report.json`, `data/manuals/samsung_ac_ar70h.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ (บรรทัด 1–18)
แยก **ข้อผิดพลาด** (ทำให้ล้ม) ออกจาก **คำเตือน** (จำนวนน้อยเกินไป, ผังไหนมีคำค้นน้อยกว่า 2, คำค้นมีข้อความตัวแทนทั้งก้อนอยู่ข้างใน) ; `--strict` ให้คำเตือนถือเป็นข้อผิดพลาดด้วย

### บล็อก B — ค่าคงที่ (บรรทัด 20–49)
`EVAL_DIR`, `MANUAL_FILE`, `MAX_QUERY_LENGTH = 200` (ต้องตรงกับ `symptom-search.dto.ts`), `FILES` (สองชุด), รายการค่าที่อนุญาต: `CATEGORIES` (`in_scope`/`out_of_scope`), `STYLES_IN` (`colloquial`, `formal`, `english`, `typo_or_abbrev`, `vague`), `KINDS_OUT` (`other_appliance`, `ac_outside_manual`, `unrelated`), `STATUSES` (`draft`/`frozen`) ; เกณฑ์แนะนำ: รวมอย่างน้อย 40 ข้อ, อย่างน้อย 2 ข้อต่อผัง, นอกขอบเขตอย่างน้อย 30% ; `normalize` (ตัวพิมพ์เล็ก, ยุบช่องว่าง, trim)

### บล็อก C — ข้อมูลอ้างอิงจากผังจริง (บรรทัด 51–63)
`graphIds` และ `representative` = แผนที่ข้อความตัวแทน (ไทย → อังกฤษ → คำพ้อง ตาม `buildSymptomTexts`) ที่ normalize แล้ว → `graph_id`

### บล็อก D — ตรวจแต่ละชุด (บรรทัด 65–166)
ต่อไฟล์: ต้องมีไฟล์และ JSON ถูกไวยากรณ์ ; `set` ตรงชื่อ ; `author` ว่างเป็นคำเตือน ; `status` ถูกต้อง ; `queries` เป็นรายการ ; ต่อคำค้น:
- `id` ไม่ว่างและไม่ซ้ำข้ามสองชุด
- `query` เป็นข้อความไม่ว่าง ไม่เกิน 200 ตัวอักษร ไม่ซ้ำ (normalize แล้ว) ; ถ้าเหมือนข้อความตัวแทนทุกตัวอักษร → **ข้อผิดพลาด** ; ถ้ามีข้อความตัวแทน (ยาว ≥ 6) อยู่ทั้งก้อน → คำเตือน
- `category` ถูกต้อง ; `in_scope` ต้องมี `expected_graph_id` ที่มีอยู่จริงและ `style` ถูกต้อง ; `out_of_scope` ต้องมี `expected_graph_id: null` และ `kind` ถูกต้อง
- สรุปเตือนเรื่องจำนวนรวม สัดส่วนนอกขอบเขต และจำนวนต่อผัง

### บล็อก E — สรุปผลและ exit code (บรรทัด 168–194)
พิมพ์สรุปต่อไฟล์ (จำนวน, ลักษณะ, ต่อผัง), คำเตือน, ข้อผิดพลาด ; `failed = errors > 0 || (strict && warnings > 0)` ; `process.exit(failed ? 1 : 0)` พร้อม "ผล: ผ่าน/ยังไม่ผ่าน"

## 3. การส่งข้อมูล

```
data/eval/queries_tuning.json + queries_report.json + data/manuals/samsung_ac_ar70h.json
        ─fs.readFileSync/JSON.parse─► ตรวจ ─► stdout + exit code (0 ผ่าน / 1 ไม่ผ่าน)
eval-symptom-search.js ──spawnSync(node validate-eval-queries.js [--strict])──► อ่าน exit code
```

## 4. จุดที่ควรระวัง

- **`MAX_QUERY_LENGTH` ซ้ำกับค่าใน `symptom-search.dto.ts`** (คอมเมนต์เตือนให้ตรงกัน) ไม่มีกลไกอัตโนมัติ
- **ตรวจทั้งสองชุดพร้อมกันเสมอ**: ถ้าไฟล์ใดไฟล์หนึ่งขาด/ผิด สคริปต์ล้ม ทำให้การวัดชุดตั้งเกณฑ์ติดขัดเพราะชุดรายงานผลก็ได้ (ไฟล์ `queries_report.json` ที่ว่างเปล่าจะเกิดคำเตือนจำนวนข้อ — ต้องดูสรุปไฟล์ข้อมูล)
- ผลตรวจ "คำค้นมีข้อความตัวแทนอยู่ทั้งก้อน" เป็นเพียงคำเตือน (เปรียบเทียบด้วย `includes` ของสตริงที่ normalize แล้ว) อาจให้ผลบวกลวงกับข้อความตัวแทนสั้นที่ยาว ≥ 6 ตัวอักษร
- ใช้ผังแอร์ไฟล์เดียวเป็นฐานอ้างอิง (`MANUAL_FILE`) ถ้าเพิ่มคู่มืออื่นต้องแก้สคริปต์

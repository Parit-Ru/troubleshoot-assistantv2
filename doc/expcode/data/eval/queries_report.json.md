# data/eval/queries_report.json

## 1. หน้าที่ของไฟล์

แม่แบบ "ชุดรายงานผล" (report set) สำหรับวัดคุณภาพระบบค้นหาอาการ ปัจจุบันเป็นไฟล์ว่าง (80 ไบต์): `set: "report"`, `author: ""`, `status: "draft"`, `queries: []` ชุดนี้ตั้งใจให้เป็นชุดที่ผู้พัฒนาเขียนเอง "ล็อก" (frozen) แล้วใช้รายงานผลครั้งเดียวด้วยเกณฑ์ที่เลือกจากชุดตั้งเกณฑ์ (`queries_tuning.json`)

- **ใครเรียกใช้**: `backend/scripts/validate-eval-queries.js` (ตรวจ), `backend/scripts/eval-symptom-search.js` (โหมด `--set report`)
- **เรียกใช้**: ไม่มี (ข้อมูล)

## 2. อธิบายทีละบล็อก

| บรรทัด | key | ค่า | ความหมาย |
|---|---|---|---|
| 2 | `set` | `"report"` | ต้องตรงกับชื่อชุดที่ตัวตรวจคาด |
| 3 | `author` | `""` | ผู้เขียนคำค้น — ต้องระบุตรงๆ ว่าใครเป็นคนเขียน (ว่าง = คำเตือน) |
| 4 | `status` | `"draft"` | ต้องเป็น `"frozen"` ก่อนวัดผลรายงาน |
| 5 | `queries` | `[]` | ยังไม่มีคำค้น |

## 3. การส่งข้อมูล

```
queries_report.json ─► validate-eval-queries.js (ตรวจรูปแบบ) ─► eval-symptom-search.js --set report --threshold X
                                                                  └► บันทึกการรันที่ data/eval/report_runs.jsonl
```

## 4. จุดที่ควรระวัง

- **ตอนนี้วัดชุดรายงานผลไม่ได้**: `eval-symptom-search.js` ปฏิเสธเพราะ `status` ไม่ใช่ `frozen` และ `queries` ว่าง ; ตัวตรวจแบบ `--strict` ก็ไม่ผ่านเพราะ `author` ว่างและจำนวนข้อต่ำกว่าที่แนะนำ (40 ข้อ)
- คอมเมนต์ใน `symptom-search.service.ts` ระบุว่าเกณฑ์ `MATCH_THRESHOLD = 0.55` "ยังไม่ได้ยืนยันด้วยชุดรายงานผล" สอดคล้องกับที่ไฟล์นี้ยังว่าง
- ห้ามนำรายข้อที่พลาดในชุดนี้ไปแก้ระบบ เมื่อเริ่มใช้ (กติกาใน `eval-symptom-search.js`)

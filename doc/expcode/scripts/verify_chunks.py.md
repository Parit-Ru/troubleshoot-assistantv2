# scripts/verify_chunks.py

## 1. หน้าที่ของไฟล์

ตรวจว่า "chunk ของฐานความรู้" และ "กราฟแก้ปัญหา" ตรงกับคู่มือ PDF ต้นฉบับหรือไม่ โดยอ่านข้อความจากหน้า PDF ที่ chunk อ้างถึง (หน้าที่เป็นภาพอ่านด้วย OCR ของ `tesseract`) แล้วเทียบ ผลลัพธ์เป็นรายงาน Markdown และแผ่นตรวจ HTML (รูปหน้า PDF ข้างข้อความ chunk/กราฟ) ให้คนตรวจต่อ — ข้อจำกัดที่ docstring ระบุ: สคริปต์ **ไม่ได้ตัดสินว่าคำไทยมีความหมายตรงกับอังกฤษ** (ให้คนดูใน `review.html`)

- **ใครเรียกใช้**: คนรัน `python verify_chunks.py --chunks manual_x.json --pdf manual.pdf [--graphs graphs.json] [--offset 0] [--window 2] [--no-ocr] [--out verify_out]`
- **เรียกใช้**: `argparse`, `base64`, `html`, `json`, `re`, `shutil`, `subprocess`, `sys`, `pathlib`, `pymupdf` (หรือ `fitz` ถ้าเป็นรุ่นเก่า) และโปรแกรมภายนอก `tesseract` (ไม่บังคับ)
- **ไฟล์ที่อ่าน**: ไฟล์ chunk (เช่น `data/chunks/*.json`), ไฟล์ PDF คู่มือ (ไม่อยู่ใน repo), ไฟล์กราฟ (เช่น `data/manuals/*.json`) ; **ไฟล์ที่เขียน**: `<out>/report.md`, `<out>/review.html`, `<out>/ocr_cache/*`

## 2. อธิบายทีละบล็อก

### บล็อก A — docstring และเกณฑ์ (บรรทัด 1–51)
5 การตรวจ: (1) ข้อความ chunk เทียบหน้าที่อ้าง ด้วยความครอบคลุม word-trigram (2) ตัวเลข (ชั่วโมง ลิตร องศา …) ต้องปรากฏในหน้านั้น (3) ตรวจหน้าผิด: ให้คะแนนหน้าใกล้เคียง ±`--window` ถ้ามีหน้าที่ดีกว่าชัดเจนจะแจ้ง (4) กราฟ ↔ chunk ต้องสอดคล้อง (model, source, severity, page range) และทุกการอ้าง "คู่มือหน้า N" (5) ลิสต์ `author_note` ให้คนตรวจ ; exit code 1 ถ้ามี FAIL
เกณฑ์ปรับได้ (40–45): `MIN_TEXT_CHARS=150` (หน้าที่มีตัวอักษรน้อยกว่านี้ถือเป็นรูป → OCR), `PASS_SCORE=0.60`, `REWORD_WORDS=0.75`, `UNIT_MIN=0.35`, `BETTER_PAGE_DELTA=0.10` ; `LIG` แปลงอักขระพิเศษ (ligature fi/fl, เครื่องหมายคำพูดโค้ง, ขีดยาว) เป็น ASCII ; regex `NUM_RE`, `CITE_RE` (อ้างหน้าแบบไทย), `EN_CITE_RE` (อ้างหน้าแบบ `(pages 30-31)`)

### บล็อก B — ตัวช่วย `words`, `trigrams` (บรรทัด 54–59)
`words` ดึงเฉพาะ `[a-z0-9]+` (ตัวพิมพ์เล็ก) จึงมองเห็นเฉพาะภาษาอังกฤษ/ตัวเลข ; `trigrams` ชุดของ 3 คำติดกัน

### บล็อก C — `PageText` และ `Source` (บรรทัด 62–115)
`PageText` เก็บข้อความ วิธีอ่าน (`text`/`ocr`/`none`/`missing`) ชุดคำ trigram และชุดตัวเลข ; `Source` เปิด PDF ด้วย pymupdf, `page(p)` อ่านข้อความ (ถ้าน้อยกว่า 150 ตัวอักษรใช้ OCR), `_ocr(p)` เรนเดอร์หน้า 220 dpi เป็น PNG เรียก `tesseract ... -l eng --psm 3` แล้ว cache ผลเป็นไฟล์ `.txt` ; `png_b64` ให้รูปหน้า PDF แบบ base64

### บล็อก D — ตรวจ chunk (บรรทัด 118–228)
- `units_of`: แตก chunk เป็นหน่วย "symptom" และ "step" (แต่ละบรรทัดของ solution ตัดเลขลำดับ)
- `unit_cov`/`chunk_score`: ค่าครอบคลุม trigram ถ่วงน้ำหนักด้วยจำนวนคำ
- `pages_cited_in_text`, `chunk_numbers`: หน้าที่ข้อความ chunk อ้างเอง และตัวเลขใน chunk
- `check_chunk`: คืนผลต่อ chunk — `SKIP` (ไม่มีข้อความอ่านได้), ตั้งธงเมื่อมี step "NOT FOUND" (คำส่วนใหญ่ไม่อยู่ในหน้า — เช่นผู้พัฒนาเพิ่มเอง หรือหน้าผิด), "reworded" (คำอยู่แต่ลำดับต่าง), coverage ต่ำกว่า 0.60 ; ตัวเลขที่ไม่พบในหน้า (และหน้าที่ chunk อ้างเอง) → `FAIL` ; หน้าใกล้เคียงให้คะแนนดีกว่า ≥ 0.10 → `FAIL` (หน้าผิด?) ; มีธงแต่ไม่ FAIL → `REVIEW`

### บล็อก E — ตรวจกราฟ (บรรทัด 231–280)
`check_graph`: หา chunk จาก `source_chunk_id` (ไม่พบ → FAIL) ; เทียบ `model_pattern`↔`model`, `source`, `severity`, `difficulty` ; เลขหน้า chunk ต้องอยู่ใน `page_range` ; ต่อโหนด: เก็บ `author_note` ; ตัวเลขในข้อความโหนด (ไม่นับเลขในการอ้างหน้า) ต้องพบในหน้าที่อ้าง — ถ้าอ่านจากข้อความจริงแล้วไม่พบ → fails, ถ้ามาจาก OCR → flags (ให้ดูด้วยตา)

### บล็อก F — รายงาน (บรรทัด 283–357)
`write_md` เขียน `report.md` (ตาราง chunk/ขั้นที่อ่อน/กราฟ/`author_note`) ; `write_html` เขียน `review.html` เป็นการ์ดต่อ chunk มีช่องติ๊ก รูปหน้า PDF (ฝังเป็น base64) ข้อความ chunk (ไฮไลต์ขั้นที่อ่อน) และกราฟในรูป `<details>`

### บล็อก G — `main()` (บรรทัด 360–410)
รับ argument, สร้างโฟลเดอร์ output + `ocr_cache`, โหลด chunks (map ตาม `chunk_id`) และกราฟ (ถ้าระบุ), เปิด PDF, ตรวจทุก chunk/กราฟ, แจ้ง chunk ที่ไม่มีกราฟ, เขียนรายงาน, พิมพ์สรุปจำนวนสถานะ (`OK/SKIP/REVIEW/FAIL`) และ `exit(1)` ถ้ามี FAIL

## 3. การส่งข้อมูล

```
chunks.json + manual.pdf (+ graphs.json)
   ──pymupdf (ข้อความ) / tesseract (OCR รูป)──► PageText ► คะแนนความครอบคลุม + ตรวจตัวเลข
   ──► verify_out/report.md · verify_out/review.html (ฝังรูปหน้า PDF) · verify_out/ocr_cache/*
```

## 4. จุดที่ควรระวัง

- **ไฟล์ PDF ต้นฉบับไม่อยู่ใน repo** ต้องจัดหาเอง และ OCR ใช้ภาษา `eng` อย่างเดียว
- ตรวจเฉพาะภาษาอังกฤษ/ตัวเลข: ความถูกต้องของข้อความภาษาไทยไม่ถูกตรวจ (ตามที่ docstring ระบุ)
- `NOT FOUND` อาจหมายถึงผู้พัฒนาเขียนเพิ่มเอง ไม่ใช่ข้อผิดพลาดเสมอไป (ข้อความ flag ระบุ "added by developer or wrong page?")
- `review.html` ฝังรูปหน้า PDF ทุกการ์ดเป็น base64 (100 dpi) ไฟล์อาจใหญ่เมื่อ chunk เยอะ
- เกณฑ์ (`PASS_SCORE` ฯลฯ) เป็นค่าที่ตั้งด้วยมือ ผลว่า OK/REVIEW/FAIL ขึ้นกับค่าเหล่านี้
- ตัวเลขที่สะกดต่างจากต้นฉบับ (เช่น "1,000" กับ "1000") จะไม่ตรงเพราะ `NUM_RE` ดึงเฉพาะ `\d+(\.\d+)?` (อนุมานจากโค้ด)

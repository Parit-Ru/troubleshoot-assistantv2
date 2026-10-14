# scripts/inspect_vocab.py

## 1. หน้าที่ของไฟล์

สคริปต์สำรวจ (อ่านอย่างเดียว ไม่แก้ไฟล์ใดๆ — ขั้น 1.2.1) ก่อนลงมือ "ตัดตารางคำศัพท์" ของโมเดลค้นหาอาการ ตอบ 4 คำถาม: ตารางคำศัพท์อยู่ตรงไหนในไฟล์ ONNX/ชนิดอะไร/ใหญ่เท่าไร, ส่วนไหนของโมเดลใช้ตารางนี้, ถ้าเก็บเฉพาะ token ที่ทุกตัวอักษรเป็นไทย/ASCII/เครื่องหมายจะเหลือกี่ token, และข้อความจริงของระบบ (36 ข้อความตัวแทน + คำค้นตัวอย่าง) ใช้แต่ token ที่ถูกเก็บหรือไม่

- **ใครเรียกใช้**: คนรัน `python scripts/inspect_vocab.py` (ยืนที่รากของ repo ต้อง `pip install onnx==1.17.0` และมี `tokenizers`) ; และ `slim_model.py` ที่ `from inspect_vocab import SAMPLE_QUERIES, classify`
- **เรียกใช้**: `json`, `sys`, `pathlib`, `onnx` (+ `onnx.helper`), `tokenizers.Tokenizer` ; อ่านไฟล์โมเดลจาก `backend/model-cache/Xenova/paraphrase-multilingual-MiniLM-L12-v2/` (`onnx/model_quantized.onnx`, `tokenizer.json`, `config.json`) และ `data/manuals/samsung_ac_ar70h.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่ (บรรทัด 25–45)
path ของโมเดล/คู่มือ ; `SAMPLE_QUERIES` 7 ข้อ ชุดเดียวกับ `measure-embedding` ; `MIB`

### บล็อก B — กฎการเก็บ token (บรรทัด 52–78)
- `is_allowed_char(ch)`: อนุญาตเฉพาะ ASCII 0x20–0x7E, อักษรไทย 0x0E00–0x0E7F, `▁` (0x2581 เครื่องหมายขึ้นต้นคำของตัวตัดคำ), สัญลักษณ์ Latin-1 0xA0–0xBF (เช่น °, ±), `×` `÷`, และเครื่องหมายวรรคตอน 0x2000–0x206F (เช่น “ ” … – ที่มือถือพิมพ์ให้) — token ที่มีตัวอักษรนอกชุดแม้ตัวเดียวจะถูกตัด ; เหตุผลที่ผลไม่เปลี่ยน (คอมเมนต์ 56–57): ตัวตัดคำเลือกได้เฉพาะ token ที่เป็นส่วนของข้อความ ถ้าข้อความมีแต่อักขระในชุด token ที่มีอักขระอื่นย่อมไม่ถูกเลือก
- `classify(piece)`: คืน `removed` / `thai` / `ascii` / `symbol`

### บล็อก C — ตัวช่วย (บรรทัด 85–106)
`tensor_bytes`, `dtype_name`, `section` (พิมพ์หัวข้อ), `require(path)` (ถ้าไม่มีไฟล์ `sys.exit` พร้อมบอกให้รัน `node scripts/measure-embedding.js` ใน `backend/` ก่อน)

### บล็อก D — `inspect_onnx(vocab_size)` ส่วนที่ 1 (บรรทัด 113–149)
โหลด ONNX พิมพ์ขาเข้า/ขาออก ; เรียง initializer (น้ำหนัก) จากใหญ่ไปเล็ก พิมพ์ 8 ตัวแรก ; หา "ตารางคำศัพท์" = initializer ที่มิติแรก = `vocab_size` ; สร้างแผนที่ผู้ใช้ (consumers) แล้วพิมพ์ว่า node ไหน (และต่อไปอีกหนึ่งชั้น) ใช้ตารางนี้ ; คืนรายการตาราง

### บล็อก E — `inspect_tokenizer()` ส่วนที่ 2 (บรรทัด 156–193)
อ่าน `tokenizer.json` (`model.vocab` = `[ข้อความ, คะแนน]` ลำดับ = id) นับกลุ่ม `special/thai/ascii/symbol/removed` เก็บ `kept_ids` (รวม token พิเศษ) พิมพ์สรุปและตัวอย่าง token ที่ถูกตัด ; คืน `(จำนวนคำศัพท์, kept_ids)`

### บล็อก F — `check_real_texts(kept_ids)` ส่วนที่ 3 (บรรทัด 200–223)
รวมข้อความตัวแทนของทุกผังแอร์ (ไทย/อังกฤษ/คำพ้อง) กับคำค้นตัวอย่าง แล้วตัดคำด้วย `Tokenizer.from_file` ตรวจว่าทุก token id อยู่ใน `kept_ids` ; พิมพ์ ✗ ข้อความที่ใช้ token ที่จะถูกตัด และตัวอย่างการตัดคำ

### บล็อก G — `estimate(...)` ส่วนที่ 4 และ `main()` (บรรทัด 230–266)
ประมาณขนาดที่ลดได้ (ตามชนิดในไฟล์ และถ้าอยู่ในหน่วยความจำเป็น float32) เทียบกับ RSS ที่วัดได้ ~380 MiB ในขั้น 1.1 ; `main` ตรวจว่ามีไฟล์ครบ, อ่าน `config.json` (`vocab_size`, `hidden_size`), เรียกส่วน 1→2→3→4 และเตือนถ้าจำนวน token ใน tokenizer ไม่เท่า config

## 3. การส่งข้อมูล

```
backend/model-cache/Xenova/.../{onnx/model_quantized.onnx, tokenizer.json, config.json}  ──► สำรวจ ──► stdout (รายงาน 4 ส่วน)
data/manuals/samsung_ac_ar70h.json ──► ข้อความตัวแทน ──► Tokenizer ──► ตรวจ token ที่ถูกเก็บ
```
ไม่เขียนไฟล์ใดๆ

## 4. จุดที่ควรระวัง

- **ต้องมี `backend/model-cache/` ที่ถูก ignore ไม่อยู่ใน git** — โฟลเดอร์ต้นฉบับนี้ได้จากการรัน `measure-embedding` ซึ่งตามที่สรุปไว้ไฟล์ `measure-embedding.mjs` ปัจจุบัน **รันไม่ผ่าน** (ใช้ `require` ใน ES module) จึงต้องเตรียมโมเดลต้นฉบับด้วยวิธีอื่น (อนุมานจากโค้ด)
- **กฎเก็บ token ผูกกับชุดข้อความของระบบ**: ถ้าผู้ใช้พิมพ์อักษรนอกชุด (เช่น จีน, é) จะกลายเป็น `<unk>` หลังตัดตาราง — เป็นข้อแลกเปลี่ยนที่สคริปต์ `slim_model.py` ยอมรับไว้
- ผลที่ได้เป็น "ประมาณการ" ที่ต้องวัดจริงหลังตัด (บรรทัด 245)
- ไฟล์ import `onnx` และ `tokenizers` ระดับบนสุด ดังนั้นการ `import inspect_vocab` จาก `slim_model.py` ก็ต้องมีสองไลบรารีนี้ติดตั้งด้วย

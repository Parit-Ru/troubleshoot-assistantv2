# scripts/slim_model.py

## 1. หน้าที่ของไฟล์

ตัดตารางคำศัพท์ของโมเดลค้นหาอาการให้เหลือเฉพาะไทย/อังกฤษ (ขั้น 1.2.2): อ่านโมเดลต้นฉบับจาก `backend/model-cache/` (ไม่แก้ต้นฉบับ) แล้วเขียนโมเดลที่ตัดแล้วไปที่ `backend/model-slim/` ในโครงโฟลเดอร์เดียวกัน — ผลคือไฟล์ที่เก็บใน git ซึ่งแอปจริงโหลด (`embedding.service.ts`) และจากโค้ดจะเห็นว่าจำนวนคำศัพท์เหลือ 87,519 (ตรงกับ `vocab_size` ใน `config.json` ของ model-slim)

- **ใครเรียกใช้**: คนรัน `py -3.12 scripts/slim_model.py` (ยืนที่รากของ repo)
- **เรียกใช้**: `json`, `shutil`, `sys`, `pathlib`, `numpy`, `onnx` (+ `numpy_helper`), `tokenizers`, และ `from inspect_vocab import SAMPLE_QUERIES, classify` (กฎการเก็บ token และคำค้นตัวอย่างอยู่ที่เดียว ไม่ลอกซ้ำ)
- **ไฟล์ที่อ่าน**: `backend/model-cache/Xenova/paraphrase-multilingual-MiniLM-L12-v2/*`, `data/manuals/samsung_ac_ar70h.json` ; **ไฟล์ที่เขียน**: `backend/model-slim/Xenova/paraphrase-multilingual-MiniLM-L12-v2/{onnx/model_quantized.onnx, tokenizer.json, config.json, tokenizer_config.json}`

## 2. อธิบายทีละบล็อก

### บล็อก A — docstring อธิบายขั้นตอน (บรรทัด 1–29)
5 ขั้น: (1) เลือก token ที่เก็บด้วยกฎเดียวกับ `inspect_vocab.py` (2) เรียง token ตาม id เดิมแล้วกำหนด id ใหม่ 0.. (token พิเศษ id 0–3 `<s> <pad> </s> <unk>` คงเดิม ; `<mask>` เป็น id สูงสุดจึงอยู่ท้าย) (3) ตัดแถวของตารางคำศัพท์ในไฟล์ ONNX (น้ำหนักส่วนอื่นไม่แตะ) (4) เขียน `tokenizer.json`/`config.json`/`tokenizer_config.json` ใหม่ให้ id ตรง (5) ตรวจตัวเอง: ทุกข้อความที่ระบบใช้ค้นต้องได้ token เหมือนเดิมและแถวตารางเหมือนเดิมทุกไบต์ ถ้าไม่ผ่านลบผลที่เขียนทิ้งแล้ว `exit 1` ; ทุกครั้งที่รันลบ `model-slim/` ของรอบก่อนก่อน
เหตุผลที่ผลของโมเดลไม่เปลี่ยน (คอมเมนต์ 21–25): ผลลัพธ์ขึ้นกับแถวจากตารางคำศัพท์ + น้ำหนักส่วนอื่น + attention_mask + token_type_ids ; น้ำหนักอื่นเหมือนเดิมทุกไบต์ (ตรวจ) แถวที่ป้อนเหมือนเดิมทุกไบต์ (ข้อ 5) ; ขั้น 1.2.3 ยืนยันซ้ำด้วย cosine กับโมเดลจริง

### บล็อก B — ค่าคงที่และตัวช่วย (บรรทัด 45–88)
`SRC_DIR`, `DST_DIR`, `FIXED_IDS = [0,1,2,3]`; `load_json`, `write_json` (กะทัดรัด `separators=(",",":")`, `ensure_ascii=False`), `fail`, `section` ; `reset_output_dir()` ลบ `DST_DIR` ทิ้งโดยมีเงื่อนไขกันพลาดว่า path ต้องมี `model-slim` (บรรทัด 78–81)

### บล็อก C — `choose_kept_ids(tokenizer_json)` (บรรทัด 94–107)
คืน id เดิมของ token ที่เก็บ (ใช้ `classify(piece) != "removed"` หรือเป็น token พิเศษ) เรียงน้อยไปมาก ; รองรับเฉพาะกรณีที่ token พิเศษทุกตัวอยู่ในรายการ vocab

### บล็อก D — `slim_onnx` และ `check_onnx_unchanged_except_table` (บรรทัด 114–162)
- หาตารางคำศัพท์ = initializer เดียวที่มิติแรก = `vocab_size` (ต้องพบ 1 ตัว) ; เช็คว่า `vocab_size` ไม่ไปปรากฏในรูปร่าง input/output/value_info อื่น ; ตัดแถว `new = old[kept]` แล้วบันทึก ONNX ; คืน `(old, new, ชื่อตาราง)`
- เปรียบเทียบไฟล์ที่เขียนกับต้นฉบับ: โครงกราฟ (op_type, ชื่อ node, input/output, ir_version, opset) และน้ำหนักอื่นทุกตัวต้องตรงกันทุกไบต์

### บล็อก E — เขียน tokenizer/config ใหม่ (บรรทัด 169–193)
`slim_tokenizer_json` สร้างสำเนาลึก ตัด `vocab` ตาม `kept`, แก้ `unk_id`, `added_tokens[].id`, และ id ของ `<s>`/`</s>` ใน `post_processor.special_tokens` ; `slim_tokenizer_config` แก้ `added_tokens_decoder` ถ้ามี

### บล็อก F — ตรวจตัวเอง (บรรทัด 200–232)
`collect_search_texts` (ข้อความตัวแทนทุกผัง + คำค้นตัวอย่าง), `collect_step_texts` (คำถาม/คำสั่ง/คำเตือนในโหนดทุกตัว — ไม่ได้ใช้ค้น ดูขอบเขตเท่านั้น), `compare_texts` (ตรวจ token เหมือนเดิม และ `np.array_equal(old_table[ids], new_table[ids])`)

### บล็อก G — `main()` (บรรทัด 239–331)
ตรวจไฟล์ต้นฉบับครบ → `reset_output_dir()` → ส่วน 1 เลือก token และตรวจว่า id 0–3 ไม่เปลี่ยน, พิมพ์ id ของ `<mask>` → ส่วน 2 ตัด ONNX → ส่วน 3 เขียน tokenizer/config (+ คัดลอก `special_tokens_map.json` ถ้ามี) → ส่วน 4 ตรวจตัวเอง และสาธิตข้อความที่มีอักษรนอกชุด (`"café 中文"` กลายเป็น `<unk>`) → ถ้า `bad` ไม่ว่างลบผลทิ้งแล้ว `fail` → สรุปขนาดไฟล์ก่อน/หลัง

## 3. การส่งข้อมูล

```
backend/model-cache/Xenova/...  ──(อ่าน)──► เลือก token ► ตัดแถวตาราง ► เขียนไฟล์ใหม่ ──► backend/model-slim/Xenova/...
data/manuals/samsung_ac_ar70h.json ──► ข้อความที่ใช้ตรวจตัวเอง
```

## 4. จุดที่ควรระวัง

- **เขียนทับโฟลเดอร์ที่เก็บใน git**: `backend/model-slim/` ถูกลบทั้งโฟลเดอร์แล้วสร้างใหม่ทุกครั้งที่รัน (รวม `model_quantized.onnx` ~55.9 MB และ `tokenizer.json` ที่ติดตามอยู่ใน git) ถ้ารันโดยไม่ตั้งใจ ไฟล์ที่ commit ไว้จะถูกแทนด้วยผลใหม่
- **ต้องมี `backend/model-cache/` ต้นฉบับ** ซึ่งไม่อยู่ใน git — ได้จากสคริปต์วัด `measure-embedding` ที่ปัจจุบันรันไม่ผ่าน (ดูสรุปของไฟล์นั้น)
- ตัวอักษรนอกชุด (เช่น จีน, é) กลายเป็น `<unk>` — ข้อแลกเปลี่ยนที่ยอมรับตามที่พิมพ์ในสคริปต์ (บรรทัด 319)
- การตรวจตัวเองครอบคลุมเฉพาะข้อความที่ระบบใช้ค้นหา (และข้อความในโหนดเพื่อดูขอบเขต) ไม่ใช่ทุกคำค้นที่ผู้ใช้อาจพิมพ์ในอนาคต
- การเปรียบเทียบ "ทุกไบต์" ใช้ `SerializeToString()` ของ initializer ทีละตัว ไม่ใช่การรันโมเดลจริง (การรันจริงเทียบ cosine เป็นขั้น 1.2.3 ตามที่สคริปต์ระบุ)

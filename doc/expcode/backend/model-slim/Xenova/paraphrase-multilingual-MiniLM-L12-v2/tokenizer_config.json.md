# backend/model-slim/Xenova/paraphrase-multilingual-MiniLM-L12-v2/tokenizer_config.json

## 1. หน้าที่ของไฟล์

ไฟล์ตั้งค่าตัวตัดคำ (tokenizer) ของโมเดล บอกชนิดตัวตัดคำ ตัวอักษรพิเศษ (special tokens) และกติกาการจัดรูปข้อความก่อนส่งเข้าโมเดล (JSON บรรทัดเดียว 403 ไบต์)

- **ใครเรียกใช้**: `@huggingface/transformers` ผ่าน `EmbeddingService.load()` — โค้ดของเราไม่อ่านไฟล์นี้ตรงๆ
- **เรียกใช้**: ทำงานคู่กับ `tokenizer.json` (พจนานุกรม/กติกาตัดคำ ขนาด ~3.2 MB ซึ่งไม่ได้สรุปเพราะเป็นข้อมูลโมเดลขนาดใหญ่)

## 2. อธิบายทีละบล็อก (ตาม key)

| key | ค่า | ความหมาย |
|---|---|---|
| `tokenizer_class` | `BertTokenizer` | ชนิดตัวตัดคำ |
| `do_lower_case` | `true` | แปลงเป็นตัวพิมพ์เล็กก่อนตัดคำ |
| `strip_accents` | `null` | ไม่ระบุ (ใช้ค่าตามโมเดล) |
| `tokenize_chinese_chars` | `true` | แยกอักษรจีนทีละตัว |
| `clean_up_tokenization_spaces` | `true` | จัดช่องว่างหลังถอดรหัส |
| `model_max_length` | `512` | ความยาวลำดับสูงสุด |
| `bos_token` / `cls_token` | `<s>` | ตัวเริ่มประโยค |
| `eos_token` / `sep_token` | `</s>` | ตัวจบ/คั่นประโยค |
| `pad_token` | `<pad>` | ตัวเติม |
| `unk_token` | `<unk>` | คำไม่รู้จัก |
| `mask_token` | `{content: "<mask>", lstrip: true, normalized: true, rstrip: false, single_word: false}` | ตัวปิดบัง (AddedToken) |

## 3. การส่งข้อมูล

ไฟล์ → ไลบรารีอ่านจากดิสก์ตอนโหลดโมเดล → ข้อความที่ผู้ใช้พิมพ์ (เช่น "แอร์ไม่เย็น") ผ่านตัวตัดคำนี้เป็นลำดับโทเค็น → ส่งเข้า ONNX → ได้เวกเตอร์ 384 มิติ

## 4. จุดที่ควรระวัง

- `model_max_length: 512` — ข้อความยาวเกินจะถูกตัดโดยไลบรารี ส่วนระบบจำกัดคำค้นไว้ 200 ตัวอักษร (`MAX_QUERY_LENGTH`) จึงไม่น่าถึงเพดานนี้ (อนุมานจากโค้ด)
- `do_lower_case: true` มีผลกับตัวอักษรละติน ไม่กระทบอักษรไทย
- ต้องใช้คู่กับ `tokenizer.json` ที่ถูกตัดคำศัพท์ชุดเดียวกัน

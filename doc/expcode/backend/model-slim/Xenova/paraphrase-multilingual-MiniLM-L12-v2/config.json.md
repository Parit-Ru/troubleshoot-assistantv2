# backend/model-slim/Xenova/paraphrase-multilingual-MiniLM-L12-v2/config.json

## 1. หน้าที่ของไฟล์

ไฟล์กำหนดโครงสร้างโมเดล (hyperparameter) ของโมเดล `paraphrase-multilingual-MiniLM-L12-v2` ที่ตัดคำศัพท์แล้ว ให้ไลบรารี `@huggingface/transformers` อ่านตอนโหลดโมเดล (ไฟล์ JSON บรรทัดเดียว ขนาด 578 ไบต์)

- **ใครเรียกใช้**: `@huggingface/transformers` ผ่าน `EmbeddingService.load()` (`env.cacheDir` ชี้ไป `backend/model-slim`) — โค้ดของเราไม่อ่านไฟล์นี้ตรงๆ
- **เรียกใช้**: ไม่มี (เป็นข้อมูล) ทำงานร่วมกับ `tokenizer.json`, `tokenizer_config.json` และ `onnx/model_quantized.onnx` (ไฟล์ ~55.9 MB)

## 2. อธิบายทีละบล็อก (ตาม key ที่มี)

| key | ค่า | ความหมาย |
|---|---|---|
| `_name_or_path` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | โมเดลต้นทาง |
| `architectures` / `model_type` | `BertModel` / `bert` | สถาปัตยกรรม BERT |
| `hidden_size` | `384` | มิติของเวกเตอร์ผลลัพธ์ (ตรงกับ "เวกเตอร์ 384 มิติ" ใน `embedding.service.ts`) |
| `num_hidden_layers` | `12` | จำนวนชั้น |
| `num_attention_heads` | `12` | จำนวน head |
| `intermediate_size` | `1536` | ขนาดชั้นกลางของ feed-forward |
| `max_position_embeddings` | `512` | ความยาวลำดับสูงสุด |
| `vocab_size` | `87519` | ขนาดตารางคำศัพท์หลังตัด (ใช้ตัวเลขนี้เป็นเครื่องบ่งชี้ว่าเป็นรุ่น "slim") |
| `hidden_act` | `gelu` | ฟังก์ชันกระตุ้น |
| `layer_norm_eps` | `1e-12` | |
| `pad_token_id` | `0` | |
| `position_embedding_type` | `absolute` | |
| `type_vocab_size` | `2` | |
| `attention_probs_dropout_prob`, `hidden_dropout_prob`, `classifier_dropout`, `initializer_range`, `gradient_checkpointing`, `use_cache`, `transformers_version` | `0.1`, `0.1`, `null`, `0.02`, `false`, `true`, `4.29.2` | ค่าที่ใช้ตอนเทรน/ส่งออก ไม่มีผลกับการใช้งานเพื่ออนุมาน (inference) |

## 3. การส่งข้อมูล

ไฟล์ → `@huggingface/transformers` อ่านจากดิสก์ (`backend/model-slim/Xenova/paraphrase-multilingual-MiniLM-L12-v2/`) ตอน `pipeline('feature-extraction', …)` โดยไม่ใช้เครือข่าย (`allowRemoteModels = false`)

## 4. จุดที่ควรระวัง

- `vocab_size` (87519) ต้องสอดคล้องกับ `tokenizer.json` และ `model_quantized.onnx` ที่ตัดคำศัพท์ด้วยกัน (สร้างโดย `scripts/slim_model.py`) ห้ามสลับไฟล์ข้ามชุด (อนุมานจากโค้ดสคริปต์ที่เกี่ยวข้อง)
- ถ้าเปลี่ยนโมเดล ต้องตรวจให้ `hidden_size` ยังเป็น 384 เพราะ `cosineSimilarity` โยน error เมื่อมิติไม่เท่ากัน
- ไฟล์นี้อยู่ใน git (ต่างจาก `model-cache/` ที่ถูก ignore)

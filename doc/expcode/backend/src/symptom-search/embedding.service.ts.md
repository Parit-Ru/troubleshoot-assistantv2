# backend/src/symptom-search/embedding.service.ts

## 1. หน้าที่ของไฟล์

แปลง "ข้อความ" เป็น "เวกเตอร์ 384 มิติ" ด้วยโมเดล MiniLM หลายภาษา (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, แบบบีบอัด q8) ผ่านไลบรารี `@huggingface/transformers` (transformers.js) หน้าที่เดียวคือ ข้อความเข้า → เวกเตอร์ออก ไม่รู้เรื่องผังขั้นตอนหรือคะแนน (ส่วนนั้นอยู่ใน `symptom-matcher.ts`)
โมเดลเป็นแบบสำเร็จรูปที่ตัดตารางคำศัพท์แล้ว อยู่ใน repo ที่ `backend/model-slim/` จึง "ห้ามดาวน์โหลด" ตอนรันจริง (คอมเมนต์ 9–10)

- **ใครเรียกใช้**: `symptom-search.service.ts` (เรียก `load()` และ `embed()`), `symptom-search.module.ts` (provider), `symptom-search.service.spec.ts`
- **เรียกใช้**: `fs`, `path`, `@nestjs/common`, `@huggingface/transformers` (โหลดแบบ lazy)

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์และ import (บรรทัด 1–18)
คอมเมนต์ 12–13 ระบุว่าไฟล์นี้ไม่มี test ของตัวเอง เพราะต้องโหลดโมเดลจริง (~250 MB RAM) พิสูจน์ด้วยสคริปต์วัดใน `backend/scripts/` และ `GET /symptom-search/status`

### บล็อก B — ค่าคงที่ (บรรทัด 20–30)
- `EMBEDDING_MODEL_ID` (20) = `'Xenova/paraphrase-multilingual-MiniLM-L12-v2'`
- `EMBEDDING_DTYPE` (23) = `'q8'` (บีบอัด 8 บิต ไฟล์ `onnx/model_quantized.onnx`)
- `MODEL_CACHE_DIR` (30) = `path.resolve(__dirname, '../../model-slim')` — คอมเมนต์ 26–28 ระบุว่านับจากไฟล์นี้ขึ้นไป 2 ระดับคือ `backend/` ทั้งตอนรันจาก `src/` และจาก `dist/`

### บล็อก C — type `FeatureExtractor` (บรรทัด 32–36)
ประกาศเฉพาะส่วนของฟังก์ชันสกัดเวกเตอร์ที่ใช้: รับ `text` กับ `{ pooling: 'mean', normalize: boolean }` คืน `Promise<{ data: ArrayLike<number> }>`

### บล็อก D — คลาส `EmbeddingService` (บรรทัด 38–87)
- field: `logger`, `extractor` (เริ่มเป็น `null`), `modelFilesFoundLocally` (44, public) = พบไฟล์โมเดลในเครื่องก่อนโหลดหรือไม่
- **`load()`** (51–74):
  1. ถ้า `extractor` มีแล้ว ออกทันที (52)
  2. เช็ค `fs.existsSync(.../onnx/model_quantized.onnx)` เก็บใน `modelFilesFoundLocally` (54–61)
  3. `await import('@huggingface/transformers')` แบบ lazy (63) — คอมเมนต์ 48–49: เซิร์ฟเวอร์ที่ปิดฟีเจอร์ค้นหาไม่ต้องโหลดไลบรารีนี้เลย ประหยัด RAM
  4. ตั้ง `env.cacheDir = MODEL_CACHE_DIR` และ `env.allowRemoteModels = false` (64–65) ห้ามดาวน์โหลด
  5. สร้าง pipeline `'feature-extraction'` ด้วย `dtype: 'q8'` และ `session_options: { intraOpNumThreads: 1 }` (68–71) — 1 เธรดเพราะ Render free มี 0.1 CPU
  6. log เวลาโหลด (73)
- **`embed(text)`** (77–86): ถ้ายังไม่ `load()` โยน `Error` (78–80); เรียก extractor ด้วย `mean pooling` + `normalize: true` (81–84) คืน `Float32Array.from(output.data)` (85)
- **รับ**: `text: string` — **คืน**: `Float32Array` ยาว 384 (ปรับเป็นเวกเตอร์ยาว 1 หน่วย เพราะ `normalize: true`)

## 3. การส่งข้อมูล

```
SymptomSearchService ──embed("แอร์ไม่เย็น")──► EmbeddingService ──► ONNX Runtime (CPU, 1 thread)
                                                     │ ไฟล์: backend/model-slim/Xenova/paraphrase-multilingual-MiniLM-L12-v2/…
                     ◄──────── Float32Array(384) ────┘
```
ส่งด้วย function call ธรรมดา (ในโปรเซสเดียวกัน) ไม่มี HTTP / ไม่ออกเน็ต

## 4. จุดที่ควรระวัง

- **`load()` ไม่กันการเรียกซ้อนกัน**: ตรวจ `if (this.extractor) return` ก่อน แต่ถ้าถูกเรียกพร้อมกันสองครั้งก่อนโหลดเสร็จ จะโหลดโมเดลสองรอบ — ปัจจุบันถูกเรียกครั้งเดียวจาก `prepareIndex` (อนุมานจากโค้ด)
- **`MODEL_CACHE_DIR` พึ่งโครงสร้างโฟลเดอร์หลัง build**: `__dirname/../../` ใช้ได้ก็ต่อเมื่อไฟล์ที่คอมไพล์อยู่ลึกจาก `backend/` สองระดับ (เช่น `dist/symptom-search/`) ขึ้นกับ `outDir`/`rootDir` ใน `tsconfig` (ดูสรุป `tsconfig.json`)
- **ใช้ RAM มาก** (~250 MB ตามคอมเมนต์) บนเครื่องที่มี 512 MB จึงมีสวิตช์ปิดฟีเจอร์ใน `SymptomSearchService`
- `embed()` ไม่ล็อกคิว คำขอพร้อมกันจะรันซ้อนกันบน CPU 1 เธรด (อนุมานจากโค้ด)
- `modelFilesFoundLocally` เป็น field public ที่แก้ไขได้จากภายนอก (ใช้อ่านใน `getStatus()`)

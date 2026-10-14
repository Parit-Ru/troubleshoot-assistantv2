# backend/src/symptom-search/symptom-search.service.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ของ `SymptomSearchService` ตรวจ "การต่อสาย" ของ service: ลำดับการเรียก, สถานะ (disabled/loading/ready/failed), และการแปลง error — **ไม่ได้พิสูจน์คุณภาพการค้นหาของโมเดลจริง** (คอมเมนต์ 12–13)
ไม่โหลดโมเดลจริง ไม่ต่อ MySQL: ใช้ตัวแปลงข้อความปลอมแบบ one-hot (ข้อความตัวแทนลำดับที่ i ได้เวกเตอร์ที่มี 1 ที่มิติ i ค้นด้วยข้อความตัวแทนตรงๆ จึงได้คะแนน 1 กับผังของมันและ 0 กับผังอื่น ซึ่งไม่ขึ้นกับค่าเกณฑ์) และ `GraphRepository` ปลอมที่สร้างจากไฟล์ผังแอร์จริง 13 ชุด

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `SymptomSearchService` และค่าคงที่/error จาก `./symptom-search.service`, `buildSymptomTexts` จาก `./symptom-matcher`, type ของ `GraphRepository`, `EmbeddingService`, `ManualFile`, `TroubleshootingGraph`, `Logger` จาก Nest และไฟล์ข้อมูล `data/manuals/samsung_ac_ar70h.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — ข้อมูลจริงและตัวปลอม (บรรทัด 32–94)
- อ่านผังแอร์จริงด้วย `fs.readFileSync` + `JSON.parse` เป็น `realGraphs` (36–41)
- `fakeRepo(graphs)` (44–57): ปลอม `GraphRepository` ให้มีแค่ `listAll` / `findById` ที่ service ใช้ (cast ผ่าน `unknown`)
- `fakeEmbedding(embedFn, loadFn)` (60–69): ปลอม `EmbeddingService` — `load` ควบคุมเวลาโหลดได้, `embed` คืน `Float32Array`, `modelFilesFoundLocally: true`
- `repTexts` / `oneHot` (72–78): สร้าง one-hot จากข้อความตัวแทน 36 ข้อความ ข้อความไม่รู้จัก = เวกเตอร์ศูนย์
- `gate()` (81–87): ตัวหน่วงให้เทสควบคุมว่า `load()` เสร็จเมื่อไร
- `waitUntilSettled(service)` (90–94): วนรอจนสถานะไม่ใช่ `loading` (สูงสุด 200 รอบ × 5 ms)

### บล็อก B — `describe('SymptomSearchService')` (บรรทัด 100–312) — 13 เทส
`beforeAll` ปิด log, `afterAll` คืน log, `afterEach` คืนค่า env `SYMPTOM_SEARCH_ENABLED` (101–108)

| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 110 | `prepareIndex`: ดัชนี 36 ข้อความ จาก 13 ผัง, สถานะ `ready`, `loadMs` ไม่ null, `error` null, `modelFilesFoundLocally` true |
| 126 | `search` ด้วยข้อความตัวแทนของผังแรก → ผังนั้นอันดับ 1 คะแนน 1, `matches` ยาว 1, ข้อมูลครบ (`graphId`, `entrySymptom`, `entrySymptomTh`, `deviceCategory`, `score`, `matchedText`) |
| 151 | คำค้นที่ไม่ตรงผังใดเลย → `matches` ว่าง แต่ `bestScore` เป็น 0 |
| 163 | คะแนนที่ส่งออกปัด 3 ตำแหน่ง (เวกเตอร์ `[1,0]` กับ `[1,1]` → 0.707) |
| 178 | `search` ขณะกำลังโหลด → `SearchNotReadyError`; พอ `open()` แล้วสถานะเป็น `ready` |
| 194 | `search` ขณะปิด (ยังไม่เคยโหลด) → `SearchUnavailableError` |
| 203 | โหลดโมเดลล้ม → `prepareIndex` ไม่โยน error, สถานะ `failed`, `error` = 'ไม่พบไฟล์โมเดล', ดัชนี 0, `search` ได้ `SearchUnavailableError` |
| 220 | `onApplicationBootstrap` ไม่ตั้ง env → ไม่เรียก `load`, สถานะ `disabled`, คืน `undefined` |
| 235 | เปิด env เป็น `'true'` → คืน `undefined` ทันที (ไม่ใช่ Promise), สถานะ `loading` แล้วเป็น `ready` |
| 254 | ค่า env `'1'`, `'TRUE'`, `'yes'`, `''` ถือว่าปิด (ต้องเป็น `'true'` เป๊ะๆ) |
| 266 | `scoreGraph` คืนคะแนนของผัง "ที่ระบุ" (1 สำหรับผังเดียวกับคำค้น, 0 สำหรับผังอื่น) ไม่ใช่ผังที่คะแนนสูงสุด |
| 279 | `scoreGraph` ตอนไม่พร้อม (disabled / loading / failed) → `null` ไม่โยน error |
| 303 | `scoreGraph` กับ `graphId` ที่ไม่อยู่ในดัชนี → `null` |

## 3. การส่งข้อมูล

```
Jest ─► new SymptomSearchService(fakeEmbedding, fakeRepo) ─► prepareIndex()/search()/scoreGraph()/getStatus()
data/manuals/samsung_ac_ar70h.json ──fs──► realGraphs ──► fakeRepo + oneHot
```
ไม่มี HTTP / DB / โมเดลจริง

## 4. จุดที่ควรระวัง

- เทสผูกกับจำนวนข้อมูลจริงในไฟล์คู่มือแอร์ (13 ผัง, 36 ข้อความ) — เพิ่ม/ลบข้อมูลทำให้เทสที่ 110 ล้ม
- `afterAll` คืนระดับ log เป็น `['log','error','warn']` ตายตัว ไม่ได้คืนค่าเดิม (บรรทัด 104) ซึ่งอาจต่างจากการตั้งค่าเดิมของโปรเซสเทส (อนุมานจากโค้ด)
- ไม่ทดสอบการเรียก `search` ซ้อนพร้อมกัน และไม่ทดสอบการเรียก `prepareIndex` ซ้ำขณะ `ready`
- เทสที่ 235 อาศัยการสั่ง `void this.prepareIndex()` ใน service จริง (พิสูจน์เจตนา "ไม่รอโหลด" ตามคอมเมนต์ใน `symptom-search.service.ts` บรรทัด 111–115)

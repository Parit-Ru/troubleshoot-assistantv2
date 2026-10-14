# backend/src/symptom-search/symptom-search.service.ts

## 1. หน้าที่ของไฟล์

ต่อชิ้นส่วนงานค้นหาอาการเข้าด้วยกัน: `EmbeddingService` (ข้อความ→เวกเตอร์), `symptom-matcher` (คิดคะแนน/เลือกผัง), `GraphRepository` (ข้อมูลผังในหน่วยความจำ) ไฟล์นี้ "ไม่มีตรรกะคำนวณของตัวเอง" มีแค่จัดลำดับการเรียกและจัดการสถานะ (disabled/loading/ready/failed)
หน้าที่ของระบบค้นหาคือเลือกว่า "จะเริ่มผังขั้นตอนไหน" เท่านั้น ผู้ใช้ต้องยืนยันเอง ส่วนขั้นถัดไปในผังเป็นของเครื่องสถานะ (คอมเมนต์ 12–13)

- **ใครเรียกใช้**: `symptom-search.controller.ts` (`search`, `getStatus`), `traversal.service.ts` (`scoreGraph`), `symptom-search.module.ts`, `symptom-search.exception.filter.ts` (error class), spec หลายไฟล์
- **เรียกใช้**: `../traversal/graph.repository`, `./embedding.service`, `./symptom-matcher`, type จาก `./symptom-search.dto` และ `../traversal-engine/types`

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่ (บรรทัด 42–58)
- `MATCH_THRESHOLD = 0.55` (52): เกณฑ์ขั้นต่ำของ cosine ที่ถือว่า "ตรงพอจะเสนอผู้ใช้" — คอมเมนต์ 47–50 ระบุว่าเลือกจากตารางกวาดเกณฑ์ของชุดตั้งเกณฑ์ 56 ข้อ ซึ่งร่างโดย AI ผู้พัฒนายังไม่ได้ตรวจแก้ และ **"ยังไม่ได้ยืนยันด้วยชุดรายงานผล ห้ามอ้างเป็นความแม่นยำของระบบ"**
- `MAX_RESULTS = 3` (55): จำนวนผังสูงสุดที่แสดง
- `ENABLE_ENV_NAME = 'SYMPTOM_SEARCH_ENABLED'` (58): ต้องเป็น `'true'` เท่านั้นจึงเปิดฟีเจอร์

### บล็อก B — error 2 ตัว (บรรทัด 60–78)
- `SearchNotReadyError` (65–70): โมเดลกำลังโหลด ลองใหม่ได้ → 503 `SEARCH_NOT_READY`
- `SearchUnavailableError` (73–78): ปิดอยู่หรือโหลดไม่สำเร็จ → 503 `SEARCH_UNAVAILABLE`

### บล็อก C — state ภายใน (บรรทัด 84–106)
`GraphInfo` (85–89), `round3` (91) ปัด 3 ตำแหน่ง, field: `state` (เริ่ม `'disabled'`), `index: IndexedSymptom[]`, `graphInfo: Map`, `loadMs`, `lastError` ; constructor ฉีด `EmbeddingService` กับ `GraphRepository`

### บล็อก D — `onApplicationBootstrap()` (บรรทัด 108–128)
- ถ้า `process.env.SYMPTOM_SEARCH_ENABLED !== 'true'` → `state = 'disabled'` log แล้วออก (120–124)
- ไม่เช่นนั้น `state = 'loading'` แล้ว `void this.prepareIndex()` (126–127)
- **คืน `void` ไม่ใช่ `Promise` โดยตั้งใจ** (คอมเมนต์ 111–115): ถ้าคืน Promise Nest จะรอโหลดโมเดลเสร็จก่อนเปิดรับ request ทำให้ `/health` และด่านความปลอดภัยตอบไม่ได้ (Render free โหลดช้ามาก) จึงสั่งโหลดแบบไม่รอ ให้ `/symptom-search/status` รายงานความคืบหน้า
- ปิดเป็นค่าเริ่มต้น กันหน่วยความจำเกินแล้วเซิร์ฟเวอร์ล่มทั้งตัว

### บล็อก E — `prepareIndex()` (บรรทัด 130–176)
1. ตั้ง `loading`, ล้าง `lastError`, จับเวลา (137–139)
2. `await embedding.load()` (142)
3. ดึงผังเต็ม: วน `graphs.listAll()` แล้ว `findById` (เพราะ `listAll()` ไม่มีคำพ้อง — คอมเมนต์ 144) เก็บ `GraphInfo` ของแต่ละผัง (145–156)
4. สร้างข้อความอาการด้วย `buildSymptomTexts` แล้ว embed **ทีละข้อความ ไม่ขนาน** (159–162) เพราะ CPU น้อยและอยากให้หน่วยความจำคงที่
5. เก็บ `index`, `graphInfo`, `loadMs`, `state = 'ready'` และ log (164–170)
6. `catch`: `state = 'failed'`, เก็บ `lastError`, log error (171–175) — **ไม่โยน error ออก** เซิร์ฟเวอร์ส่วนอื่นทำงานต่อได้ (คอมเมนต์ 133–134); เป็น public เพื่อให้เทสเรียกและรอได้

### บล็อก F — `search(query)` (บรรทัด 178–211)
- `loading` → โยน `SearchNotReadyError`; สถานะอื่นที่ไม่ใช่ `ready` → `SearchUnavailableError` (183–184)
- embed คำค้น (186) → `rankGraphs` (187) → `selectMatches(ranked, 0.55, 3)` (190) แล้ว map เป็น `SymptomMatchDto` โดยเติมข้อมูลจาก `graphInfo` และปัด `score` 3 ตำแหน่ง (190–202)
- คืน `{ query, threshold, bestScore, matches }` (204–210): `bestScore` ส่งเสมอแม้ไม่มีผังผ่านเกณฑ์ (`null` ถ้าไม่มีผังให้เทียบ)
- เทียบเกณฑ์ด้วยค่าเต็ม แล้วปัดเศษตอนส่งออก (คอมเมนต์ 189)

### บล็อก G — `scoreGraph(query, graphId)` (บรรทัด 213–226)
คะแนนความคล้ายระหว่างคำค้นกับผัง "ที่ระบุ" (ปัด 3 ตำแหน่ง) ไว้เป็นคะแนนความมั่นใจของ session — คืน `null` (ไม่โยน error) เมื่อระบบไม่พร้อม หรือผังไม่อยู่ในดัชนี เพราะเป็นข้อมูลเสริมแสดงผลอย่างเดียว ห้ามทำให้การเริ่ม session ล้ม ไม่แต่งตัวเลขแทน (คอมเมนต์ 214–218)

### บล็อก H — `getStatus()` (บรรทัด 228–241)
คืน `SearchStatusDto`: state, model, dtype, จำนวนข้อความ/ผัง, `loadMs`, `modelFilesFoundLocally`, `error`, `memoryRssMb` จาก `process.memoryUsage().rss`

## 3. การส่งข้อมูล

```
SYMPTOM_SEARCH_ENABLED=true ─► onApplicationBootstrap ─► (พื้นหลัง) prepareIndex
        GraphRepository.listAll/findById ─► buildSymptomTexts ─► EmbeddingService.embed (ทีละข้อความ) ─► index (RAM)
POST /symptom-search ─► search(query) ─► embed(query) ─► rankGraphs ─► selectMatches ─► SymptomSearchResponseDto
POST /traversal/sessions (มี query) ─► TraversalService ─► scoreGraph ─► confidence (number|null)
```

## 4. จุดที่ควรระวัง

- **เกณฑ์ 0.55 ยังไม่ผ่านการยืนยัน** ตามที่คอมเมนต์เตือนเอง — ห้ามอ้างเป็นความแม่นยำ
- **ระหว่าง `prepareIndex` ถูกเรียกซ้ำ** (เช่นจากเทส) state จะเป็น `loading` ทันทีและ `search` จะโยน `SearchNotReadyError` แม้ดัชนีเก่ายังใช้ได้ (อนุมานจากโค้ด)
- **`scoreGraph` embed คำค้นและจัดอันดับทั้งดัชนีใหม่ทุกครั้ง** ทั้งที่ผู้ใช้อาจเพิ่งค้นหาด้วยคำเดียวกัน ไม่มี cache (อนุมานจากโค้ด)
- `this.graphInfo.get(r.graphId) as GraphInfo` (192) ใช้ `as` บังคับ type ถ้าดัชนีกับ `graphInfo` ไม่ตรงกัน จะเกิด `TypeError` ตอนอ่าน field — ปัจจุบันสร้างพร้อมกัน จึงไม่เกิด
- `onApplicationBootstrap` ทำงานหลัง `onModuleInit` ของ `GraphRepository` ตามลำดับ lifecycle ของ Nest ดังนั้นผังโหลดเสร็จแล้วก่อนสร้างดัชนี (อนุมานจากโค้ดและ lifecycle มาตรฐาน)

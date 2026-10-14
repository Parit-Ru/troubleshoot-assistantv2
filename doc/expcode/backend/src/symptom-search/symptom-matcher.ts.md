# backend/src/symptom-search/symptom-matcher.ts

## 1. หน้าที่ของไฟล์

ตรรกะ "จับคู่อาการ" ที่เป็นฟังก์ชันล้วน: รับ "เวกเตอร์ของคำค้น" กับ "ดัชนีเวกเตอร์ของข้อความอาการ" แล้วบอกว่าผังขั้นตอนไหนคล้ายที่สุด ไม่รู้จักโมเดล ฐานข้อมูล หรือ NestJS (เทสได้เร็วด้วยเวกเตอร์ปลอม — คอมเมนต์ 7–9)
ข้อควรจำ (คอมเมนต์ 11–12): คะแนน cosine ไม่ใช่ความน่าจะเป็น ต้องเรียก "คะแนนความคล้าย" ห้ามแสดงเป็น "มั่นใจ x%"

- **ใครเรียกใช้**: `symptom-search.service.ts`, `symptom-matcher.spec.ts`, `symptom-search.service.spec.ts`
- **เรียกใช้**: type `TroubleshootingGraph` จาก `../traversal-engine/types` เท่านั้น

## 2. อธิบายทีละบล็อก

### บล็อก A — type (บรรทัด 15–41)
- `SymptomSource` (18–21) = `Pick<TroubleshootingGraph, 'graph_id' | 'entry_symptom' | 'entry_symptom_th' | 'entry_symptom_aliases'>` — เลือกเฉพาะ field ที่ใช้สร้างข้อความอาการ
- `SymptomText { graphId, text }` (24–27) — ข้อความอาการ 1 ข้อความ
- `IndexedSymptom extends SymptomText { vector }` (30–32) — 1 แถวของดัชนีในหน่วยความจำ
- `RankedGraph { graphId, score, matchedText }` (35–41) — ผลจัดอันดับ 1 แถวต่อ 1 ผัง; `score` คือ cosine สูงสุดของผังนั้น (ยังไม่ปัดเศษ)

### บล็อก B — `cosineSimilarity(a, b)` (บรรทัด 43–69)
- สูตร `(a·b) / (|a| × |b|)`
- ความยาวไม่เท่ากัน → โยน `Error('cosineSimilarity: dimension mismatch …')` (52–56) ซึ่งแปลว่าใช้โมเดลคนละตัวปนกัน
- เวกเตอร์ใดเป็นศูนย์ทั้งหมด → คืน `0` กันหารด้วยศูนย์ (67)
- **รับ**: `ArrayLike<number>` สองตัว — **คืน**: `number` (−1 ถึง 1)

### บล็อก C — `buildSymptomTexts(graphs)` (บรรทัด 71–96)
- สร้างรายการข้อความอาการของทุกผัง ลำดับต่อผัง: **ไทย → อังกฤษ → คำพ้อง** (`entry_symptom_th`, `entry_symptom`, `...entry_symptom_aliases`) (81–85)
- trim แล้วข้ามข้อความว่าง (88–91)
- ใช้เฉพาะ field ที่มีในข้อมูล ไม่แต่งประโยคเพิ่ม (คอมเมนต์ 75)
- **รับ**: `SymptomSource[]` — **คืน**: `SymptomText[]` (หนึ่งผังให้ได้หลายข้อความ)

### บล็อก D — `rankGraphs(queryVector, index)` (บรรทัด 98–128)
- วนทุกแถวของดัชนี คำนวณ cosine กับคำค้น (111) เก็บคะแนนสูงสุดต่อ `graphId` ใน `Map` พร้อม `matchedText` (112–119)
- เรียงคะแนนมากไปน้อย ถ้าเท่ากันเรียงตาม `graphId` (ตัวอักษร) เพื่อให้ผลซ้ำได้เสมอ (122–127)
- **คืน**: `RankedGraph[]` 1 แถวต่อ 1 ผัง

### บล็อก E — `selectMatches(ranked, threshold, max)` (บรรทัด 130–141)
- กรอง `score >= threshold` แล้วตัดไม่เกิน `max` (`Math.max(0, max)` กัน max ติดลบ)
- ถ้าไม่มีผังผ่านเกณฑ์ คืนรายการว่าง — ผู้เรียกต้องส่งต่อศูนย์บริการ "ห้ามเดา" (คอมเมนต์ 133)

## 3. การส่งข้อมูล

```
(ตอนสร้างดัชนี)  ผัง ──buildSymptomTexts──► [{graphId,text}] ──EmbeddingService──► IndexedSymptom[] (เก็บไว้ในหน่วยความจำ)
(ตอนค้นหา)       queryVector + IndexedSymptom[] ──rankGraphs──► RankedGraph[] ──selectMatches(0.55, 3)──► ผังที่ผ่านเกณฑ์
```
ตัวอย่าง `RankedGraph`: `{ graphId: "<graph_id>", score: 0.6123456, matchedText: "แอร์ไม่เย็น" }`
การส่งทั้งหมดเป็น function call ในโปรเซสเดียวกัน

## 4. จุดที่ควรระวัง

- **ค้นเชิงเส้นทั้งดัชนี** (`rankGraphs` วนทุกแถว) เหมาะกับดัชนีขนาดเล็กระดับหลายสิบ–ร้อยข้อความ ไม่มีโครงสร้างเร่งความเร็ว (อนุมานจากโค้ด)
- **`cosineSimilarity` คำนวณ norm ใหม่ทุกครั้ง** ทั้งที่เวกเตอร์ถูก `normalize: true` มาแล้วจาก `EmbeddingService` (จึงเท่ากับ dot product) — ความซ้ำซ้อนเพื่อความถูกต้องแม้รับเวกเตอร์ที่ไม่ normalize (อนุมานจากโค้ด)
- ถ้า `threshold` เป็น `NaN` ตัวกรองจะคืนว่างเสมอ (`score >= NaN` เป็น false) — ผู้เรียกใช้ค่าคงที่จึงไม่เจอ
- ผังที่ไม่มีข้อความอาการเลย จะไม่ปรากฏในผลจัดอันดับ (เพราะไม่มีแถวในดัชนี)

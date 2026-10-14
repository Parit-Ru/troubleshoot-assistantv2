# backend/src/symptom-search/symptom-search.module.ts

## 1. หน้าที่ของไฟล์

ประกอบงานค้นหาอาการ (embedding + จับคู่ + controller) ให้เป็นโมดูลเดียว และ export `SymptomSearchService` ให้ `TraversalModule` ยืมไปคิดคะแนนความมั่นใจ

- **ใครเรียก**: `app.module.ts` และ `traversal/traversal.module.ts`
- **เรียกใช้**: `../traversal/graph.module`, `./embedding.service`, `./symptom-search.controller`, `./symptom-search.service`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์หัวไฟล์ (บรรทัด 1–8)
- import `GraphModule` เพื่อยืม `GraphRepository` ตัวเดียวกัน ไม่สร้างซ้ำ เพราะจะโหลดผังจาก MySQL สองรอบและอาจได้ข้อมูลไม่ตรงกัน
- export เฉพาะ `SymptomSearchService`

### บล็อก B — `@Module` (บรรทัด 17–23)
- `imports: [GraphModule]`
- `exports: [SymptomSearchService]` (คอมเมนต์ 19: ให้ `TraversalModule` ยืมไปคิดคะแนนของ session)
- `controllers: [SymptomSearchController]`
- `providers: [EmbeddingService, SymptomSearchService]`
- `EmbeddingService` (ตัวแปลงข้อความเป็นเวกเตอร์) ไม่ถูก export จึงใช้ภายนอกโมดูลนี้ไม่ได้ (ตั้งใจให้ปิดไว้ — อนุมานจากโค้ด)

## 3. การส่งข้อมูล

```
POST /symptom-search → SymptomSearchController → SymptomSearchService
                          ├─ EmbeddingService (แปลงคำค้นเป็นเวกเตอร์)
                          └─ GraphRepository (จาก GraphModule: ข้อมูลผังเพื่อสร้างดัชนีอาการ)
TraversalService ─(ยืม)→ SymptomSearchService
```

## 4. จุดที่ควรระวัง

- หากมีคนใส่ `GraphRepository` ใน `providers` ของโมดูลนี้ จะโหลดผังซ้ำ (ตามที่คอมเมนต์เตือน)
- โมดูลนี้ถูก import จากสองที่ (`AppModule` และ `TraversalModule`) แต่ Nest ประกอบเป็น singleton เดียว `EmbeddingService` จึงโหลดโมเดลครั้งเดียว (อนุมานจากพฤติกรรมมาตรฐานของ Nest ว่าโมดูลเป็น singleton)

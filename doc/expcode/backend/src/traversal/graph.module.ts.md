# backend/src/traversal/graph.module.ts

## 1. หน้าที่ของไฟล์

โมดูลเล็กที่เป็นเจ้าของ `GraphRepository` (ที่เก็บผังขั้นตอนทั้งหมดในหน่วยความจำ) แล้ว export ให้โมดูลอื่นใช้ร่วมกัน เพื่อให้ทั้งระบบมี `GraphRepository` เพียงตัวเดียว

- **ใครเรียก**: `traversal.module.ts` และ `symptom-search.module.ts`
- **เรียกใช้**: `./graph.repository`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์ (บรรทัด 1–14)
อธิบายเหตุผลของการแยกโมดูล:
- `TraversalModule` ต้องใช้ `SymptomSearchService` (คิดคะแนนความมั่นใจ) และ `SymptomSearchModule` ต้องใช้ `GraphRepository` (สร้างดัชนีอาการ) — ถ้า import กันตรงๆ จะวนเป็นวงกลม
- จึงให้ทั้งสองโมดูล import `GraphModule` ที่ไม่พึ่งใครเลย
- ผลคือโหลดผังจาก MySQL ครั้งเดียวตอนบูต (`onModuleInit`) ใช้ตัวเดียวกันทั้งแอป

### บล็อก B — `@Module({ providers, exports })` (บรรทัด 20–24)
- `providers: [GraphRepository]` และ `exports: [GraphRepository]`
- **รับ/คืน**: ไม่มี เป็นการประกาศโครงสร้าง

## 3. การส่งข้อมูล

```
GraphModule (เจ้าของ GraphRepository ตัวเดียว)
   ├─ ← imported by TraversalModule  (ผ่าน TraversalService/Controller ใช้ findById/listAll)
   └─ ← imported by SymptomSearchModule (ผ่าน SymptomSearchService สร้างดัชนี)
```
ข้อมูลผังเป็น object ในหน่วยความจำที่ทั้งสองฝั่งอ้างถึง instance เดียวกัน

## 4. จุดที่ควรระวัง

- ตามกติกาของ Nest provider ในโมดูลที่ import ซ้ำหลายที่จะเป็น singleton ตัวเดียวต่อแอปตราบที่ไม่ได้ลงทะเบียน `GraphRepository` ซ้ำในโมดูลอื่น — ต้องไม่เพิ่ม `GraphRepository` ลงใน `providers` ของโมดูลอื่นเพราะจะได้อีก instance และโหลดผังซ้ำ (อนุมานจากคอมเมนต์ใน `symptom-search.module.ts` บรรทัด 4–5)
- `MYSQL_POOL` มาจาก `DatabaseModule` ที่เป็น `@Global()` จึงไม่ต้อง import ที่นี่ (คอมเมนต์ 13)

# backend/src/traversal/traversal.module.ts

## 1. หน้าที่ของไฟล์

ประกอบ controller, service และตัวอ่าน/เขียนข้อมูลของ "การตรวจเช็ก" (traversal session) ให้เป็นโมดูลเดียว

- **ใครเรียก**: `app.module.ts`
- **เรียกใช้**: `./graph.module`, `./equipment.repository`, `./session.store`, `./traversal.service`, `./traversal.controller` และ `../symptom-search/symptom-search.module`

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์หัวไฟล์ (บรรทัด 1–13)
- ไม่ต้อง import `DatabaseModule` เพราะเป็น `@Global()` แม้ `EquipmentRepository` และ `SessionStore` ใช้ `MYSQL_POOL`
- `imports`: `GraphModule` (ใช้ `GraphRepository` ตัวเดียวกับงานค้นหา) และ `SymptomSearchModule` (ให้ `TraversalService` คิดคะแนนความมั่นใจ)
- ไม่มี `exports` เพราะยังไม่มีโมดูลอื่นต้องการ

### บล็อก B — import (บรรทัด 15–22)
นำเข้าคลาสที่จะประกอบ

### บล็อก C — `@Module` (บรรทัด 24–29)
- `imports: [GraphModule, SymptomSearchModule]`
- `controllers: [TraversalController]`
- `providers: [EquipmentRepository, SessionStore, TraversalService]`
- สังเกต: `GraphRepository` ไม่อยู่ใน `providers` เพราะมาจาก `GraphModule` ที่ export ไว้

## 3. การส่งข้อมูล

```
HTTP → TraversalController → TraversalService → { GraphRepository (จาก GraphModule),
                                                  SessionStore, EquipmentRepository,
                                                  SymptomSearchService (จาก SymptomSearchModule) }
```
เป็นการประกาศ dependency ให้ Nest ฉีดผ่าน constructor

## 4. จุดที่ควรระวัง

- `SymptomSearchModule` ถูก import ที่นี่เพื่อใช้ `SymptomSearchService` เท่านั้น (โมดูลนั้น export เฉพาะตัวนี้) ทิศทางเป็นทางเดียว: Traversal → SymptomSearch → Graph ไม่มีลูกศรย้อนกลับ จึงไม่เกิดวงกลมของ dependency
- หากมี provider ใหม่ใน module นี้ที่ต้องใช้ pool ก็ใช้ `@Inject(MYSQL_POOL)` ได้เลยโดยไม่ต้อง import DB module

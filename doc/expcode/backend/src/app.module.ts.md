# backend/src/app.module.ts

## 1. หน้าที่ของไฟล์

โมดูลราก (root module) ของ NestJS: ประกอบโมดูลย่อยทั้ง 4 เข้าเป็นแอปเดียว — `DatabaseModule`, `HealthModule`, `TraversalModule`, `SymptomSearchModule`
ตัวมันเองไม่มี controller / provider ของตัวเอง

- **ใครเรียก**: `backend/src/main.ts` (ผ่าน `NestFactory.create(AppModule)`)
- **เรียกใช้**: `database/database.module.ts`, `health/health.module.ts`, `traversal/traversal.module.ts`, `symptom-search/symptom-search.module.ts`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 1–5)
นำเข้า decorator `Module` และคลาสโมดูลย่อยทั้ง 4 ตัว

### บล็อก B — `@Module({ imports: [...] })` (บรรทัด 7–15)
- **บรรทัด 9–10**: คอมเมนต์ระบุว่า `DatabaseModule` เป็น `@Global()` จึงต้องวางก่อนโมดูลที่ใช้ฐานข้อมูล — เพื่อให้ provider ของ DB (connection pool) ถูกลงทะเบียนก่อนที่โมดูลอื่นจะขอใช้
- **บรรทัด 11–13**: `HealthModule` (`/health`), `TraversalModule` (REST ของ session), `SymptomSearchModule` (ค้นอาการ)
- **คลาส `AppModule` (16)**: เป็นคลาสว่าง ใช้เป็นที่แขวน metadata ของ decorator

- **รับอะไร/คืนอะไร**: ไม่มี (เป็นการประกาศโครงสร้าง)

## 3. การส่งข้อมูล

ไม่มีการส่งข้อมูลโดยตรง ทำหน้าที่ "ต่อสาย" ให้ Nest ทราบว่า provider/controller ใดอยู่ในแอป:

```
AppModule
 ├─ DatabaseModule (Global: mysql pool)
 ├─ HealthModule        → GET /health
 ├─ TraversalModule     → /traversal/...
 └─ SymptomSearchModule → /symptom-search
```

## 4. จุดที่ควรระวัง

- `TraversalModule` import `SymptomSearchModule` (เพื่อใช้ `SymptomSearchService`) ส่วน `SymptomSearchModule` ไม่ได้ import `TraversalModule` กลับ แต่ import `GraphModule` ที่แยกออกมาแทน (ดู `graph.module.ts` และ `symptom-search.module.ts`) จึงไม่เกิดการพึ่งพากันเป็นวงกลม
- คอมเมนต์เรื่องลำดับ (บรรทัด 9) ฟังเหมือนว่าลำดับใน array สำคัญ แต่จริงๆ Nest จัดการ dependency ระหว่างโมดูลเอง และ `@Global()` ทำให้ใช้ได้ทุกที่ ลำดับจึงเป็นแนวปฏิบัติเพื่ออ่านง่ายมากกว่ากฎตายตัว (อนุมานจากโค้ด)

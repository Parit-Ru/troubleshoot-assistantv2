# backend/src/database/database.constants.ts

## 1. หน้าที่ของไฟล์

ประกาศค่าคงที่ตัวเดียว `MYSQL_POOL = 'MYSQL_POOL'` ซึ่งเป็น "ชื่อเรียก" (injection token) ของ connection pool MySQL ในระบบ Dependency Injection ของ NestJS

- **ใครเรียกใช้**: `database.module.ts` (ลงทะเบียน provider), `health.controller.ts`, `equipment.repository.ts`, `graph.repository.ts`, `session.store.ts` (ขอรับ pool ด้วย `@Inject(MYSQL_POOL)`)
- **เรียกใช้ไฟล์อื่น**: ไม่มี

## 2. อธิบายทีละบล็อก

### บล็อก A — คอมเมนต์อธิบายเหตุผล (บรรทัด 1–16)
บอกว่าปกติ Nest ใช้ "ชื่อคลาส" เป็นตัวระบุสิ่งที่จะฉีดเข้า constructor แต่ `Pool` ของ `mysql2` ไม่ใช่คลาสที่เราเขียน (ได้จากฟังก์ชัน `createPool()`) จึงต้องตั้งชื่อเป็น string เองแล้ว `@Inject()` ระบุ

### บล็อก B — `export const MYSQL_POOL = 'MYSQL_POOL'` (บรรทัด 17)
- **ทำอะไร**: เก็บ string ไว้ที่เดียว
- **ทำไม**: คอมเมนต์บรรทัด 14–15 ระบุว่าเพื่อกันพิมพ์ string ผิดคนละที่ (ถ้าพิมพ์ `'MYSQL_POOOL'` จะพังตอนรัน ไม่ใช่ตอน compile)
- **รับ/คืน**: ไม่มี เป็นค่าคงที่

## 3. การส่งข้อมูล

ไม่ส่งข้อมูลเอง แต่ทำหน้าที่เป็น "กุญแจ" เชื่อมสองฝั่ง:
`database.module.ts` (provide: MYSQL_POOL → คืน Pool) ⇄ ผู้ใช้ pool (`@Inject(MYSQL_POOL) pool: Pool`)

## 4. จุดที่ควรระวัง

- ค่าที่ใช้เป็น token เป็น string ธรรมดา ถ้าสร้าง provider ชื่อซ้ำที่อื่นด้วย string เดียวกันจะชนกันโดยไม่มี error ตอน compile (อนุมานจากธรรมชาติของ string token)
- ไฟล์ไม่มี `import` จึงปลอดภัยที่จะ import จากที่ไหนก็ได้โดยไม่เกิดวงกลมของ dependency

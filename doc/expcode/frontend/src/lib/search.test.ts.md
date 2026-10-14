# frontend/src/lib/search.test.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Vitest) ของ `normalizeQuery`, `checkQuery`, `formatScore` ใน `search.ts`

- **ใครเรียกใช้**: Vitest ; **เรียกใช้**: `MAX_QUERY_LENGTH, checkQuery, formatScore, normalizeQuery` จาก `./search`

## 2. อธิบายทีละบล็อก (6 เทส)

| กลุ่ม / บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| `normalizeQuery` (4–8) | ตัดช่องว่างหน้าหลัง ไม่แตะช่องว่างกลางข้อความ |
| `checkQuery` (10–29) | ปกติ → `ok` ; ว่าง/ช่องว่าง → `empty` ; ยาวพอดี 200 → `ok`, เกิน 1 → `too-long` ; นับหลังตัดช่องว่าง |
| `formatScore` (31–37) | 0.812 → `0.812`, 0.8 → `0.800`, 1 → `1.000` |

## 3. การส่งข้อมูล

Vitest เรียกฟังก์ชันล้วนโดยตรง

## 4. จุดที่ควรระวัง

- ใช้ตัวอักษรไทย `'ก'.repeat(MAX_QUERY_LENGTH)` นับด้วย `.length` ไม่มีเทสอักขระนอก BMP
- ไม่ทดสอบว่าค่า 200 ตรงกับ backend (ต่างจาก `outcome.test.ts` ที่ล็อกเลข 1000)

# frontend/src/components/layout/ServerStatus.tsx

## 1. หน้าที่ของไฟล์

ป้ายเล็กๆ ใน sidebar บอกว่าตอนนี้เชื่อมต่อเซิร์ฟเวอร์ได้ไหม มี 5 สถานะ : `mock` (โหมดจำลอง ไม่เรียก `/health`), `checking` (กำลังรอ), `ok` (เซิร์ฟเวอร์และ DB ปกติ), `degraded` (ตอบได้แต่ต่อ DB ไม่ได้), `offline` (เรียก `/health` ไม่สำเร็จ เช่นดับ/เน็ตหลุด/ไม่ได้ตั้ง `VITE_API_URL`)

- **ใครเรียกใช้**: `layout/AppShell.tsx`
- **เรียกใช้**: `useHealth` (`api/queries`), `Icon`, type `IconName`

## 2. อธิบายทีละบล็อก

- `STATES: Record<ServerState, { label, icon, color }>` (18–24): ข้อความไทย/ไอคอน/สี ต่อสถานะ (`checking` ใช้ไอคอน spinner สี faint; `degraded` สี accent; `offline` สี danger)
- `ServerStatus()` (26–60):
  - เรียก `useHealth()` ทุกครั้งก่อนเงื่อนไขใดๆ (กฎของ React ห้ามเรียก hook แบบมีเงื่อนไข) ; ในโหมดจำลอง `enabled: false` จึงไม่ยิง request
  - เลือกสถานะตามลำดับ (33–44) : `VITE_USE_MOCK === 'true'` → `mock` **ก่อน** (เพราะ query ที่ปิดไว้ค้าง `pending` ตลอด ถ้าเช็คทีหลังจะขึ้น "กำลังเชื่อมต่อ" ไม่มีวันจบ) → `isPending` → `checking` ; `isError` → `offline` ; `data.status === 'degraded'` → `degraded` ; ไม่เช่นนั้น `ok`
  - วาด `<div role="status" title={health.error?.message}>` (`role="status"` ให้ screen reader อ่านเมื่อสถานะเปลี่ยนโดยไม่ขัดสิ่งที่อ่านอยู่; `title` แสดงสาเหตุจริงของ error เมื่อชี้เมาส์ ช่วยหาบั๊กเช่นลืมตั้ง `VITE_API_URL`) + ไอคอน (หมุนเมื่อ `checking`) + ข้อความ

## 3. การส่งข้อมูล

```
ServerStatus → useHealth() → getHealth() → GET /health → {status:'ok'|'degraded', …} → เลือกสถานะ → ป้าย
```

## 4. จุดที่ควรระวัง

- **ไม่มีการเรียกซ้ำเป็นระยะ**: `useHealth` ตั้งแค่ `staleTime: 30_000` และแอปปิด `refetchOnWindowFocus` ดังนั้นป้ายจะอัปเดตเมื่อ mount เท่านั้น ถ้าเซิร์ฟเวอร์ล่มหลังจากโหลดหน้า ป้ายยังคงเป็น "พร้อมใช้งาน" จนกว่าจะรีเฟรชหรือมีการเรียก query อีกครั้ง (อนุมานจาก `queries.ts` และ `App.tsx`)
- `title` เปิดเผยข้อความ error ภายในให้ผู้ใช้เห็นเมื่อชี้เมาส์ (รวมถึงข้อความที่ระบุชื่อตัวแปร `VITE_API_URL`)
- อ่าน `import.meta.env.VITE_USE_MOCK` ตอน render (ไม่ใช่ระดับโมดูล)

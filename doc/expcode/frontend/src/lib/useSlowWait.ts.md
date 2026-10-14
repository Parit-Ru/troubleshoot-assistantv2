# frontend/src/lib/useSlowWait.ts

## 1. หน้าที่ของไฟล์

React hook `useSlowWait(isWaiting)` บอกว่า "รอเซิร์ฟเวอร์นานเกินไปหรือยัง" ใช้กับหน้าที่ต้องแสดงกล่อง "เซิร์ฟเวอร์กำลังเริ่มทำงาน" (เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า)

- **ใครเรียกใช้**: `pages/SessionPage.tsx`, `pages/SymptomsPage.tsx` (ควบคู่กับ `components/SlowServerNotice.tsx`)
- **เรียกใช้**: `useEffect`, `useState` จาก `react`

## 2. อธิบายทีละบล็อก

| บรรทัด | โค้ด | ความหมาย |
|---|---|---|
| 4 | `SLOW_WAIT_MS = 4000` | รอเกิน 4 วินาทีถือว่าช้า |
| 13 | `export function useSlowWait(isWaiting: boolean): boolean` | รับ "กำลังรออยู่ไหม" คืน "ช้าแล้วหรือยัง" |
| 14 | `useState(false)` | `isSlow` |
| 16–25 | `useEffect` ขึ้นกับ `[isWaiting]` | ถ้ากำลังรอ ตั้ง `setTimeout` 4 วินาทีแล้ว `setIsSlow(true)` ; **cleanup** (ทำงานเมื่อเลิกรอหรือออกจากหน้า) ล้างนาฬิกาที่ยังไม่ครบเวลาและ `setIsSlow(false)` ซ่อนกล่อง |
| 27 | `return isSlow` | |

## 3. การส่งข้อมูล

`isLoading/isPending` จาก React Query → `useSlowWait` → `true` เมื่อรอต่อเนื่องเกิน 4 วินาที → หน้าจอแสดง `SlowServerNotice`

## 4. จุดที่ควรระวัง

- ไฟล์นี้ **ไม่มีเทส** (ตรรกะขึ้นกับเวลา/React)
- เมื่อ `isWaiting` เปลี่ยนจาก true→false ก่อนครบ 4 วินาที นาฬิกาจะถูกล้าง กล่องจึงไม่ปรากฏ ; ถ้า false→true ใหม่ จะเริ่มนับ 4 วินาทีใหม่
- ใน `StrictMode` (dev) effect ถูกรัน/ล้างซ้ำหนึ่งรอบ แต่เพราะ cleanup ล้าง timer ไว้ จึงไม่เกิดกล่องค้าง (อนุมานจากโค้ด)
- การเรียก `setState` ภายใน cleanup (บรรทัด 23) เป็นรูปแบบที่ลินเตอร์ของ React Hooks เวอร์ชันใหม่บางกฎอาจเตือน แต่ใช้งานได้ (อนุมาน)

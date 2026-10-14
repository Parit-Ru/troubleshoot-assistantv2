# frontend/src/api/queries.ts

## 1. หน้าที่ของไฟล์

รวม hook ของ React Query ที่หน้าจอทุกหน้าใช้ — หน้าจอเรียกผ่านไฟล์นี้ ไม่เรียก `traversal.ts` ตรงๆ ไฟล์นี้แยก "อ่านข้อมูล" (`useQuery` ทำงานเองเมื่อหน้าจอแสดง) ออกจาก "เปลี่ยนข้อมูล" (`useMutation` ทำงานเมื่อสั่ง `.mutate()`) และจัดการแคชของ session

- **ใครเรียกใช้**: `components/layout/ServerStatus.tsx` (`useHealth`), `pages/HomePage.tsx`, `pages/SessionPage.tsx`, `pages/SymptomsPage.tsx`
- **เรียกใช้**: `@tanstack/react-query`, `./traversal` (ทุกฟังก์ชัน), type จาก `./types`

## 2. อธิบายทีละบล็อก

### บล็อก A — `queryKeys` (บรรทัด 22–31)
คีย์แคชรวมไว้ที่เดียว : `health`, `graphs`, `session(sessionId)` — ต้องตรงกันทุกตัวอักษรทั้งตอนอ่านและเขียนแคช ถ้าไม่ตรง แคชไม่เชื่อมกันโดยไม่มี error เตือน

### บล็อก B — hook อ่านข้อมูล (บรรทัด 33–73)
- `useHealth()`: `queryFn: getHealth`, `enabled: import.meta.env.VITE_USE_MOCK !== 'true'` (โหมดจำลองไม่เรียก), `staleTime: 30_000`
- `useGraphs()`: `queryFn: listGraphs`, `staleTime: Infinity` (รายการอาการเปลี่ยนเฉพาะตอน seed ไม่เปลี่ยนระหว่างใช้งาน)
- `useSession(sessionId)`: `queryFn: () => getSession(sessionId)` — ปกติไม่ยิงเซิร์ฟเวอร์เพราะ `useStartSession` ใส่แคชไว้แล้ว ยิงจริงเมื่อเปิดลิงก์ตรงหรือกด F5

### บล็อก C — hook เปลี่ยนข้อมูล (บรรทัด 75–161)
- `useSymptomSearch()`: `useMutation<SymptomSearchResponse, Error, string>` — ใช้ mutation เพราะค้นเมื่อผู้ใช้กดค้น และไม่ใส่แคช (ผลขึ้นกับสถานะระบบค้นหา เช่นตอนแรก `SEARCH_NOT_READY`)
- `useStartSession()`: ตัวแปร `{graphId, query?}` ; `onSuccess` ใส่ผลลงแคช `queryKeys.session(sessionId)` ด้วย `setQueryData` หน้าตรวจจึงเปิดพร้อมข้อมูล
- `useSubmitAction(sessionId)`: `onSuccess` เขียน session ใหม่ลงแคชทันที ; **ถ้าเซิร์ฟเวอร์ปฏิเสธ (เช่นด่านความปลอดภัย) `onSuccess` ไม่ทำงาน แคชยังเป็นสถานะเดิม หน้าจอไม่ขยับ** ตรงกับสถานะจริงที่เซิร์ฟเวอร์ (คอมเมนต์ 118–120)
- `useSubmitOutcome(sessionId)`: `onSuccess` เขียน session (มี `outcome`) ลงแคช ฟอร์มจึงเปลี่ยนเป็นอ่านอย่างเดียว ; ถ้าปฏิเสธ ฟอร์มยังอยู่พร้อมข้อความที่พิมพ์
- `useAbandonSession()`: `onSuccess` ลบแคชของ session (`removeQueries`) เพื่อไม่ให้กดย้อนแล้วเห็นขั้นตอนเก่าที่เซิร์ฟเวอร์ลบไปแล้ว

## 3. การส่งข้อมูล

```
หน้าจอ ──useStartSession().mutate({graphId, query})──► traversal.startSession ──► http.request ──► backend
        ◄── onSuccess: queryClient.setQueryData(['session', id], SessionResponse)
หน้าจอ ──useSession(id)── อ่านจากแคช (ไม่ยิงซ้ำ) ── ถ้าแคชว่าง (F5) → getSession(id) → backend
```

## 4. จุดที่ควรระวัง

- **ยังมีการอ้าง `VITE_USE_MOCK` ที่ `useHealth` (บรรทัด 45)** ซึ่งเป็นสวิตช์ของโหมดจำลอง (mock server) — ถ้าตัดโหมดจำลองออกจากโปรเจกต์ ต้องแก้บรรทัดนี้ด้วย
- `useSession` ไม่ตั้ง `staleTime` : แคชถือว่า "เก่า" ทันที ดังนั้นเมื่อมีการ mount ใหม่ของคอมโพเนนต์ที่ใช้ hook นี้ React Query อาจยิง `getSession` อีกรอบ (พฤติกรรมมาตรฐานของ `staleTime: 0`) (อนุมานจากค่าเริ่มต้นของไลบรารี; ไม่ได้ทดลองรันในเบราว์เซอร์)
- `useAbandonSession` ใช้ตัวแปร `sessionId` ใน `mutate()` ต่างจาก hook อื่นที่รับ `sessionId` ตอนสร้าง hook
- ชนิด error ของ mutation ส่วนใหญ่ถูกอนุมานเป็น `Error` ไม่ใช่ `ApiError` — ผู้ใช้ต้องตรวจ `instanceof ApiError` เอง (ดู `lib/errors.ts`)

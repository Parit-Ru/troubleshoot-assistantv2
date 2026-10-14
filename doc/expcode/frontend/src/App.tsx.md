# frontend/src/App.tsx

## 1. หน้าที่ของไฟล์

คอมโพเนนต์รากของแอป ต่อ 3 ชั้นเข้าด้วยกัน : แคชข้อมูล (React Query) → router (HashRouter) → โครงหน้า (`AppShell`) แล้วกำหนดเส้นทาง 4 เส้นไปยังหน้าต่างๆ

- **ใครเรียกใช้**: `frontend/src/main.tsx`
- **เรียกใช้**: `@tanstack/react-query`, `react-router-dom`, `components/layout/AppShell`, `pages/HomePage`, `pages/SymptomsPage`, `pages/SessionPage`, `pages/NotFoundPage`

## 2. อธิบายทีละบล็อก

### บล็อก A — import (บรรทัด 1–7)
### บล็อก B — `queryClient` (บรรทัด 9–25)
สร้าง `QueryClient` **นอก** คอมโพเนนต์ (คอมเมนต์ 12–13: ถ้าสร้างข้างในจะได้แคชใหม่ทุกครั้งที่ App วาดใหม่ ข้อมูลที่โหลดไว้จะหายหมด) ตั้งค่าเริ่มต้นของ query 2 ข้อ:
- `retry: false` — ไม่ลองใหม่เองเมื่อพัง ให้ error ขึ้นทันที (ค่าปกติลอง 3 ครั้ง ถ้าเซิร์ฟเวอร์ดับ ผู้ใช้จะเห็นแต่ตัวหมุนนานหลายวินาที)
- `refetchOnWindowFocus: false` — ไม่โหลดใหม่ทุกครั้งที่สลับแท็บกลับมา เพราะข้อมูลไม่ได้เปลี่ยนเองระหว่างที่ผู้ใช้ไปทำอย่างอื่น

### บล็อก C — `App()` (บรรทัด 27–48)
- ใช้ **`HashRouter`** (URL แบบ `/#/symptoms`) ไม่ใช้ `BrowserRouter` เพราะ GitHub Pages ไม่มีเซิร์ฟเวอร์ที่ตั้งค่าได้ ถ้าเปิด `/symptoms` ตรงๆ หรือกด F5 จะได้ 404 ของ GitHub ; ส่วนหลัง `#` ไม่ถูกส่งไปเซิร์ฟเวอร์ (คอมเมนต์ 28–30)
- เส้นทาง (38–42): `/` → `HomePage`, `/symptoms` → `SymptomsPage`, `/session/:sessionId` → `SessionPage`, `*` → `NotFoundPage`
- ลำดับห่อ: `QueryClientProvider` > `HashRouter` > `AppShell` > `Routes`

## 3. การส่งข้อมูล

```
main.tsx → App → QueryClientProvider (แคชข้อมูล API ใช้ร่วมทุกหน้า)
                    └ HashRouter (อ่าน #/… จาก URL)
                         └ AppShell (หัว/ท้ายหน้า + ServerStatus)
                              └ Routes → หน้าตาม URL
```

## 4. จุดที่ควรระวัง

- `retry: false` ใช้กับทุก query รวมทั้ง `useSession` — การเรียก `getSession` ที่ล้มเพราะเซิร์ฟเวอร์ Render ฟรีกำลังตื่น จะไม่ถูกลองใหม่อัตโนมัติ ผู้ใช้ต้องกดลองใหม่เอง (อนุมานจากโค้ด; มีคอมโพเนนต์แจ้งเซิร์ฟเวอร์ช้า `SlowServerNotice`)
- `/session/:sessionId` : ค่า `sessionId` มาจาก URL ที่ผู้ใช้แก้เองได้ ชั้น API จึงใช้ `encodeURIComponent` (ดู `traversal.ts`)
- ไม่มี Error Boundary ครอบแอป : error ในการวาดคอมโพเนนต์จะทำให้หน้าขาว (อนุมานจากโค้ด)

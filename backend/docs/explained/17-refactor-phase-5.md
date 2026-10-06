# Refactor เฟส 5 — ลบหน้า `/gallery` (`NodeGalleryPage`)

ลบหน้ารวมตัวอย่างสถานะที่ใช้ตอนพัฒนาและถ่ายภาพลงรายงาน (ไม่อยู่ในเมนู เข้าได้จากการพิมพ์ URL เท่านั้น) ออกจากเว็บจริง `SessionPage.tsx`, `DemoPanel` และ `README.md` ไม่ถูกแตะ (ตามที่ตกลง)

## เปลี่ยนอะไร
- **ลบ** `frontend/src/pages/NodeGalleryPage.tsx` (65 บรรทัด)
- **แก้** `frontend/src/App.tsx`: ลบ `import` และ `<Route path="/gallery" ...>` อย่างละ 1 บรรทัด ผู้ที่พิมพ์ `#/gallery` จะตกไป route `*` เดิม คือหน้า "ไม่พบหน้านี้"
- **แก้เฉพาะคอมเมนต์** ใน 3 ไฟล์ที่พูดถึง gallery: `components/layout/AppShell.tsx`, `components/step/stepProps.ts`, `mocks/fixtures.ts` (2 บรรทัด) ตรวจด้วยการเทียบ AST กับ `HEAD` แล้วโค้ดและข้อมูลในสามไฟล์นี้เหมือนเดิมทุกตัวอักษร
- **เอกสารเก่า** (`03`, `04`, `06`, `08` ใน `frontend/docs/explained/`): เติมหมายเหตุ "(หน้านี้ถูกลบในการ refactor เฟส 5)" ตรงจุดที่อ้างถึง 13 จุด ไม่เขียนทับประวัติ · `10-session-outcome-ui.md`: แก้ประโยคตรงๆ เพราะเป็นเอกสารของฟีเจอร์ที่ยังใช้งานอยู่ (ตอนนี้ `StepView` ถูกเรียกจากหน้าตรวจอาการหน้าเดียว)
- `README.md` ไม่มีการอ้างถึง gallery จึงไม่ต้องแก้

## ตรวจอย่างไร
- `tsc -b`, `eslint`, `vite build` ผ่าน · bundle ไม่มี "NodeGallery" หรือข้อความของหน้านั้น
- vitest 8 ไฟล์ **84/84** เท่าเดิม (ไม่มี test อ้าง gallery) ไฟล์ test ไม่ถูกแตะ (hash ตรง)
- **เปิด `#/gallery` ด้วย Chrome:** ขึ้นหัวข้อ "ไม่พบหน้านี้" และไม่มีเนื้อหาของ gallery, `#/gallery/อะไรก็ได้` ก็ขึ้นหน้าเดียวกัน, เมนูยังมี "หน้าแรก" และ "เลือกอาการ", หน้า `#/symptoms` ยังเปิดได้, ไม่มี error ในคอนโซล
- **หน้าอื่นเหมือนเดิม:** เก็บ HTML ของ 21 สถานะ (หน้าตรวจอาการ 16 + หน้าเลือกอาการ 5) เทียบกับชุดอ้างอิงก่อน refactor เฟส 4 ได้เหมือนกันทุกตัวอักษร 21/21 · ตัวตรวจ Chrome เดิม 63/63

## ข้อที่ต้องรู้
- ภาพหน้าจอจาก gallery ที่เคยตั้งใจใช้ในรายงานจะถ่ายใหม่จากหน้านี้ไม่ได้อีก ถ้าต้องการภาพกล่องขั้นตอนทั้ง 8 แบบ ต้องถ่ายจากหน้าตรวจอาการจริง (หรือ checkout commit เก่า) ผมไม่ได้ตรวจว่าคุณมีภาพเหล่านั้นเก็บไว้แล้วหรือยัง
- ไม่ได้ตรวจบนเว็บที่ deploy จริง (เว็บจริงจะยังมี `/gallery` จนกว่าจะ deploy ใหม่)

## หัวข้อไว้พิจารณาในเฟส 6 (ยังไม่ได้ลบ)
ข้อมูลตัวอย่างใน `frontend/src/mocks/fixtures.ts` (ไฟล์ที่ตั้งใจคงไว้) ที่หลังลบ gallery **ไม่มีผู้ใช้ในโค้ดหรือเทสเลย**:
- `allFixtureNodes` (เดิมใช้แค่ใน gallery)
- `userFixedNode`, `normalBehaviorNode`, `handoffInformedNode`, `handoffUnknownNode` (อ้างถึงเฉพาะใน `allFixtureNodes`)

ที่ยังมีผู้ใช้: `checkpointNode`, `safetyGateNode` (`HomePage` และ `trail.test.ts`), `instructionNode`, `inputNode` (`trail.test.ts`) คอมเมนต์ใน `fixtures.ts` ตอนนี้ระบุแล้วว่า `allFixtureNodes` "ตอนนี้ยังไม่มีหน้าไหนใช้"

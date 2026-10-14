# frontend/src/lib/trail.ts

## 1. หน้าที่ของไฟล์

แปลง "สถานะที่เพิ่งผ่าน + action ที่ผู้ใช้ส่ง" เป็นรายการ (`TrailEntry`) บนเส้นทางทางซ้ายของหน้าตรวจอาการ (PathRail) ข้อมูลนี้ **หน้าจอบันทึกเอง ไม่ได้มาจากเซิร์ฟเวอร์** ใช้แสดงผลอย่างเดียว ไม่ได้ใช้ตัดสินใจ — ขั้นถัดไปเป็นหน้าที่ของเครื่องสถานะฝั่งเซิร์ฟเวอร์ ผลที่ตามมา: กด F5 แล้วรายการหายหมด เหลือแต่ขั้นปัจจุบัน (ยอมรับโดยตั้งใจ)

- **ใครเรียกใช้**: `components/step/PathRail.tsx` (type), `pages/HomePage.tsx`, `pages/SessionPage.tsx`, `trail.test.ts`
- **เรียกใช้**: type `RenderedNode`, `TraversalAction` จาก `../api/types`

## 2. อธิบายทีละบล็อก

- `type TrailMarker = 'dot' | 'switch-off'` (19): สัญลักษณ์หน้ารายการ — `dot` ขั้นทั่วไป, `switch-off` ขั้นที่ยืนยันคำเตือนความปลอดภัยแล้ว
- `interface TrailEntry { nodeId, text, answerLabel, marker }` (21–28)
- `toTrailEntry(node, action)` (37–59): `node` คือสถานะ "ก่อน" ส่ง action ; `switch (action.type)` ครบ 4 แบบ จึงไม่มี `default` (ถ้า engine เพิ่ม action ใหม่ TypeScript จะแจ้งว่าคืนค่าไม่ครบ):
  - `answer` → "ตอบ ใช่" / "ตอบ ไม่ใช่", `dot`
  - `continue` → "ไปต่อแล้ว", `dot`
  - `confirm_safety` → "ยืนยันคำเตือนแล้ว", `switch-off`
  - `input` → `` `กรอก ${action.value}` ``, `dot` (แสดงตามที่พิมพ์ ไม่แปลง/ไม่ตรวจ)

## 3. การส่งข้อมูล

`SessionPage` เก็บ `node` ก่อนส่ง + `action` ที่ส่งสำเร็จ → `toTrailEntry` → เพิ่มใน state ของ trail → `PathRail` วาดรายการ

## 4. จุดที่ควรระวัง

- เส้นทางไม่ถูกเก็บถาวร (หายเมื่อ F5 หรือเปิดลิงก์ session ตรง) แม้ DB เก็บ `session_history` ไว้ (ตรงกับที่ API ไม่เปิดให้อ่านประวัติ)
- ข้อความ `text` ของโหนดถูกคัดลอกเก็บไว้ตอนผ่าน (ใช้ข้อความที่แทนตัวแปรแล้ว ณ เวลานั้น)

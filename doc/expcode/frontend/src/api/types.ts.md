# frontend/src/api/types.ts

## 1. หน้าที่ของไฟล์

"สัญญาของข้อมูล" ระหว่างหน้าจอกับเซิร์ฟเวอร์ แบ่งเป็น 3 กลุ่ม (คอมเมนต์ 4–8): (1) type ที่ re-export จาก engine ของ backend โดยตรง จึงตรงกับเซิร์ฟเวอร์แน่นอน (2) type ที่ลอกมาจาก backend ต้องแก้ตามถ้าฝั่งนั้นเปลี่ยน (3) type ที่เสนอเอง (รูปร่างเทียบกับ response จริงแล้ว) ไฟล์อื่นของ frontend ห้าม import จาก backend โดยตรง ให้ผ่านไฟล์นี้จุดเดียว

- **ใครเรียกใช้**: เกือบทุกไฟล์ใน `frontend/src` (api, lib, components, pages, mocks)
- **เรียกใช้**: `../../../backend/src/traversal-engine/types` (เฉพาะแบบ `export type` / `import type` จึงไม่ติดโค้ด backend เข้ามาตอน build)

## 2. อธิบายทีละบล็อก

### บล็อก A — re-export จาก engine (บรรทัด 10–47)
- `export type { NodeType, InputType, OutcomeKind, DeviceCategory, Severity, Difficulty, SessionStatus, TraversalAction, NodeReference, RenderedNode } from '…/traversal-engine/types'` (22–33)
- `import type { DeviceCategory, Severity, Difficulty, SessionStatus, RenderedNode }` (41–47) : คอมเมนต์ 36–40 อธิบายว่าสองบรรทัดนี้คนละหน้าที่ (`export type` ส่งชื่อต่อไปให้ไฟล์อื่น, `import type` เอาชื่อมาใช้ในไฟล์นี้เอง ชื่อที่ใช้เองด้วยต้องอยู่ทั้งสองที่)

### บล็อก B — ลอกมาจาก backend (บรรทัด 49–104)
- `GraphSummary` (60–71): ลอกจาก `graph.repository.ts` (ไม่ import ตรงเพราะไฟล์นั้น import NestJS)
- `SymptomMatch` (80–92) และ `SymptomSearchResponse` (95–104): ลอกจาก `symptom-search.dto.ts` (ไม่ import ตรงเพราะมีโค้ดทำงานปนอยู่) ; `score` = cosine ปัด 3 ตำแหน่ง ไม่ใช่ความน่าจะเป็น

### บล็อก C — ชนิดที่เสนอเอง (บรรทัด 106–167)
- `SessionResponse` (116–137): `sessionId`, `graphId`, `status`, `node: RenderedNode`, `equipment?`, `confidence?: number | null`, `outcome?: string | null`
- `EquipmentItem` (147–155): `equipmentId`, `nameTh`, `purposeTh`, `sourcePage?`, `authorNote?` (ต้องมีอย่างน้อยหนึ่งอย่างเสมอเพื่อบอกที่มา)
- `ApiErrorBody` (162–167): `statusCode`, `code?`, `message?` — หน้าจอใช้ `code` เลือกข้อความ ไม่ใช้ `message`

## 3. การส่งข้อมูล

type เหล่านี้ไม่มีโค้ดทำงาน (หายไปตอน build) แต่กำหนดรูปร่าง JSON ที่ `http.request<T>()` คืนและที่คอมโพเนนต์รับ :
`backend (SessionResponseDto) ──JSON──► frontend (SessionResponse) ──► props ของคอมโพเนนต์`

## 4. จุดที่ควรระวัง

- **ชนิดที่ลอกมาอาจเพี้ยนจาก backend ได้**: `GraphSummary`, `SymptomMatch`, `SymptomSearchResponse`, `EquipmentItem` เขียนซ้ำด้วยมือ ไม่มีกลไกอัตโนมัติตรวจว่าตรงกัน
- **`equipment`, `confidence`, `outcome` เป็น optional ฝั่ง frontend** ขณะที่ backend ส่งเสมอ (`equipment` เป็น array, `confidence`/`outcome` เป็น `null` ถ้าไม่มี) — รับค่าได้โดยไม่ขัดกัน (คอมเมนต์ใน `traversal.dto.ts` ระบุไว้)
- การ import ข้ามโฟลเดอร์ (`../../../backend/...`) พึ่งโครงสร้างโฟลเดอร์ปัจจุบัน และ `tsc -b` ต้องอ่านไฟล์ backend ด้วย ; ไฟล์ปลายทางต้องไม่ import อะไรเลย (ตรงตามที่ `types.ts` ของ engine ออกแบบไว้)
- `ApiErrorBody` ฝั่งนี้ทำให้ `code?` และ `message?` optional ขณะที่ backend ส่งครบทุกฟิลด์ เพราะต้องรองรับ body ที่ไม่ใช่รูปแบบนี้ (เช่น หน้า HTML)

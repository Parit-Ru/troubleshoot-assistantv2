# backend/src/traversal-engine/traversal-engine.confidence.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ที่ยืนยันว่า engine "เก็บ" `confidence` ของ session ไว้ แต่ "ไม่เคยใช้" มันตัดสินใจ (ขั้น 1.8) แยกเป็นไฟล์ใหม่เพื่อไม่แตะ `traversal-engine.spec.ts` ที่ใหญ่และเสถียรอยู่แล้ว (คอมเมนต์ 4–5)

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `startSession`, `submitAction` จาก `./traversal-engine`, type `ManualFile` จาก `./types` และไฟล์ข้อมูลจริง `data/manuals/samsung_ac_ar70h.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — เตรียมข้อมูล (บรรทัด 8–17)
อ่านไฟล์คู่มือแอร์จริงด้วย `fs.readFileSync(path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json'))` แล้ว `JSON.parse` เป็น `ManualFile` หยิบกราฟ `graph_id === 'samsung_ac_ar70h_stops_working'` (ใช้ `!` ยืนยันว่ามี)

### บล็อก B — `describe('engine — confidence ของ session')` (บรรทัด 19–41) — 4 เทส
| บรรทัด | สิ่งที่ยืนยัน |
|---|---|
| 20 | ไม่ระบุ → `session.confidence` เป็น `null` (ไม่ใช่ `undefined` ไม่ใช่ 0) |
| 24 | ระบุ 0.812 → เก็บตามนั้น |
| 28 | `submitAction` คงค่า `confidence` เดิมไว้ ไม่แก้ |
| 34 | `confidence` ไม่มีผลต่อเส้นทาง: ค่า `null`, `0`, `1` ตอบ `no` แล้วได้ `nodeId` ถัดไปเหมือนกัน (ชุด `nodeIds` มีขนาด 1) |

## 3. การส่งข้อมูล

```
data/manuals/samsung_ac_ar70h.json ─fs─► graph ─► startSession(graph, c) ─► session.confidence
                                                  └► submitAction(session, graph, {type:'answer',value:'no'}) ─► node.nodeId
```
เป็น function call ในโปรเซสเดียวกัน

## 4. จุดที่ควรระวัง

- เทสผูกกับ `graph_id` `samsung_ac_ar70h_stops_working` และต้องมีโหนดเริ่มต้นเป็น checkpoint ที่รับ `yes`/`no` — ถ้าเปลี่ยนข้อมูลกราฟนั้น เทสอาจล้ม
- เทสที่ 34 ยืนยันเชิงพฤติกรรมว่า `confidence` ไม่ส่งผลต่อการเดิน ซึ่งเป็นข้อกำหนดด้านความปลอดภัยของระบบ (ค่านี้แสดงผลอย่างเดียว ตาม `types.ts` บรรทัด 177–179)

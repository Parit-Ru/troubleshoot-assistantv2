# backend/src/traversal-engine/path-coverage.spec.ts

## 1. หน้าที่ของไฟล์

ไฟล์ทดสอบ (Jest) ที่ "เดินทุกเส้นทาง" ของกราฟอ้างอิงจริงทั้ง 13 กราฟใน `data/manuals/samsung_ac_ar70h.json` ต่างจาก `traversal-engine.spec.ts` (ที่เทส "กฎของ engine" ด้วยกราฟจำลอง) ตรงที่ไฟล์นี้เทส "ข้อมูลจริงเดินได้จริง": ไม่มีทางตัน ไม่มีลูปไม่จบ ไม่มีโหนดกำพร้า และด่านความปลอดภัยทุกจุดทำงาน

**นิยาม "1 เส้นทาง"** (คอมเมนต์ 11–24): ลำดับ action จาก `entry_node` จนถึงโหนดจบ โดยห้ามใช้คู่ `(node_id, action)` เดิมซ้ำภายในเส้นทางเดียวกัน (เพราะกราฟมีลูปโดยตั้งใจ เช่น `n_fix_power → n_recheck_power → n1`) กิ่งที่ถูกตัดเพราะวนซ้ำไม่นับเป็นเส้นทาง ผลตามนิยามนี้ = **106 เส้นทาง** (ตัวจำลอง Python `simulate_paths.py` รายงาน 104 เพราะไม่ได้เดินกิ่งกรอกค่าผิด; ตัวเลขอ้างอิงคือ 106 เพราะมาจาก engine ตัวที่ใช้งานจริง)

- **ใครเรียกใช้**: Jest
- **เรียกใช้**: `startSession`, `submitAction` จาก `./traversal-engine`; type และ `SafetyConfirmationRequiredError` จาก `./types`; ไฟล์ `data/manuals/samsung_ac_ar70h.json`

## 2. อธิบายทีละบล็อก

### บล็อก A — โหลดกราฟและค่าที่คาดไว้ (บรรทัด 41–60)
- `MANUAL_PATH = path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json')`; `manual` / `graphs`
- ค่าที่คาดไว้ (53–56): `EXPECTED_GRAPH_COUNT = 13`, `EXPECTED_NODE_COUNT = 95`, `EXPECTED_PATH_COUNT = 106` (คอมเมนต์ 53: ถ้าแก้กราฟแล้วเลขเปลี่ยน เทสจะแดงเพื่อเตือนให้แก้เอกสารตาม)
- `VALID_INPUT = 'E1'`, `INVALID_INPUT = '###'` (59–60)

### บล็อก B — ตัวเดินกราฟ (บรรทัด 62–137)
- `validActionsFor(node)` (67–92): action ที่ "ถูกต้อง" ตามชนิดโหนด — checkpoint: yes/no; instruction: `confirm_safety` ถ้า `safety_critical` ไม่งั้น `continue`; input: `E1` ผ่าน และถ้ามี `pattern` เพิ่ม `###` เป็นกิ่งผิด; โหนดจบ: ไม่มี
- `WalkResult { paths, visited, loopsPruned }` (94–101)
- `walkAllPaths(graph)` (103–137): เดินแบบ DFS (recursion) เรียก `submitAction` ของ engine จริง เก็บ `edgeKey = nodeId|JSON(action)` ใน `usedEdges` ของเส้นทางนั้น ถ้าเจอซ้ำให้ข้ามและนับ `loopsPruned`; ถึงโหนดจบนับเป็น 1 เส้นทาง; โยน Error ถ้าโหนดที่ render ไม่มีในกราฟ

### บล็อก C — 1) ความสมบูรณ์ของไฟล์กราฟ (บรรทัด 143–181) — 6 เทส
13 กราฟ ตรง `manual.count` · 95 โหนดรวม · ทุกกราฟ `schema_version = 2` · ทุกกราฟมี `source` และ `page_range` ยาว 2 · `graph_id` ไม่ซ้ำ · `node_id` ไม่ซ้ำภายในกราฟเดียว

### บล็อก D — 2) เดินได้ทุกกราฟ (บรรทัด 187–208) — `it.each` 13 กราฟ × 2
`'%s เดินจบทุกเส้นทางโดยไม่มี error'` (paths > 0) และ `'%s ไม่มีโหนดกำพร้า'` (ทุกโหนดอยู่ใน `visited`)

### บล็อก E — 3) จำนวนเส้นทางรวม (บรรทัด 214–226) — 2 เทส
รวมทุกกราฟต้องได้ 106 เส้นทาง · ไม่มีกราฟไหนเดินแล้วไปไม่ถึงโหนดจบเลย

### บล็อก F — 4) 🔴 ด่านความปลอดภัยบนข้อมูลจริง (บรรทัด 232–301)
รวมโหนด `safety_critical === true` ทั้งหมดเป็น `safetyNodes` แล้ว:
- 240: มีโหนด safety_critical อยู่จริง
- 244: อยู่บน `instruction` เท่านั้น (ถ้าใครตั้งบน checkpoint เทสจะจับได้)
- 253: ทุกโหนดมี `safety_warning` ที่ไม่ว่าง (บทเรียนจาก demo: กล่องเตือนสีแดงไม่มีข้อความ)
- 262 (`it.each` ต่อโหนด): สร้าง `SessionState` ที่ยืนที่โหนดนั้น ส่ง `continue` → ต้องโยน `SafetyConfirmationRequiredError` และ session เดิมไม่ถูกแก้
- 284 (`it.each` ต่อโหนด): ส่ง `confirm_safety` → ผ่านไปโหนดอื่น

### บล็อก G — 5) โหนดจบในข้อมูลจริง (บรรทัด 307–328) — 2 เทส
ทุกโหนดจบมี `outcome_kind` · ค่าอยู่ใน 4 แบบที่กำหนด (`user_fixed`, `normal_behavior`, `handoff_informed`, `handoff_unknown`)

## 3. การส่งข้อมูล

```
data/manuals/samsung_ac_ar70h.json ──fs.readFileSync──► graphs (13 กราฟ / 95 โหนด)
        └► walkAllPaths ► submitAction (engine จริง) ► นับเส้นทาง / โหนดที่ถึง / ลูปที่ตัด
```

## 4. จุดที่ควรระวัง

- **ตัวเลขฝังตายตัว** (13/95/106): แก้ข้อมูลกราฟเมื่อไรเทสแดงโดยตั้งใจ — ต้องอัปเดตเลขในไฟล์นี้และเอกสารอ้างอิงด้วย
- **ความซับซ้อน**: `walkAllPaths` ไล่ทุกเส้นทางและคัดลอก `Set` ในทุกก้าว (`new Set([...usedEdges, edgeKey])`) เหมาะกับกราฟขนาดนี้ แต่จะโตแบบเอ็กซ์โพเนนเชียลถ้ากราฟแตกกิ่งมาก (อนุมานจากโค้ด)
- **`loopsPruned` ถูกนับแต่ไม่ถูก assert** ที่ใดในไฟล์นี้ (ตัวแปรเก็บไว้เพื่อประกอบผล ไม่ได้ใช้ตรวจ)
- กิ่ง `INVALID_INPUT` ถูกเดินเฉพาะโหนดที่มี `pattern`; โหนด input ที่ไม่มี pattern จะไม่ได้ทดสอบกิ่งผิด
- เส้นทางอ้างอิง 106 ต่างจาก Python (104) ตามคอมเมนต์ — ตัวเลขสองชุดนี้ไม่ควรเอามาปนกันเมื่ออ้างในเอกสาร

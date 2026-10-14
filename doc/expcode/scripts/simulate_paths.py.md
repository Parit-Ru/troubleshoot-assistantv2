# scripts/simulate_paths.py

## 1. หน้าที่ของไฟล์

ตัวจำลองการเดินกราฟ: ไล่ทุกเส้นทางที่เป็นไปได้ของแต่ละกราฟ แล้วรายงานจำนวนเส้นทาง, ผลลัพธ์ (resolution/escalation), จำนวนคำถามที่ถามก่อนได้คำตอบ และ "กลิ่นความหมาย" (semantic smells) ที่ตัวตรวจ schema จับไม่ได้ เช่น กราฟยอมแพ้เร็วเกินไป หรือโหนดความปลอดภัยถูกเลี่ยงได้

- **ใครเรียกใช้**: คนรัน `python scripts/simulate_paths.py --all [-v]` หรือ `python scripts/simulate_paths.py data/manuals/<ชื่อ>.json [-v]`
- **เรียกใช้**: `json`, `sys`, `pathlib` เท่านั้น ; อ่าน `data/manuals/*.json`
- (ตัวจำลองนี้ทำงานฝั่ง Python แยกจาก engine TypeScript ; ตัวเลขเส้นทางของ engine ดู `path-coverage.spec.ts`)

## 2. อธิบายทีละบล็อก

### บล็อก A — docstring และค่าคงที่ (บรรทัด 1–21)
docstring (บรรทัด 12) บอกวิธีใช้แบบ `--all <graphs_directory>` แต่โค้ดจริง `--all` อ่านจาก `data/manuals` เสมอ (ไม่รับ directory) ; `MAX_PATH_LENGTH = 40` กันลูปวิ่งไม่หยุด

### บล็อก B — `enumerate_paths(graph, max_paths=500)` (บรรทัด 24–75)
เดิน (DFS) จาก `entry_node` ไปทุกโหนดจบ ; แต่ละเส้นทางเก็บ `trail`, `answers`, `outcome`, `terminal_node`, `questions_asked` (จำนวน checkpoint), `safety_nodes_hit` ; **ลูปถูกเดินได้ไม่เกินหนึ่งครั้งต่อเส้นทาง** โดยนับคีย์ `(node_id, edge, target)` ใน `edge_counts` ; รองรับเฉพาะโหนด `resolution/escalation` (บันทึกเส้นทาง), `instruction` (ไป `next`) และ `checkpoint` (yes/no) — **ไม่มีการจัดการโหนด `input`** (ถ้าเดินไปถึงโหนด input ฟังก์ชันจบโดยไม่บันทึกเส้นทาง)

### บล็อก C — `analyze(graph)` (บรรทัด 78–164) — 7 smell
1. escalation เกิน 75% ของเส้นทาง
2. ไม่มีเส้นทางไป resolution เลย
3. เส้นทางที่ยาวที่สุดถามเกิน 6 คำถาม
4. escalation ทั้งหมดเกิดหลังถามคำถามไม่เกิน 1 ข้อ และไม่มี resolution
5. resolution เดียวกันเข้าถึงได้ทั้งแบบมีและไม่มีโหนดความปลอดภัย (ควรตรวจว่าตั้งใจ)
6. resolution ไม่มี `outcome_kind`
7. escalation ที่ `confidence == "high"`
คืน `dict` สรุป (`total_paths`, `resolutions`, `escalations`, `max/min_questions`, `node_count`, `safety_nodes`, `findings`, `paths`)

### บล็อก D — `print_report` และ `main` (บรรทัด 167–248)
พิมพ์รายงานต่อกราฟ (`-v` แสดงทุกเส้นทาง) แล้วสรุปรวม (จำนวนกราฟ, เส้นทางรวม, finding รวม, เฉลี่ยต่อกราฟ, กราฟที่มี finding)

## 3. การส่งข้อมูล

```
data/manuals/*.json ──json.loads──► analyze (enumerate_paths) ──► stdout (รายงาน + AGGREGATE)
```

## 4. ผลที่ทดลองรันจริง (อ่านอย่างเดียว)

- กราฟแอร์: `python scripts/simulate_paths.py data/manuals/samsung_ac_ar70h.json` → 13 กราฟ, **104 เส้นทาง**, 5 findings (ตรงกับคอมเมนต์ใน `path-coverage.spec.ts` ที่ว่า Python รายงาน 104 เทียบกับ engine 106)
- `--all` (ทั้งแอร์และเครื่องซักผ้า): 42 กราฟ, 254 เส้นทาง, 10 findings, 7 กราฟมี finding

## 5. จุดที่ควรระวัง

- **ไม่เดินโหนด input** จึงนับเส้นทางที่ผ่านโหนด input ต่ำกว่าจริง และต่างจาก engine (104 กับ 106) ; ตัวเลขที่ใช้อ้างอิงคือ 106 จาก engine (คอมเมนต์ใน `path-coverage.spec.ts`)
- **smell 7 อ้างฟิลด์ `confidence` บนโหนด** ซึ่งไม่อยู่ในชนิดข้อมูลของโหนดใน `types.ts` (ตอนนี้ `confidence` เป็นของ session) — เป็นร่องรอยของโครงสร้างข้อมูลรุ่นก่อน ผลคือเงื่อนไขนี้แทบไม่เคยเกิด และ `-v` จะพิมพ์ `(None)` ต่อท้าย outcome (อนุมานจากโค้ด)
- `KeyError` ถ้าโหนด checkpoint ไม่มี `on_yes`/`on_no` หรือ instruction ไม่มี `next` (ใช้ `node[edge]` ตรงๆ) — ควรรัน `validate_graph.py` ก่อน
- ข้อความ smell เป็นภาษาอังกฤษ ; `max_paths=500` ตัดกิ่งเมื่อเส้นทางเกิน (ไม่แจ้งเตือนว่าถูกตัด)

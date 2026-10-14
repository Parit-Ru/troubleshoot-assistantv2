# scripts/build_index.py

## 1. หน้าที่ของไฟล์

สร้าง "ดัชนี" ของกราฟแก้ปัญหาทั้งหมด: อ่านทุกไฟล์คู่มือใน `data/manuals/*.json` แล้วสรุปเป็นตารางเดียว 2 รูปแบบ — `data/index.json` (ให้โปรแกรมอ่าน) และ `data/INDEX.md` (ให้คนอ่าน) เพื่อเห็นภาพรวมโดยไม่ต้องเปิดทีละไฟล์

- **ใครเรียกใช้**: คนรัน `python scripts/build_index.py` (ไม่มีไฟล์โค้ดอื่นเรียก)
- **เรียกใช้**: `json`, `pathlib` เท่านั้น ; อ่าน `data/manuals/*.json`
- **เขียนไฟล์**: `data/index.json`, `data/INDEX.md`

## 2. อธิบายทีละบล็อก

### บล็อก A — docstring และค่าคงที่ (บรรทัด 1–17)
docstring (บรรทัด 4) ระบุว่า "อ่านทุกไฟล์ใน `data/graphs/`" แต่ตัวแปรจริงชี้ไป `data/manuals` (บรรทัด 15) — docstring ล้าสมัย ; `REPO_ROOT = Path(__file__).parent.parent`

### บล็อก B — `count_node_types(nodes)` (บรรทัด 20–26)
นับจำนวนโหนดแต่ละ `type` คืน `dict[str, int]`

### บล็อก C — `summarize(graph, manual_id)` (บรรทัด 29–52)
ดึงข้อมูลสำคัญของกราฟหนึ่งอัน: `manual_id`, `graph_id`, `entry_symptom(_th)`, `device_category`, `brand`, `model_pattern`, `source`, `page_range`, `severity`, `difficulty`, `node_count`, `node_types`, `safety_nodes` (นับโหนดที่ `safety_critical`), `config_keys` (ชื่อคีย์ของ `config`)

### บล็อก D — `build_markdown(entries, manuals)` (บรรทัด 55–121)
ประกอบ Markdown เป็นตาราง: คู่มือที่มี, รายการ graph ทั้งหมด (เรียงจากโหนดน้อยไปมาก เพื่อให้อันที่เข้าใจง่ายอยู่บนสุด — คอมเมนต์ 80; ตัดคำนำหน้า `samsung_ac_ar70h_` ออกจากชื่อให้ตารางอ่านง่าย — บรรทัด 84), สรุป (จำนวน graph/node/safety gate), แยกตามประเภทโหนด

### บล็อก E — `main()` (บรรทัด 124–157)
1. ถ้าไม่มีโฟลเดอร์ `data/manuals` พิมพ์ข้อความแล้วออก
2. วนไฟล์ `*.json` (เรียงชื่อ) อ่านด้วย `json.loads` สร้างรายการ `manuals` (`graph_count = len(graphs)`) และ `entries` จาก `summarize`
3. เขียน `data/index.json` ด้วย `json.dumps(..., indent=2, ensure_ascii=False)` (146–150) และ `data/INDEX.md` (153)
4. พิมพ์จำนวนกราฟและ path ไฟล์ที่สร้าง

## 3. การส่งข้อมูล

```
data/manuals/*.json ──json.loads──► summarize ──► entries/manuals
                                        ├─► data/index.json   (ข้อมูลสำหรับโปรแกรม)
                                        └─► data/INDEX.md     (ตารางสำหรับคน)
```
ไฟล์ผลลัพธ์ทั้งสองเป็นข้อมูลที่ถูกสร้างอัตโนมัติ (ใน `INDEX.md` มีข้อความ "อย่าแก้ด้วยมือ เพราะจะถูกเขียนทับ")

## 4. จุดที่ควรระวัง

- **docstring ล้าสมัย** (`data/graphs/` vs `data/manuals`) ดังกล่าวข้างบน
- **ผูกกับชื่อคู่มือแอร์**: การตัดคำนำหน้า `samsung_ac_ar70h_` (บรรทัด 84) ใช้ได้กับกราฟแอร์เท่านั้น กราฟอื่น (เช่น `oid84209_*`) จะแสดง graph_id เต็ม
- **ไม่ตรวจความถูกต้องของข้อมูล** — กราฟที่ไม่ผ่านตัวตรวจ (เช่นไฟล์เครื่องซักผ้าร่าง) ก็ถูกนับในดัชนีด้วย
- สคริปต์ **เขียนทับ** `data/index.json` และ `data/INDEX.md` ทุกครั้งที่รัน
- ผลดัชนีรวมคู่มือทุกเล่มใน `data/manuals/` — เมื่อดู `data/index.json` จะเห็นจำนวนกราฟของคู่มือที่มีจริง

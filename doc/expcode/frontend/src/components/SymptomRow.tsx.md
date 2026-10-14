# frontend/src/components/SymptomRow.tsx

## 1. หน้าที่ของไฟล์

แถวอาการหนึ่งแถว (เป็นปุ่มทั้งแถว) ใช้ทั้งในรายการอาการและในผลค้นหา แสดงชื่อไทย/ชื่ออังกฤษ (ตรงกับหัวข้อในคู่มือ), และถ้ามาจากผลค้นหา แสดง "คะแนนความคล้าย" กับข้อความที่ใกล้เคียง ไม่เรียก API — แจ้งออกผ่าน `onSelect(graphId)` ให้ `SymptomsPage` ตัดสินใจเริ่ม session

- **ใครเรียกใช้**: `components/SymptomSearchResults.tsx`, `pages/SymptomsPage.tsx`
- **เรียกใช้**: `formatScore`, `symptomName`, `Icon`, type `GraphSummary`

## 2. อธิบายทีละบล็อก

- props (12–24): `summary: Pick<GraphSummary,'graphId'|'entrySymptom'|'entrySymptomTh'>` (รับได้ทั้ง `GraphSummary` และ `SymptomMatch`), `isStarting`, `disabled`, `onSelect`, `score?`, `matchedText?`
- 3 สภาพของแถว (คอมเมนต์ 26–31): ปกติ (กดได้, hover พื้น panel) ; `isStarting` (แถวที่ถูกกด `cursor-wait` ไม่จาง เห็นชัดว่ากำลังทำงาน) ; `disabled` (แถวอื่นระหว่างรอ จางลง `opacity-40` กดไม่ได้)
- `stateClasses` (46–51) : isStarting มาก่อน disabled เผื่อส่ง true มาทั้งคู่
- วาด (53–87): `<li>` > `<button type="button" disabled={isStarting || disabled} aria-busy>` ; ชื่อไทย (ตัวหนา), ชื่ออังกฤษ (หัวข้อเดียวกับคู่มือ), ถ้ามี `score` บรรทัด "คะแนนความคล้าย 0.812 · ใกล้กับ “…”" ; ท้ายแถว: ตัวหมุน+"กำลังเริ่ม" เมื่อ `isStarting` ไม่เช่นนั้นลูกศร `chevron-right`

## 3. การส่งข้อมูล

คลิก → `onSelect(summary.graphId)` → `SymptomsPage` → `useStartSession().mutate({graphId, query?})`

## 4. จุดที่ควรระวัง

- ปิดทั้งแถวที่กำลังเริ่มและแถวอื่น เพื่อกันกดซ้ำจนได้ session สองอัน
- `score`/`matchedText` เป็นข้อมูลประกอบ ไม่ใช่ความน่าจะเป็น (ใช้คำ "คะแนนความคล้าย")

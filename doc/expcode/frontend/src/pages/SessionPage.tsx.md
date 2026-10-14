# frontend/src/pages/SessionPage.tsx

## 1. หน้าที่ของไฟล์

หน้าตรวจอาการ (route `/session/:sessionId`) : ประกอบชิ้นส่วนเข้าด้วยกัน **ไม่ตัดสินใจอะไรเอง** — สถานะปัจจุบันมาจากเซิร์ฟเวอร์ (`useSession`) ; ขั้นถัดไปเซิร์ฟเวอร์เลือก หน้าจอแค่ส่ง action (`useSubmitAction`) ; เส้นทางที่ผ่านมาหน้าจอบันทึกเองใช้แสดงผลอย่างเดียว ; ผลลัพธ์ที่ผู้ใช้กรอกตอนจบส่งไปเก็บที่เซิร์ฟเวอร์ (`useSubmitOutcome`) เป็นข้อมูลบันทึกอย่างเดียว ไม่ผ่าน `handleAction` และไม่เปลี่ยนขั้นตอน
สิ่งที่ห้ามทำในหน้านี้ (คอมเมนต์ 35–39): คำนวณเองว่าขั้นถัดไปคืออะไร, มีปุ่มย้อนกลับ (เครื่องสถานะไม่มีคำสั่งย้อน), ใส่ `nodeId` ใน URL, ตรวจรูปแบบรหัสที่กรอก

- **ใครเรียกใช้**: `App.tsx` (route `/session/:sessionId`)
- **เรียกใช้**: hooks ทุกตัวใน `api/queries` (`useSession`, `useGraphs`, `useSubmitAction`, `useSubmitOutcome`, `useAbandonSession`, `useStartSession`), `EquipmentPanel`, `OutcomeForm`, `SessionErrorNotice`, `SessionHeader`, `SlowServerNotice`, `PathRail`, `StepView`, `TerminalActions`, `Icon`, `toTrailEntry`, `useSlowWait`, `useNavigate`/`useParams`

## 2. อธิบายทีละบล็อก

### บล็อก A — ชั้นนอก `SessionPage` (บรรทัด 42–53)
อ่าน `sessionId` จาก URL (ค่าเริ่มต้น `''` เพื่อ TypeScript — ถ้าเกิดจริงเซิร์ฟเวอร์ตอบไม่พบ) แล้ว `<SessionView key={sessionId} sessionId={sessionId} />` — **ต้องแยกสองชั้น** เพราะตอนกด "เริ่มอาการนี้ใหม่" URL เปลี่ยนเป็น session ใหม่ แต่ React ใช้คอมโพเนนต์เดิม state เก่า (เส้นทาง, ข้อผิดพลาด) จะค้าง `key` ที่เปลี่ยนตาม `sessionId` บังคับสร้างใหม่ทั้งหมด

### บล็อก B — state และ ref (บรรทัด 55–80)
- hooks : `session`, `graphs`, `submit`, `saveOutcome`, `abandon`, `restart`
- `trail` (65) : เติมหลังเซิร์ฟเวอร์รับ action เท่านั้น กด F5 แล้วว่าง
- `isSendingRef` (74) กันกดเบิ้ล : `isPending` ของ React Query อัปเดตช้ากว่าการคลิกเล็กน้อย คลิกเร็วมากครั้งที่สองอาจเกิดก่อนปุ่มถูกปิดแล้วคำตอบเดียวกันถูกส่งซ้ำไปตอบคำถามถัดไปที่ผู้ใช้ยังไม่เห็น — `ref` เปลี่ยนค่าทันที ; `isSavingOutcomeRef` (77) ทำนองเดียวกันกับการบันทึกผล ; `stepRef` (80) กรอบกล่องขั้นตอนไว้ย้ายโฟกัส

### บล็อก C — ตัวจัดการเหตุการณ์ (บรรทัด 82–127)
- `handleAction(action)` : ถ้า `isSendingRef.current` หรือยังไม่มี `session.data` ให้ออก ; จำ `nodeBefore = session.data.node` (พอเซิร์ฟเวอร์ตอบ แคชจะกลายเป็นสถานะใหม่) ; `submit.mutate(action, { onSuccess: เติม trail ด้วย toTrailEntry(nodeBefore, action), onSettled: ปลด isSendingRef })`
- `handleOutcome(text)` : กันเบิ้ลแล้ว `saveOutcome.mutate(text, {onSettled: ปลด})`
- `handleAbandon()` : `abandon.mutate(sessionId, { onSettled: () => navigate('/symptoms') })` — ไม่ถามยืนยัน และกลับหน้าเลือกอาการแม้ลบไม่สำเร็จ (session ที่ค้างหมดอายุเอง)
- `handleRestart(graphId)` : `restart.mutate({ graphId }, { onSuccess: next => navigate('/session/…', { replace: true }) })` — `replace` กันปุ่ม back พากลับหน้าจบของ session เก่า ; **ไม่ส่ง `query`** (เริ่มซ้ำ ไม่ใช่การค้นหาใหม่ จึงไม่มีคะแนนความคล้าย)
- `handleRefresh()` : `reset()` ของ `submit`/`restart`/`saveOutcome` แล้ว `session.refetch()`

### บล็อก D — ย้ายโฟกัส (บรรทัด 129–136)
`useEffect` ผูกกับ `trail.length` : หลังผู้ใช้ตอบ `scrollIntoView({block:'nearest', behavior:'smooth'})` แล้ว `querySelector('h2[tabindex="-1"]')?.focus({preventScroll:true})` — หัวข้อใน `StepCard` รอไว้แล้ว screen reader จึงอ่านขั้นใหม่ทันที ; ไม่ทำตอนเปิดหน้าครั้งแรก (`trail.length === 0`)

### บล็อก E — รอนาน/โหลด/error (บรรทัด 138–162)
`isWaiting = session.isPending || submit.isPending || restart.isPending || saveOutcome.isPending` ; `slowNotice = useSlowWait(isWaiting) && <SlowServerNotice/>` ; ยังไม่มีข้อมูล → "กำลังโหลดขั้นตอน" ; `session.isError` → `<SessionErrorNotice … onRefresh={handleRefresh}>` (hook ทั้งหมดถูกเรียกก่อน return เหล่านี้ตามกฎของ React)

### บล็อก F — วาดหน้า (บรรทัด 164–218)
- ดึง `node, graphId, equipment, confidence, outcome: savedOutcome` จาก `session.data` ; `summary = graphs.data?.find(graphId)` ; `manualLabel = "<brand> <modelPattern>"` ; `actionError = submit.error ?? restart.error` (แสดงทีละอย่าง; error ของการบันทึกผลลัพธ์แสดงในช่องกรอกเอง)
- ลำดับ : `SessionHeader` (`canAbandon={!node.isTerminal}`) → `EquipmentPanel` → `slowNotice` → `SessionErrorNotice` (ถ้ามี) → `PathRail entries={trail} current={node}` ครอบ `<div ref={stepRef}>` ที่มี `<StepView key={node.nodeId} … outcomeForm={<OutcomeForm …/>} outcomeActions={<TerminalActions …/>} />`
- `key={node.nodeId}` (ล้างช่องติ๊กและช่องกรอกทุกครั้งที่เปลี่ยนสถานะ) จำเป็นกับ `indicator_blinking` ที่มีสถานะต้องยืนยันคำเตือนสองสถานะติดกัน

## 3. การส่งข้อมูล

```
URL /session/:id ─useParams→ useSession ─(แคชจาก useStartSession หรือ GET)→ SessionResponse
StepView.onAction ─handleAction→ submit.mutate ─POST …/actions→ เซิร์ฟเวอร์ ─ตอบ session ใหม่→ setQueryData → render ใหม่
                                       └ onSuccess: trail += toTrailEntry(nodeBefore, action)
OutcomeForm.onSubmit ─handleOutcome→ POST …/outcome
TerminalActions ─ นำทาง /symptoms หรือเริ่ม session ใหม่ (POST /traversal/sessions {graphId})
```

## 4. จุดที่ควรระวัง

- **ด่านความปลอดภัยไม่ได้อยู่ที่หน้านี้**: หน้านี้แค่ส่ง `confirm_safety` ตามที่กล่องส่งมา ; เซิร์ฟเวอร์เป็นผู้บังคับ (ถ้าถูกปฏิเสธ `onSuccess` ไม่ทำงาน แคชและ `trail` ไม่เปลี่ยน)
- `isSendingRef` ถูกปลดใน `onSettled` — ถ้ามี exception ก่อน `mutate` เริ่ม ref อาจค้าง `true` (ไม่พบกรณีนี้ในโค้ดปัจจุบัน) (อนุมานจากโค้ด)
- `useAbandonSession` ลบแคชของ session ก่อนนำทาง — ระหว่างนั้นหน้านี้อาจ fetch ใหม่ได้ (ขึ้นกับจังหวะ render) (อนุมานจากโค้ด; ไม่ได้ทดลองในเบราว์เซอร์)
- `graphs.data` ที่ยังโหลดไม่เสร็จทำให้ไม่มี `manualLabel` บรรทัดที่มาจะแสดงรหัสเอกสารแทน

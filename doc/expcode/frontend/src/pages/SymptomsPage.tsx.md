# frontend/src/pages/SymptomsPage.tsx

## 1. หน้าที่ของไฟล์

หน้าเลือกอาการ (route `/symptoms`) มี 2 ทางเริ่มการตรวจ : (1) พิมพ์อาการ → ระบบค้นหาเสนอผังที่ใกล้เคียง (สูงสุด 3) → ผู้ใช้เลือกเอง ; (2) เลือกจากรายการอาการทั้งหมด (ใช้ได้เสมอแม้ระบบค้นหาใช้ไม่ได้) การค้นหาเป็นแค่ตัวช่วยเลือก ขั้นถัดไปในผังเป็นของเครื่องสถานะที่เซิร์ฟเวอร์เสมอ ; กดแถวไหน = เริ่ม session ของอาการนั้นแล้วไปหน้าตรวจอาการ

- **ใครเรียกใช้**: `App.tsx` (route `/symptoms`)
- **เรียกใช้**: `ApiError`, `useGraphs`/`useStartSession`/`useSymptomSearch`, `SlowServerNotice`, `SymptomRow`, `SymptomSearchForm`, `SymptomSearchResults`, `Button`, `Icon`, `Notice`, `describeError`, `DEVICE_CATEGORY_LABELS`, `checkQuery`/`normalizeQuery`, `groupSymptoms`, `useSlowWait`, `useNavigate`

## 2. อธิบายทีละบล็อก

### บล็อก A — ค่าคงที่ (บรรทัด 30–37)
`type Area = 'search' | 'list'` (แถวที่กดมาจากส่วนไหน — ผังเดียวกันอยู่ได้ทั้งผลค้นหาและรายการ) ; `SEARCH_INFO_CODES = {'INVALID_QUERY','SEARCH_NOT_READY','SEARCH_UNAVAILABLE'}` (error ของการค้นหาที่ไม่ใช่ความล้มเหลวของระบบ ใช้กล่องสีฟ้า)

### บล็อก B — `SymptomsPage()` (บรรทัด 39–175)
- state : `query`, `startingRow: {area, graphId} | null` (เก็บเองเพราะ `useStartSession` บอกแค่ว่ากำลังเริ่ม ไม่บอกว่าแถวไหน) ; `isStarting = startSession.isPending`
- `handleSelect(area, graphId)` (65–71) : **เริ่ม session ใน `onClick` เท่านั้น ห้ามย้ายไป `useEffect`** เพราะ StrictMode (dev) เรียก effect สองรอบจะได้ session สองอัน ; ส่ง `query` เฉพาะแถวในผลค้นหา และเป็นข้อความที่ใช้ค้นจริง (`search.data.query`) ไม่ใช่ข้อความที่ผู้ใช้กำลังแก้ในช่อง (ไม่งั้นคะแนนไม่ตรงผลที่เห็น) ; แถวในรายการไม่ส่ง query → `confidence` เป็น `null` ; `onSuccess` → `navigate('/session/<id>')` ไม่ต้อง GET ซ้ำเพราะแคชถูกใส่แล้ว
- `handleSearch()` (73–76) : ตรวจ `checkQuery` แล้ว `search.mutate(normalizeQuery(query))`
- `rowState(area, graphId)` (79–85) : `isStarting` ของแถวนั้น หรือ `disabled` เมื่อแถวอื่นกำลังเริ่ม
- `isSlow = useSlowWait(graphs.isPending || isStarting || search.isPending)` (88)
- โครงหน้า (90–174) : หัวข้อ → `SlowServerNotice` → `SymptomSearchForm` (แสดงตั้งแต่แรก ไม่ขึ้นกับการโหลดรายการ) → `<div aria-live="polite">` ที่แสดง `SearchErrorNotice` หรือ `SymptomSearchResults` → `SymptomsErrorNotice` ของการเริ่ม session → ส่วน "เลือกจากรายการอาการ" (กำลังโหลด / error พร้อมปุ่ม "ลองอีกครั้ง" / ว่าง "ยังไม่มีอาการให้เลือก" / กลุ่มของ `groupSymptoms` ที่หัวกลุ่มเป็นชื่อประเภทเครื่อง+ยี่ห้อ+รุ่น แล้ว `SymptomRow` ต่ออาการ)

### บล็อก C — คอมโพเนนต์ย่อยในไฟล์ (บรรทัด 177–218)
- `SearchErrorNotice({error})` : ใช้ `describeError` ; ถ้าเป็น `ApiError` ที่ code อยู่ใน `SEARCH_INFO_CODES` → `Notice tone="info"` ไม่เช่นนั้น `danger`
- `SymptomsErrorNotice({error, children})` : ถ้า `NETWORK_ERROR` → "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ต…" ; ไม่เช่นนั้น "เกิดข้อผิดพลาด — เซิร์ฟเวอร์ตอบกลับผิดปกติ (HTTP <status>)" ใช้ร่วมสำหรับโหลดรายการไม่ได้และเริ่ม session ไม่ได้ ไม่แยกไฟล์เพราะใช้แค่หน้านี้

## 3. การส่งข้อมูล

```
พิมพ์ → POST /symptom-search {"query"} → matches → คลิกแถว → POST /traversal/sessions {"graphId","query"} → navigate /session/<id>
เลือกจากรายการ → POST /traversal/sessions {"graphId"} (ไม่มี query) → navigate
GET /traversal/graphs → groupSymptoms → รายการ
```

## 4. จุดที่ควรระวัง

- **`SymptomsErrorNotice` ไม่ใช้ `describeError`** (ต่างจาก `SearchErrorNotice`) : ข้อผิดพลาดของ `GRAPH_NOT_FOUND`, `GRAPH_NODE_MISSING` ฯลฯ ตอนเริ่ม session จะแสดงเป็น "เซิร์ฟเวอร์ตอบกลับผิดปกติ (HTTP 404/500)" ทั่วไป ไม่ใช่ข้อความไทยเฉพาะรหัส (อนุมานจากโค้ด)
- `startingRow` ไม่ถูกล้างหลังเริ่มสำเร็จ/ล้มเหลว (ใช้ร่วมกับ `isStarting` ตัดสินสถานะแถว)
- ผลค้นหาค้างอยู่ใน `search.data` จนกว่าจะค้นใหม่ (แม้ผู้ใช้แก้ข้อความในช่อง) — การเลือกแถวจากผลเก่าจึงส่ง `query` ของครั้งที่ค้นจริง ตามที่ตั้งใจ
- ข้อความในหน้าอ้าง "ตามคู่มือของเครื่องนั้น" เป็นถ้อยคำทั่วไปที่ใช้ได้กับทุกคู่มือ

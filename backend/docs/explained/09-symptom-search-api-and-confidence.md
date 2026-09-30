# ขั้น 1.7–1.8 — API ค้นหาอาการ และคะแนนความมั่นใจของ session

ขั้น 1.7 ทำให้งานค้นหาอาการเรียกใช้ผ่าน HTTP ได้ (filter, controller, module) ขั้น 1.8 ต่อผลค้นหาเข้ากับ session: เมื่อเริ่ม session จากคำค้น เซิร์ฟเวอร์คำนวณ "คะแนนความมั่นใจ" ของ session เองแล้วบันทึกลงฐานข้อมูล

> **ศัพท์:** เอกสารนี้ใช้คำว่า เครื่องสถานะ / สถานะ ตาม PROJECT_CONTEXT ข้อ 3
> ชื่อในโค้ดยังคงเดิม: **`graph` ในโค้ด = ผังขั้นตอนการวินิจฉัย 1 อาการ (เครื่องสถานะ 1 ชุด)**
> เช่น `GraphRepository` = ที่เก็บผังขั้นตอน, `graphId` = รหัสผังขั้นตอน, ตาราง `sessions` เก็บสถานะปัจจุบันของการตรวจแต่ละครั้ง

---

## ส่วนที่ 1 — ขั้น 1.7: API ค้นหาอาการ

| ไฟล์ | หน้าที่ |
|---|---|
| `symptom-search.exception.filter.ts` | แปลง error ของงานค้นหาเป็น HTTP response (ฟังก์ชันล้วน `toErrorBody` + คลาส filter) |
| `symptom-search.controller.ts` | `POST /symptom-search` และ `GET /symptom-search/status` |
| `symptom-search.module.ts` | ประกอบ controller + `EmbeddingService` + `SymptomSearchService` |

### ตาราง error → HTTP

| error | HTTP | code | ความหมาย |
|---|---:|---|---|
| `InvalidSearchQueryError` | 400 | `INVALID_QUERY` | body ผิดรูปแบบ |
| `SearchNotReadyError` | 503 | `SEARCH_NOT_READY` | กำลังโหลดโมเดล ลองใหม่ได้ |
| `SearchUnavailableError` | 503 | `SEARCH_UNAVAILABLE` | ปิดสวิตช์อยู่ หรือโหลดไม่สำเร็จ |
| อื่นๆ | 500 | `INTERNAL_ERROR` | ไม่รู้สาเหตุ (log เฉพาะกรณีนี้) |

- controller "โง่" เหมือน `TraversalController`: ตรวจ body ด้วย `parseSearchBody` แล้วส่งต่อ service ไม่จับ error เอง
- `POST` ตอบ **200 ไม่ใช่ 201** เพราะการค้นหาไม่ได้สร้างทรัพยากรใหม่
- ข้อจำกัดที่รู้อยู่แล้ว: JSON ที่ผิดไวยากรณ์ล้วนๆ (เช่น `{`) ถูก Express ตอบ 400 เองก่อนถึง filter รูปแบบ body จึงไม่มีฟิลด์ `code` (เหมือน traversal filter เดิม) หน้าจอต้องรองรับ

---

## ส่วนที่ 2 — ขั้น 1.8: คะแนนความมั่นใจของ session

### 2.1 นิยาม (ต้องตรงกันทุกเอกสาร)

| เรื่อง | ค่า |
|---|---|
| ความหมาย | คะแนนความคล้าย (cosine) ระหว่างคำค้นของผู้ใช้ กับผังขั้นตอนที่ผู้ใช้เลือก ปัด 3 ตำแหน่ง |
| เป็นของ | **session** ไม่ใช่ของสถานะ (ตรงกับ PROJECT_CONTEXT §5) |
| `null` หมายถึง | ไม่มีการจับคู่ให้วัด: ผู้ใช้เลือกอาการจากรายการ 13 อาการเอง, หรือระบบค้นหาไม่พร้อม |
| **ไม่ใช่** | ความน่าจะเป็น ห้ามแสดงเป็น "มั่นใจ 87%" ให้เรียกว่า "คะแนนความคล้าย 0.72" |
| ห้าม | ใช้ 0 หรือ 1 แทน `null` เพราะจะปนกับ "คะแนนต่ำจริง" / "ตรงเป๊ะจริง" |

### 2.2 การไหลของข้อมูล

```
POST /traversal/sessions  { graphId, query? }
   │  parseStartSessionBody  (ตรวจ query: ข้อความ ไม่ว่าง ไม่เกิน 200 ตัวอักษร · ทิ้ง field แปลกปลอม)
   ▼
TraversalService.startSession(graphId, query?)
   │  requireGraph(graphId)          ← ผังไม่มี = 404 ก่อนคิดคะแนน
   │  computeConfidence              ← query ไม่มี = null · มี = SymptomSearchService.scoreGraph
   ▼
engine.startSession(graph, confidence)   ← เก็บลง session เฉย ๆ ไม่อ่านไปตัดสินใจ
   ▼
SessionStore.create   → คอลัมน์ sessions.confidence (migration 004)
   ▼
SessionResponseDto.confidence  (ส่งกลับทุก endpoint ของ session)
```

### 2.3 การตัดสินใจสำคัญและเหตุผล

| เรื่อง | ทำอย่างไร | เหตุผล |
|---|---|---|
| **เซิร์ฟเวอร์คำนวณเอง** | หน้าจอส่งมาแค่ `query` ตัวเลขที่ส่งมาในชื่อ `confidence` ถูกทิ้ง | ให้เลขนี้ไม่ใช่สิ่งที่ผู้ใช้กำหนดเองผ่านคำขอ ⚠️ แต่ `query` ยังมาจากผู้ใช้ ผู้ใช้จึงยังจงใจพิมพ์ข้อความให้ได้คะแนนสูงได้ ค่านี้จึงเป็นข้อมูลแสดงผล **ไม่ใช่เขตความปลอดภัย** |
| **`confidence` ไม่มีผลต่อการตัดสินใจ** | engine เก็บค่าแต่ไม่เคยอ่าน มีเทสพิสูจน์ | ตรงหลักการหลัก: เครื่องสถานะเป็นผู้ตัดสินขั้นถัดไป ด่านความปลอดภัยไม่ขึ้นกับคะแนน |
| **ล้มเหลวแล้วเป็น `null` ไม่ใช่ error** | `computeConfidence` จับ error ทั้งหมด | คะแนนเป็นข้อมูลเสริม ห้ามทำให้การเริ่ม session ล้ม และไม่แต่งตัวเลข |
| **`scoreGraph` คืนคะแนนของผังที่ระบุ** | ไม่ใช่ผังที่คะแนนสูงสุด | ผู้ใช้อาจเลือกอันดับ 2 หรือ 3 ค่าต้องเป็นของผังที่ผู้ใช้เลือกจริง |
| **`query` ว่างถูกปฏิเสธ (400)** | ไม่ตีเป็น "ไม่ส่ง" | หน้าจอที่ผิดพลาดจะได้เห็นชัด แทนที่จะเงียบไปเป็น `null` |
| **`SessionState.confidence` เป็น optional** | `confidence?: number \| null` | SessionState ที่สร้างไว้ในเทสเดิม 4 จุดยังคอมไพล์ผ่านโดยไม่ต้องแก้เทสเดิม ที่ขอบ API แปลง `undefined` เป็น `null` เสมอ |
| **`DECIMAL` ถูกแปลงเป็นตัวเลข** | `Number(row.confidence)` | mysql2 ส่งค่า DECIMAL กลับมาเป็นข้อความ (`'0.866'`) |

### 2.4 การแยก `GraphModule` (ตัดการพึ่งกันเป็นวงกลม)

`TraversalService` ต้องใช้ `SymptomSearchService` (คิดคะแนน) ส่วน `SymptomSearchService` ต้องใช้ `GraphRepository` (สร้างดัชนี) ถ้าโมดูลสองตัวนี้ import กันตรงๆ จะวนกลับหากัน จึงแยก `GraphRepository` ไปอยู่ใน `GraphModule` ที่ไม่พึ่งใคร แล้วให้ทั้งสองโมดูล import

```
GraphModule (GraphRepository)  ◄─┬─ SymptomSearchModule (export SymptomSearchService)
                                 └─ TraversalModule ──imports──► SymptomSearchModule
```

`GraphRepository` ยังเป็นตัวเดียว: โหลดผังจาก MySQL ครั้งเดียวตอนบูต ไม่ได้โหลดซ้ำ

### 2.5 Migration 004

`ALTER TABLE sessions ADD COLUMN confidence DECIMAL(4,3) NULL AFTER variables`

- เพิ่มคอลัมน์ที่เป็น `NULL` ได้เท่านั้น: แถวเดิมได้ `NULL` อัตโนมัติ ไม่ต้องแก้ข้อมูลเก่า
- ⚠️ **ต้องรัน `npm run migrate` กับ MySQL บน Aiven ก่อน deploy โค้ดใหม่** ไม่งั้น `INSERT` ที่อ้างคอลัมน์ `confidence` จะล้มและเริ่ม session ไม่ได้เลย

### 2.6 ลำดับขั้นย่อยของ 1.8

| ขั้น | สิ่งที่ทำ |
|---|---|
| 1.8.1 | migration 004 เพิ่มคอลัมน์ `confidence` |
| 1.8.2 | engine เก็บ `confidence` ใน session |
| 1.8.3 | `SessionStore` บันทึกและอ่านคอลัมน์ใหม่ |
| 1.8.4 | `SymptomSearchService.scoreGraph` |
| 1.8.5 | แยก `GraphModule` ตัดการพึ่งกันเป็นวงกลม |
| 1.8.6 | `parseStartSessionBody` รับ `query` ไม่บังคับ |
| 1.8.7 | ต่อสาย: service, controller, response DTO |
| 1.8.8 | frontend: ชนิดข้อมูลและตัวจำลอง |
| 1.8.9 | เอกสารนี้ |

---

## ส่วนที่ 3 — หลักฐานการทดสอบ และสิ่งที่ยังไม่พิสูจน์

**เทส:** backend **9 suites, 155 เทสผ่าน** · frontend **6 ไฟล์ 43 เทสผ่าน**

| กลุ่ม | เคส |
|---|---:|
| filter ค้นหา (`toErrorBody`) — ขั้น 1.7 | 4 |
| `TraversalService` — confidence | 7 |
| `traversal.dto.spec.ts` (`parseStartSessionBody`) | 6 |
| `SymptomSearchService.scoreGraph` | 3 |
| engine — confidence | 4 |

ตัวเลขเทสของ backend ไล่ตามขั้นย่อย: 135 (หลัง 1.7) → 139 (1.8.2) → 142 (1.8.4) → 148 (1.8.6) → **155** (1.8.7) ส่วน 1.8.1, 1.8.3, 1.8.5 ไม่เพิ่มเทส

ครอบคลุม: ไม่ส่ง query = `null` และไม่เรียกระบบค้นหา · ส่ง query ได้คะแนนตามระบบค้นหา · `getSession` ภายหลังได้ค่าเดิม · ระบบค้นหาไม่พร้อมหรือคำนวณล้มเหลว = `null` · ผังไม่มี = 404 โดยไม่คำนวณ · **คะแนนสูงสุด (1) ก็ไม่ช่วยข้ามด่านความปลอดภัย** · engine ให้สถานะถัดไปเหมือนกันทุกประการไม่ว่า confidence เป็น `null`, 0 หรือ 1

**ทดสอบกับฐานข้อมูลจริงในแซนด์บ็อกซ์** (ไม่ใช่เทสอัตโนมัติ ไม่ได้ commit): รัน migration 001–004, seed ข้อมูลแอร์, เปิด `AppModule` ตัวจริง แล้วยิง HTTP

| สถานการณ์ | ผล |
|---|---|
| ไม่ส่ง `query` | `confidence: null` |
| ส่ง `query` ตอนปิดระบบค้นหา | `confidence: null` |
| ส่ง `query` ตอนเปิดระบบค้นหา (โมเดลจริง) และแอบส่ง `confidence: 1` มาด้วย | ได้ค่าที่เซิร์ฟเวอร์คำนวณ (ไม่ใช่ 1) เก็บในตารางเป็นทศนิยม 3 ตำแหน่ง `GET` และ action ต่อมาได้ค่าเดิม |
| `query` ว่างหรือไม่ใช่ข้อความ | 400 `INVALID_ACTION` |

### ⚠️ ข้อจำกัดที่ต้องรู้ (ห้ามอ้างเกินจริง)

| เรื่อง | ความจริง |
|---|---|
| ฐานข้อมูลที่ทดสอบ | **MariaDB 10.11** ไม่ใช่ MySQL 8.4 ที่ใช้จริง ชนิด `DECIMAL` และคำสั่ง `ALTER` เป็นมาตรฐาน คาดว่าเหมือนกัน แต่ต้องยืนยันด้วยการรันบน MySQL/Aiven ของคุณเอง |
| `SessionStore` | ยังไม่มีเทสยูนิต (ต้องใช้ MySQL จริง) พิสูจน์ผ่านการยิง API ข้างต้นเท่านั้น |
| ตัวเลขคะแนนตัวอย่าง (เช่น 0.866) | เป็นผลจากคำค้นที่ลองครั้งเดียว **ไม่ใช่ผลวัดคุณภาพ ห้ามอ้าง** คุณภาพของการจับคู่วัดในขั้น 1.9 |
| หน้าจอ | frontend เพิ่มแค่ชนิดข้อมูลกับตัวจำลอง (`confidence: null`) การส่ง `query` และแสดงคะแนนอยู่ในขั้น 1.10 |

---

## ส่วนที่ 4 — ขั้นถัดไป

ขั้น 1.9: วัดผลและตั้งเกณฑ์ (`MATCH_THRESHOLD` ยังเป็นค่าชั่วคราว 0.5) ผู้พัฒนาเขียนชุดคำค้นเอง แยกสองชุด (ชุดตั้งเกณฑ์ / ชุดรายงานผล) มีทั้งในขอบเขตและนอกขอบเขต และแก้กรณีคำว่า "แอร์" ที่ดึงทุกผังเข้าหากัน
/**
 * สัญญาของข้อมูลระหว่างหน้าจอกับเซิร์ฟเวอร์
 *
 * แบ่งเป็น 3 กลุ่ม
 *   1. type ที่ re-export จาก engine  — ตรงกับเซิร์ฟเวอร์แน่นอน เพราะเป็นไฟล์เดียวกัน
 *   2. type ที่ลอกมาจาก backend       — ต้องแก้ตามถ้าฝั่งนั้นเปลี่ยน
 *   3. type ที่เสนอเอง               — รูปร่างเทียบกับ response ของ backend แล้ว ตรงกันทุกฟิลด์
 */

// ============================================================
// 1. re-export จาก engine
// ============================================================

/**
 * import จาก backend ได้เพราะ types.ts ของ engine ไม่ import NestJS หรืออะไรเลย
 * ใช้ export type ไม่ใช่ export เฉยๆ เพราะทั้งหมดเป็น type ล้วน
 * ซึ่งจะหายไปตอน build จึงไม่มีโค้ดของ backend ติดมาแม้แต่บรรทัดเดียว
 *
 * รวบไว้ที่ไฟล์นี้จุดเดียว ไฟล์อื่นห้าม import จาก backend โดยตรง
 * ถ้าวันหนึ่งย้ายโฟลเดอร์ จะได้แก้ที่เดียว
 */
export type {
  NodeType,
  InputType,
  OutcomeKind,
  DeviceCategory,
  Severity,
  Difficulty,
  SessionStatus,
  TraversalAction,
  NodeReference,
  RenderedNode,
} from '../../../backend/src/traversal-engine/types'

/**
 * บรรทัดนี้ดูเหมือนซ้ำกับข้างบน แต่คนละหน้าที่
 *   export type = ส่งต่อชื่อออกไปให้ไฟล์อื่น import
 *   import type = เอาชื่อมาใช้ในไฟล์นี้เอง
 * ชื่อไหนที่ไฟล์นี้ใช้เองด้วย ต้องอยู่ทั้งสองที่
 */
import type {
  DeviceCategory,
  Severity,
  Difficulty,
  SessionStatus,
  RenderedNode,
} from '../../../backend/src/traversal-engine/types'

// ============================================================
// 2. ลอกมาจาก backend/src/traversal/graph.repository.ts
// ============================================================

/**
 * รายการอาการ 1 รายการ ที่ GET /traversal/graphs ส่งกลับมาเป็น array
 *
 * ต้องลอกมา import ตรงไม่ได้ เพราะ graph.repository.ts import NestJS
 * ถ้าฝั่ง backend แก้ GraphSummary ต้องมาแก้ที่นี่ด้วย
 * (ลอกตรงจากโค้ดจริงแล้ว ณ วันที่เขียนไฟล์นี้)
 */
export interface GraphSummary {
  graphId: string
  entrySymptom: string
  /** บางผังขั้นตอนอาจไม่มีชื่อไทย หน้าจอต้องถอยไปใช้ entrySymptom */
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  /** ไม่ได้เอามาแสดงบนหน้าจอ เพราะไม่ช่วยให้ผู้ใช้เลือกอาการ */
  severity?: Severity
  difficulty?: Difficulty
}

/**
 * ผังขั้นตอน 1 รายการที่ POST /symptom-search ส่งกลับมาในฟิลด์ matches
 *
 * ลอกมาจาก backend/src/symptom-search/symptom-search.dto.ts (SymptomMatchDto)
 * ไม่ import ตรง เพราะไฟล์นั้นมีโค้ดที่ทำงานจริงปนอยู่ด้วย (ตัวตรวจ body และ class error)
 * ถ้าฝั่ง backend แก้ DTO ต้องมาแก้ที่นี่ด้วย
 */
export interface SymptomMatch {
  graphId: string
  entrySymptom: string
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  /**
   * คะแนนความคล้าย (cosine) ปัด 3 ตำแหน่ง
   * ไม่ใช่ความน่าจะเป็น ห้ามแสดงเป็น "มั่นใจ x%"
   */
  score: number
  /** ข้อความอาการในข้อมูลที่ทำให้ได้คะแนนนี้ */
  matchedText: string
}

/** สิ่งที่ POST /symptom-search ส่งกลับมา (ลอกจาก SymptomSearchResponseDto) */
export interface SymptomSearchResponse {
  /** คำค้นหลังเซิร์ฟเวอร์ตัดช่องว่างหน้าหลังแล้ว */
  query: string
  /** เกณฑ์ที่เซิร์ฟเวอร์ใช้ตัดสินรอบนี้ */
  threshold: number
  /** คะแนนสูงสุดที่พบ ส่งมาเสมอแม้ไม่มีผังผ่านเกณฑ์ (null = ไม่มีผังให้เทียบเลย) */
  bestScore: number | null
  /** ผังที่ผ่านเกณฑ์ เรียงมากไปน้อย ว่าง = ต้องแสดงการส่งต่อศูนย์บริการ ห้ามเดา */
  matches: SymptomMatch[]
}

// ============================================================
// 3. type ที่เสนอเอง — รูปร่างเทียบกับ response ของ backend แล้ว ตรงกันทุกฟิลด์
// ============================================================

/**
 * สิ่งที่ POST /traversal/sessions และ GET /traversal/sessions/:id ส่งกลับมา
 *
 * ที่ต้องมี graphId ด้วย เพราะหน้าตรวจอาการต้องเอาไปหาชื่ออาการภาษาไทย
 * กับยี่ห้อและรุ่น จากรายการผังขั้นตอนมาแสดงเป็นหัวข้อหน้า
 */
export interface SessionResponse {
  sessionId: string
  graphId: string
  status: SessionStatus
  node: RenderedNode
  /** อาจไม่มีมาด้วย ถ้าไม่มี หน้าจอจะซ่อนแผงอุปกรณ์ทั้งแผง */
  equipment?: EquipmentItem[]
  /**
   * คะแนนความคล้ายระหว่างคำค้นกับผังที่เลือก เซิร์ฟเวอร์คำนวณเอง (ปัด 3 ตำแหน่ง)
   * null หรือไม่มี = ผู้ใช้เลือกอาการจากรายการเอง หรือระบบค้นหาไม่พร้อม
   * ไม่ใช่ความน่าจะเป็น ห้ามแสดงเป็น "มั่นใจ x%" หน้าจอแสดงเป็น "คะแนนความคล้าย" อย่างเดียว
   * และไม่ใช้ตัดสินอะไรทั้งสิ้น (ขั้นถัดไปเป็นของเครื่องสถานะที่เซิร์ฟเวอร์)
   */
  confidence?: number | null
}

/**
 * อุปกรณ์ 1 ชิ้น อิงจาก data/equipment/equipment.json
 * ผูกกับประเภทเครื่อง ไม่ได้ผูกกับอาการ
 *
 * sourcePage กับ authorNote ต้องมีอย่างน้อยหนึ่งอย่างเสมอ
 * เพราะหน้าจอบอกที่มาของอุปกรณ์ทุกชิ้น ตามหลักการของโครงงาน
 * ชิ้นไหนคู่มือไม่ได้ระบุ ต้องเขียนว่าผู้พัฒนาแนะนำเพิ่ม
 */
export interface EquipmentItem {
  equipmentId: string
  nameTh: string
  purposeTh: string
  /** มีค่า = อ้างอิงคู่มือได้ */
  sourcePage?: number
  /** มีค่า = ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือ */
  authorNote?: string
}

/**
 * รูปร่าง body ที่เซิร์ฟเวอร์ส่งกลับมาเมื่อไม่สำเร็จ
 * หน้าจอใช้ code ไม่ใช่ message ในการเลือกข้อความที่จะแสดง
 * เพราะ message ของ engine เขียนไว้ให้นักพัฒนาอ่าน ไม่ใช่ผู้ใช้ทั่วไป
 */
export interface ApiErrorBody {
  statusCode: number
  /** เช่น SAFETY_CONFIRMATION_REQUIRED */
  code?: string
  message?: string
}

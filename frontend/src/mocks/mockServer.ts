/**
 * เซิร์ฟเวอร์จำลองสำหรับตอนพัฒนา
 *
 * ไฟล์นี้ไม่มีตรรกะการดำเนินการตามเครื่องสถานะเลย — ใช้ engine ตัวเดียวกับเซิร์ฟเวอร์จริง
 * และไฟล์ผังขั้นตอนตัวเดียวกับที่ backend โหลด สิ่งที่จำลองคือชั้น HTTP เท่านั้น
 *
 * เหตุผลที่ไม่เขียนตรรกะขึ้นใหม่: ถ้ามีตรรกะสองชุด แล้ววันหนึ่งเพี้ยนจากกัน
 * หน้าจอจะโกหกเรื่องด่านความปลอดภัย ซึ่งขัดหลักการหลักของโครงงาน
 *
 * ⚠️ ไฟล์นี้ต้องไม่หลุดเข้า build จริง — api/traversal.ts โหลดด้วย
 * dynamic import ใต้เงื่อนไข VITE_USE_MOCK จะพิสูจน์ในขั้น 9.3
 *
 * ไฟล์นี้เป็นจุดเดียวที่ import ของใน backend และ data โดยตรง
 * ไฟล์อื่นต้องผ่าน api/types.ts เท่านั้น
 */

// error เหล่านี้เป็น class จริงตอนรัน ไม่ใช่ type จึงใช้ import ธรรมดา
import {
  NodeNotFoundError,
  InvalidActionError,
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
  UnsupportedSchemaVersionError,
} from '../../../backend/src/traversal-engine/types'

import type {
  ManualFile,
  SessionState,
  TroubleshootingGraph,
} from '../../../backend/src/traversal-engine/types'

import {
  getCurrentNode,
  startSession as engineStartSession,
  submitAction as engineSubmitAction,
} from '../../../backend/src/traversal-engine/traversal-engine'

// ตัวตรวจ body ของผลลัพธ์ตัวเดียวกับที่ controller จริงใช้ (ตัดช่องว่าง ไม่ว่าง ไม่เกินเพดาน)
// ใช้ของ backend ตรงๆ ไม่เขียนกฎซ้ำเป็นชุดที่สอง ตามเหตุผลเดียวกับที่ใช้ engine ตัวเดียวกัน
import {
  InvalidOutcomeError,
  parseOutcomeBody,
} from '../../../backend/src/traversal/traversal.dto'

import manualJson from '../../../data/manuals/samsung_ac_ar70h.json'
import equipmentJson from '../../../data/equipment/equipment.json'

import { ApiError } from '../api/http'
import type {
  EquipmentItem,
  GraphSummary,
  SessionResponse,
  SymptomSearchResponse,
  TraversalAction,
} from '../api/types'

// ============================================================
// ข้อมูลที่โหลดครั้งเดียวตอน import
// ============================================================

const manual = manualJson as unknown as ManualFile

/** key = graph_id — เลียนแบบที่ graph.repository.ts ทำตอนบูตเซิร์ฟเวอร์ */
const graphs = new Map<string, TroubleshootingGraph>(
  manual.graphs.map((graph) => [graph.graph_id, graph]),
)

/**
 * session ทั้งหมดอยู่ในหน่วยความจำของแท็บ
 * กด F5 แล้วหายหมด ซึ่งเป็นพฤติกรรมที่ยอมรับในโหมดจำลอง
 * การทดสอบว่า refresh แล้วยังอยู่ขั้นเดิม ต้องรอเซิร์ฟเวอร์จริงในขั้น 10.2
 */
const sessions = new Map<string, SessionState>()

/**
 * ข้อความผลลัพธ์ที่ผู้ใช้กรอก key = sessionId
 *
 * แยกจาก sessions โดยตั้งใจ เหมือนที่ backend เก็บแยกจาก SessionState ของ engine
 * engine จึงไม่เคยเห็นผลลัพธ์ และผลลัพธ์ไม่มีทางไปเปลี่ยนขั้นตอนของเครื่องสถานะ
 * ไม่มีรายการ = ยังไม่ได้กรอก (ตอบเป็น null)
 */
const outcomes = new Map<string, string>()

/** รูปร่างของ data/equipment/equipment.json เฉพาะ field ที่ใช้ */
interface EquipmentFile {
  equipment: { equipment_id: string; name_th: string }[]
  usage: {
    device_category: string
    items: {
      equipment_id: string
      purpose_th: string
      source_page?: number
      author_note?: string
    }[]
  }[]
}

const equipmentFile = equipmentJson as unknown as EquipmentFile

// ============================================================
// ตัวช่วย
// ============================================================

/**
 * หน่วงเวลาให้เห็นสถานะกำลังโหลด ไม่งั้นจะสร้างสถานะรอไม่ถูก
 * ตอนรันเทสตั้งเป็น 0 เพราะไม่มีใครดู และทำให้เทสเร็วขึ้นเป็นสิบเท่า
 */
const DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 300

function delay(): Promise<void> {
  if (DELAY_MS === 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS))
}

/**
 * รายการอุปกรณ์ของประเภทเครื่องนั้น
 * ผูกกับประเภทเครื่อง ไม่ได้ผูกกับอาการ — ทุกอาการของแอร์ได้รายการเดียวกัน
 */
function equipmentFor(graph: TroubleshootingGraph): EquipmentItem[] {
  const names = new Map(equipmentFile.equipment.map((item) => [item.equipment_id, item.name_th]))
  const usage = equipmentFile.usage.find((entry) => entry.device_category === graph.device_category)

  // ประเภทที่ยังไม่มีข้อมูลอุปกรณ์ คืน array ว่าง แล้วหน้าจอจะซ่อนแผงทั้งแผง
  if (!usage) return []

  return usage.items.map((item) => ({
    equipmentId: item.equipment_id,
    nameTh: names.get(item.equipment_id) ?? item.equipment_id,
    purposeTh: item.purpose_th,
    sourcePage: item.source_page,
    authorNote: item.author_note,
  }))
}

/**
 * แปลง error ของ engine เป็นรหัส HTTP
 *
 * ตารางนี้เป็นสัญญาที่ REST API จริงต้องทำตามให้ตรงกันทุกแถว
 * ถ้าไม่ตรง หน้าจอจะแสดงข้อความผิดกรณี
 */
function toApiError(error: unknown): ApiError {
  if (error instanceof SafetyConfirmationRequiredError) {
    return new ApiError(400, 'SAFETY_CONFIRMATION_REQUIRED', error.message)
  }
  if (error instanceof InvalidActionError) {
    return new ApiError(400, 'INVALID_ACTION', error.message)
  }
  if (error instanceof SessionAlreadyCompletedError) {
    return new ApiError(409, 'SESSION_COMPLETED', error.message)
  }
  if (error instanceof NodeNotFoundError) {
    return new ApiError(500, 'GRAPH_NODE_MISSING', error.message)
  }
  if (error instanceof UnsupportedSchemaVersionError) {
    return new ApiError(500, 'GRAPH_SCHEMA_UNSUPPORTED', error.message)
  }
  return new ApiError(500, 'UNKNOWN_ERROR', error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ')
}

function requireGraph(graphId: string): TroubleshootingGraph {
  const graph = graphs.get(graphId)
  if (!graph) {
    throw new ApiError(404, 'GRAPH_NOT_FOUND', `ไม่พบกราฟ '${graphId}'`)
  }
  return graph
}

function requireSession(sessionId: string): SessionState {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', `ไม่พบ session '${sessionId}'`)
  }
  return session
}

// ============================================================
// ฟังก์ชันละหนึ่ง endpoint ของ API จริง (ยกเว้น /health ที่ไม่มีทางจำลอง)
// ============================================================

/** GET /traversal/graphs */
export async function listGraphs(): Promise<GraphSummary[]> {
  await delay()

  // ลอกตรงจาก graph.repository.ts เมธอด listAll()
  return manual.graphs.map((graph) => ({
    graphId: graph.graph_id,
    entrySymptom: graph.entry_symptom,
    entrySymptomTh: graph.entry_symptom_th,
    deviceCategory: graph.device_category,
    brand: graph.brand,
    modelPattern: graph.model_pattern,
    severity: graph.severity,
    difficulty: graph.difficulty,
  }))
}

/**
 * POST /symptom-search
 *
 * ตัวจำลองไม่มีโมเดลค้นหา และไม่แต่งผลลัพธ์ขึ้นมาเอง (ผลปลอมจะทำให้หน้าจอดูเหมือนค้นหาได้จริง)
 * จึงตอบเหมือนเซิร์ฟเวอร์จริงตอนปิดสวิตช์ระบบค้นหา: 503 SEARCH_UNAVAILABLE
 * ผู้ใช้เห็นข้อความบอกให้เลือกจากรายการแทน ซึ่งเป็นทางเดียวที่ใช้ได้ในโหมดจำลอง
 *
 * ไม่รับ query เพราะไม่ได้ใช้ (ผลเหมือนกันทุกคำค้น)
 */
export async function searchSymptoms(): Promise<SymptomSearchResponse> {
  await delay()
  throw new ApiError(503, 'SEARCH_UNAVAILABLE', 'ระบบค้นหาไม่พร้อมใช้งาน (โหมดจำลอง)')
}

/** POST /traversal/sessions */
export async function startSession(graphId: string): Promise<SessionResponse> {
  await delay()
  const graph = requireGraph(graphId)

  try {
    const { session, node } = engineStartSession(graph)
    sessions.set(session.sessionId, session)

    return {
      sessionId: session.sessionId,
      graphId,
      status: session.status,
      node,
      equipment: equipmentFor(graph),
      // ตัวจำลองไม่มีระบบค้นหา จึงไม่มีการจับคู่ให้วัดเสมอ (เซิร์ฟเวอร์จริงคำนวณเองเมื่อได้รับ query)
      confidence: null,
      // session ที่เพิ่งเริ่มยังไม่จบ จึงยังไม่มีผลลัพธ์
      outcome: null,
    }
  } catch (error) {
    throw toApiError(error)
  }
}

/** GET /traversal/sessions/:id */
export async function getSession(sessionId: string): Promise<SessionResponse> {
  await delay()
  const session = requireSession(sessionId)
  const graph = requireGraph(session.graphId)

  try {
    return {
      sessionId,
      graphId: session.graphId,
      status: session.status,
      node: getCurrentNode(session, graph),
      equipment: equipmentFor(graph),
      // ตัวจำลองไม่มีระบบค้นหา จึงไม่มีการจับคู่ให้วัดเสมอ (เซิร์ฟเวอร์จริงคำนวณเองเมื่อได้รับ query)
      confidence: null,
      // กด F5 แล้วยังเห็นข้อความที่บันทึกไว้ (ไม่มีรายการ = null)
      outcome: outcomes.get(sessionId) ?? null,
    }
  } catch (error) {
    throw toApiError(error)
  }
}

/** POST /traversal/sessions/:id/actions */
export async function submitAction(
  sessionId: string,
  action: TraversalAction,
): Promise<SessionResponse> {
  await delay()
  const session = requireSession(sessionId)
  const graph = requireGraph(session.graphId)

  try {
    // engine เป็น pure function คืน session ใหม่ ไม่แก้ของเดิม
    // ถ้า engine โยน error เช่นด่านความปลอดภัย บรรทัดนี้จะกระโดดไป catch
    // แล้ว sessions.set ข้างล่างจะไม่ทำงาน — สถานะจึงไม่ขยับ ตรงตามที่เทสข้อ 3 ตรวจ
    const result = engineSubmitAction(session, graph, action)
    sessions.set(sessionId, result.session)

    return {
      sessionId,
      graphId: session.graphId,
      status: result.session.status,
      node: result.node,
      equipment: equipmentFor(graph),
      // ตัวจำลองไม่มีระบบค้นหา จึงไม่มีการจับคู่ให้วัดเสมอ (เซิร์ฟเวอร์จริงคำนวณเองเมื่อได้รับ query)
      confidence: null,
      // session ที่เพิ่งเดินมาถึงตอนจบยังไม่มีผลลัพธ์ (ที่จบแล้วส่ง action ไม่ได้ ถูกปฏิเสธข้างบน)
      outcome: null,
    }
  } catch (error) {
    throw toApiError(error)
  }
}

/**
 * POST /traversal/sessions/:id/outcome
 *
 * ลำดับการตรวจตรงกับ backend ทุกข้อ (controller ตรวจ body ก่อน แล้ว service ตรวจตามนี้):
 *   1. body ผิดรูปแบบ         → 400 INVALID_OUTCOME
 *   2. session ไม่มี          → 404 SESSION_NOT_FOUND
 *   3. session ยังเดินอยู่     → 409 SESSION_NOT_COMPLETED
 *   4. เคยบันทึกไปแล้ว         → 409 OUTCOME_ALREADY_SUBMITTED
 * ถ้าเรียงต่างจากนี้ หน้าจอที่ลองกับตัวจำลองจะเจอข้อความคนละอย่างกับเซิร์ฟเวอร์จริง
 *
 * ไม่เรียก engine ที่เปลี่ยนสถานะเลย (ใช้ getCurrentNode อ่านขั้นปัจจุบันมาประกอบคำตอบเท่านั้น)
 */
export async function submitOutcome(sessionId: string, text: string): Promise<SessionResponse> {
  await delay()

  let saved: string
  try {
    saved = parseOutcomeBody({ text }).text
  } catch (error) {
    if (error instanceof InvalidOutcomeError) {
      throw new ApiError(400, 'INVALID_OUTCOME', error.message)
    }
    throw error
  }

  const session = requireSession(sessionId)
  const graph = requireGraph(session.graphId)

  if (session.status !== 'completed') {
    throw new ApiError(409, 'SESSION_NOT_COMPLETED', `session '${sessionId}' ยังไม่จบ`)
  }
  if (outcomes.has(sessionId)) {
    throw new ApiError(409, 'OUTCOME_ALREADY_SUBMITTED', `session '${sessionId}' บันทึกผลไปแล้ว`)
  }
  outcomes.set(sessionId, saved)

  try {
    return {
      sessionId,
      graphId: session.graphId,
      status: session.status,
      node: getCurrentNode(session, graph),
      equipment: equipmentFor(graph),
      // ตัวจำลองไม่มีระบบค้นหา จึงไม่มีการจับคู่ให้วัดเสมอ (เซิร์ฟเวอร์จริงคำนวณเองเมื่อได้รับ query)
      confidence: null,
      outcome: saved,
    }
  } catch (error) {
    throw toApiError(error)
  }
}

/** DELETE /traversal/sessions/:id */
export async function abandonSession(sessionId: string): Promise<void> {
  await delay()
  requireSession(sessionId)
  sessions.delete(sessionId)
  // เซิร์ฟเวอร์จริงลบทั้งแถว ผลลัพธ์จึงหายไปพร้อมกัน
  outcomes.delete(sessionId)
}
/**
 * หนึ่งฟังก์ชันต่อหนึ่ง endpoint
 *
 * ไฟล์นี้เป็นจุดเดียวทั้งโปรเจกต์ที่รู้ว่ากำลังใช้ mock หรือเซิร์ฟเวอร์จริง
 * ไฟล์อื่นเรียกฟังก์ชันเหล่านี้โดยไม่ต้องรู้ ถ้าจะเลิกใช้ mock ก็ลบเงื่อนไขในไฟล์นี้
 */

import { request } from './http'
import type { GraphSummary, HealthResponse, SessionResponse, TraversalAction } from './types'

/**
 * อ่านครั้งเดียวตอนโหลดไฟล์ได้ ต่างจาก VITE_API_URL ใน http.ts
 * เพราะค่านี้ไม่ทำให้แอปพังถ้าไม่มี — ไม่มีค่า = ถือว่า false = ใช้เซิร์ฟเวอร์จริง
 *
 * ต้องเทียบ === 'true' เพราะค่าจาก .env เป็นข้อความเสมอ
 * ถ้าเขียน if (import.meta.env.VITE_USE_MOCK) เฉยๆ ข้อความว่า 'false' จะถือเป็นจริง
 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/**
 * โหลด mock แบบ dynamic import
 *
 * ใช้ import() ไม่ใช่ import ปกติ เพราะ import ปกติจะลากโค้ด mock
 * และไฟล์กราฟทั้งหมดเข้า build จริงด้วย ส่วน import() ทำให้ Vite
 * แยกเป็นไฟล์ต่างหาก และตัดออกทั้งก้อนเมื่อ USE_MOCK เป็นเท็จตลอด
 *
 * ตรวจแล้วว่า build ตอน VITE_USE_MOCK=false ได้ JS ก้อนเดียวที่ไม่มีข้อมูลกราฟเลย
 */
function loadMock() {
  return import('../mocks/mockServer')
}

/**
 * GET /health
 *
 * ไม่มีโหมดจำลอง เพราะจุดประสงค์คือตอบว่าเซิร์ฟเวอร์จริงยังอยู่ไหม
 * ถ้าปลอมคำตอบก็ไม่มีประโยชน์ — ในโหมดจำลอง ServerStatus จะไม่เรียกฟังก์ชันนี้
 */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

/** GET /traversal/graphs — รายการอาการทั้งหมด */
export async function listGraphs(): Promise<GraphSummary[]> {
  if (USE_MOCK) return (await loadMock()).listGraphs()
  return request<GraphSummary[]>('/traversal/graphs')
}

/**
 * POST /traversal/sessions — เริ่มการตรวจอาการหนึ่งครั้ง
 *
 * ⚠️ รูปร่าง body ยังไม่ยืนยันกับ backend (B1) ต้องเทียบในขั้น 10.1
 */
export async function startSession(graphId: string): Promise<SessionResponse> {
  if (USE_MOCK) return (await loadMock()).startSession(graphId)
  return request<SessionResponse>('/traversal/sessions', {
    method: 'POST',
    body: { graphId },
  })
}

/** GET /traversal/sessions/:id — อ่านขั้นตอนปัจจุบันซ้ำ ใช้ตอน refresh หรือหลังเจอ error */
export async function getSession(sessionId: string): Promise<SessionResponse> {
  if (USE_MOCK) return (await loadMock()).getSession(sessionId)
  return request<SessionResponse>(`/traversal/sessions/${sessionId}`)
}

/** POST /traversal/sessions/:id/actions — ส่งคำตอบ แล้วได้ขั้นถัดไปกลับมา */
export async function submitAction(
  sessionId: string,
  action: TraversalAction,
): Promise<SessionResponse> {
  if (USE_MOCK) return (await loadMock()).submitAction(sessionId, action)
  return request<SessionResponse>(`/traversal/sessions/${sessionId}/actions`, {
    method: 'POST',
    body: action,
  })
}

/** DELETE /traversal/sessions/:id — ยกเลิกการตรวจ */
export async function abandonSession(sessionId: string): Promise<void> {
  if (USE_MOCK) return (await loadMock()).abandonSession(sessionId)
  return request<void>(`/traversal/sessions/${sessionId}`, { method: 'DELETE' })
}
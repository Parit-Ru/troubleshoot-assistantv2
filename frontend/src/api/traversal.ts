import { request } from './http'
import type { GraphSummary, SessionResponse, TraversalAction } from './types'

/**
 * หนึ่งฟังก์ชันต่อหนึ่ง endpoint
 *
 * ไฟล์นี้เป็นจุดเดียวในทั้งแอปที่รู้ว่ามี mock อยู่
 * หน้าจอเรียกฟังก์ชันพวกนี้โดยไม่รู้ว่าข้างหลังเป็นของจริงหรือของจำลอง
 *
 * ⚠️ เงื่อนไข import.meta.env.VITE_USE_MOCK === 'true' ต้องเขียนตรงๆ ในทุกฟังก์ชัน
 * ห้ามเก็บลงตัวแปรไว้ใช้ซ้ำ ตอน build Vite จะแทนค่าเป็นข้อความตรงๆ
 * แล้วตัดโค้ดที่ไม่มีทางทำงานทิ้ง พร้อมไฟล์ mockServer ทั้งไฟล์
 * ถ้าเก็บลงตัวแปร Vite อาจตัดไม่ได้ และข้อมูลกราฟจะหลุดเข้า build จริง
 *
 * ใช้ await import(...) ไม่ใช่ import ธรรมดาบนสุดของไฟล์ ด้วยเหตุผลเดียวกัน
 */

/** รูปร่างที่ GET /health ตอบกลับ ลอกจาก backend/src/health/health.controller.ts */
export interface HealthResponse {
  /** degraded = เซิร์ฟเวอร์ทำงาน แต่ต่อฐานข้อมูลไม่ได้ */
  status: 'ok' | 'degraded'
  service: string
  database: string
  timestamp: string
  environment: string
}

/**
 * GET /health
 *
 * ไม่มีทางไป mock เพราะหน้าที่คือเช็คว่าเซิร์ฟเวอร์จริงยังอยู่ไหม
 * ในโหมดจำลอง หน้าจอจะไม่เรียกฟังก์ชันนี้เลย
 */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

/** GET /traversal/graphs */
export async function listGraphs(): Promise<GraphSummary[]> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const mock = await import('../mocks/mockServer')
    return mock.listGraphs()
  }
  return request<GraphSummary[]>('/traversal/graphs')
}

/** POST /traversal/sessions */
export async function startSession(graphId: string): Promise<SessionResponse> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const mock = await import('../mocks/mockServer')
    return mock.startSession(graphId)
  }
  return request<SessionResponse>('/traversal/sessions', {
    method: 'POST',
    body: { graphId },
  })
}

/**
 * GET /traversal/sessions/:id
 *
 * encodeURIComponent เพราะ sessionId มาจาก URL ที่ผู้ใช้แก้เองได้
 * ถ้ามี / หรือ ? ปนมา จะกลายเป็นเรียก endpoint ผิดตัว
 */
export async function getSession(sessionId: string): Promise<SessionResponse> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const mock = await import('../mocks/mockServer')
    return mock.getSession(sessionId)
  }
  return request<SessionResponse>(`/traversal/sessions/${encodeURIComponent(sessionId)}`)
}

/** POST /traversal/sessions/:id/actions */
export async function submitAction(
  sessionId: string,
  action: TraversalAction,
): Promise<SessionResponse> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const mock = await import('../mocks/mockServer')
    return mock.submitAction(sessionId, action)
  }
  return request<SessionResponse>(
    `/traversal/sessions/${encodeURIComponent(sessionId)}/actions`,
    { method: 'POST', body: action },
  )
}

/** DELETE /traversal/sessions/:id */
export async function abandonSession(sessionId: string): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const mock = await import('../mocks/mockServer')
    return mock.abandonSession(sessionId)
  }
  return request<void>(`/traversal/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}
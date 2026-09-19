import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/http'
import { abandonSession, getSession, listGraphs, startSession, submitAction } from './mockServer'
import type { TraversalAction } from '../api/types'

const STOPS_WORKING = 'samsung_ac_ar70h_stops_working'
const ERROR_MESSAGE = 'samsung_ac_ar70h_error_message'
const WATER_DRIPS = 'samsung_ac_ar70h_water_drips_outdoor'

/** เดินตาม action ที่ให้มาทีละขั้น แล้วคืน session ที่หยุดอยู่ */
async function walk(graphId: string, actions: TraversalAction[]) {
  let session = await startSession(graphId)
  for (const action of actions) {
    session = await submitAction(session.sessionId, action)
  }
  return session
}

const YES: TraversalAction = { type: 'answer', value: 'yes' }

describe('mockServer', () => {
  it('มีอาการให้เลือก 13 อาการ และทุกอาการมีชื่อไทย', async () => {
    const graphs = await listGraphs()

    expect(graphs).toHaveLength(13)
    expect(graphs.every((g) => g.entrySymptomTh)).toBe(true)
  })

  it('เริ่ม session แล้วได้โหนดแรกของกราฟ พร้อมรายการอุปกรณ์', async () => {
    const session = await startSession(STOPS_WORKING)

    expect(session.node.nodeId).toBe('n1')
    expect(session.status).toBe('in_progress')
    expect(session.graphId).toBe(STOPS_WORKING)
    expect(session.equipment).toHaveLength(7)
  })

  it('ส่ง continue ที่ด่านความปลอดภัยถูกปฏิเสธ 400 และสถานะไม่ขยับ', async () => {
    // เทสที่สำคัญที่สุดของไฟล์นี้ — เป็นข้อสอบหลักของโครงงาน
    const session = await walk(STOPS_WORKING, [YES, YES])
    expect(session.node.nodeId).toBe('n_fix_breaker')
    expect(session.node.requiresSafetyConfirmation).toBe(true)

    const error = await submitAction(session.sessionId, { type: 'continue' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).code).toBe('SAFETY_CONFIRMATION_REQUIRED')

    // อ่านสถานะซ้ำ ต้องยังอยู่โหนดเดิม
    // ระบบที่ตอบ error แล้วแอบเดินต่อ จะแย่กว่าระบบที่ไม่มีด่านเลย
    const after = await getSession(session.sessionId)
    expect(after.node.nodeId).toBe('n_fix_breaker')
  })

  it('ยืนยันคำเตือนแล้วเดินต่อได้', async () => {
    // ด่านที่บล็อกทุกอย่างก็ผิดเหมือนกัน ต้องผ่านได้เมื่อยืนยันถูกวิธี
    const session = await walk(STOPS_WORKING, [YES, YES, { type: 'confirm_safety' }])

    expect(session.node.nodeId).toBe('n_recheck_breaker')
  })

  it('กรอกรหัสผิดรูปแบบ พาไปโหนดอธิบายรูปแบบ ไม่ใช่ error', async () => {
    // สำคัญ: การกรอกผิดไม่ใช่ข้อผิดพลาดของระบบ แต่เป็นเส้นทางหนึ่งในกราฟ
    // หน้าจอจึงห้ามตรวจรูปแบบเอง ต้องปล่อยให้เซิร์ฟเวอร์ตัดสิน
    const session = await walk(ERROR_MESSAGE, [YES, { type: 'input', value: '12' }])

    expect(session.node.nodeId).toBe('n_invalid_code')
    expect(session.status).toBe('in_progress')
  })

  it('กรอกรหัสถูกรูปแบบ พาไปหน้าจบที่แทนค่ารหัสในข้อความแล้ว', async () => {
    const session = await walk(ERROR_MESSAGE, [YES, { type: 'input', value: 'E1' }])

    expect(session.node.isTerminal).toBe(true)
    expect(session.node.outcomeKind).toBe('handoff_informed')
    expect(session.node.text).toContain('E1')
    // ถ้ายังมี {{ ค้างอยู่ แปลว่าการแทนค่าพัง และผู้ใช้จะเห็น {{error_code}} บนหน้าจอ
    expect(session.node.text).not.toContain('{{')
  })

  it('ส่ง action ต่อหลังจบแล้ว ถูกปฏิเสธ 409', async () => {
    const session = await walk(WATER_DRIPS, [YES])
    expect(session.status).toBe('completed')

    const error = await submitAction(session.sessionId, YES).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(409)
    expect((error as ApiError).code).toBe('SESSION_COMPLETED')
  })

  it('ใช้ sessionId ที่ไม่มีอยู่ ได้ 404 SESSION_NOT_FOUND', async () => {
    const error = await getSession('ไม่มี-session-นี้').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as ApiError).code).toBe('SESSION_NOT_FOUND')
  })

  it('ยกเลิกการตรวจแล้ว session หายไปจริง', async () => {
    const session = await startSession(STOPS_WORKING)

    await abandonSession(session.sessionId)
    const error = await getSession(session.sessionId).catch((e: unknown) => e)

    expect((error as ApiError).code).toBe('SESSION_NOT_FOUND')
  })

  it('ใช้ graphId ที่ไม่มีอยู่ ได้ 404 GRAPH_NOT_FOUND', async () => {
    const error = await startSession('ไม่มีกราฟนี้').catch((e: unknown) => e)

    expect((error as ApiError).status).toBe(404)
    expect((error as ApiError).code).toBe('GRAPH_NOT_FOUND')
  })
})
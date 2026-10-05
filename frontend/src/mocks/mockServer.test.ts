import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/http'
import {
  abandonSession,
  getSession,
  listGraphs,
  searchSymptoms,
  startSession,
  submitAction,
  submitOutcome,
} from './mockServer'
import type { TraversalAction } from '../api/types'

const STOPS_WORKING = 'samsung_ac_ar70h_stops_working'
const ERROR_MESSAGE = 'samsung_ac_ar70h_error_message'
const WATER_DRIPS = 'samsung_ac_ar70h_water_drips_outdoor'

/** ดำเนินการตาม action ที่ให้มาทีละขั้น แล้วคืน session ที่หยุดอยู่ */
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

  it('เริ่ม session แล้วได้สถานะเริ่มต้นของผังขั้นตอน พร้อมรายการอุปกรณ์', async () => {
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

    // อ่านสถานะซ้ำ ต้องยังอยู่สถานะเดิม
    // ระบบที่ตอบ error แล้วแอบเดินต่อ จะแย่กว่าระบบที่ไม่มีด่านเลย
    const after = await getSession(session.sessionId)
    expect(after.node.nodeId).toBe('n_fix_breaker')
  })

  it('ยืนยันคำเตือนแล้วเดินต่อได้', async () => {
    // ด่านที่บล็อกทุกอย่างก็ผิดเหมือนกัน ต้องผ่านได้เมื่อยืนยันถูกวิธี
    const session = await walk(STOPS_WORKING, [YES, YES, { type: 'confirm_safety' }])

    expect(session.node.nodeId).toBe('n_recheck_breaker')
  })

  it('กรอกรหัสผิดรูปแบบ พาไปสถานะอธิบายรูปแบบ ไม่ใช่ error', async () => {
    // สำคัญ: การกรอกผิดไม่ใช่ข้อผิดพลาดของระบบ แต่เป็นเส้นทางหนึ่งในผังขั้นตอน
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

  it('ค้นหาอาการ ตอบ 503 SEARCH_UNAVAILABLE เสมอ ไม่แต่งผลค้นหาขึ้นมาเอง', async () => {
    const error = await searchSymptoms().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
    expect((error as ApiError).code).toBe('SEARCH_UNAVAILABLE')
  })

  it('session ที่เริ่มในโหมดจำลอง ไม่มีคะแนนความคล้าย (confidence เป็น null)', async () => {
    const session = await startSession(STOPS_WORKING)

    expect(session.confidence).toBeNull()
  })
})
// ============================================================
// บันทึกผลลัพธ์ที่ผู้ใช้กรอกตอนจบ (POST /traversal/sessions/:id/outcome)
// ตัวจำลองต้องตอบรหัสและลำดับการตรวจตรงกับ backend ทุกข้อ
// ============================================================

/** เรียกแล้วคาดว่าล้มเหลว คืน ApiError ออกมาตรวจ (ถ้าไม่ล้มเหลว เทสจะตกเอง) */
async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

/** เดินถึงตอนจบแบบ resolution (แก้ไขได้/พฤติกรรมปกติ) */
const finishResolved = () => walk(WATER_DRIPS, [YES])
/** เดินถึงตอนจบแบบ escalation (ส่งต่อศูนย์บริการพร้อมรหัส) */
const finishEscalated = () => walk(ERROR_MESSAGE, [YES, { type: 'input', value: 'E1' }])

describe('mockServer — บันทึกผลลัพธ์', () => {
  it.each([
    ['resolution', finishResolved],
    ['escalation', finishEscalated],
  ])('ตอนจบแบบ %s บันทึกได้ และตอบ session เดิมพร้อม outcome ที่บันทึก', async (_kind, finish) => {
    const done = await finish()
    expect(done.node.isTerminal).toBe(true)

    const saved = await submitOutcome(done.sessionId, 'ทำตามขั้นตอนแล้วแอร์กลับมาทำงานปกติ')

    expect(saved.outcome).toBe('ทำตามขั้นตอนแล้วแอร์กลับมาทำงานปกติ')
    // ผลลัพธ์เป็นข้อมูลบันทึกอย่างเดียว ไม่ขยับสถานะหรือขั้นตอน
    expect(saved.status).toBe('completed')
    expect(saved.node.nodeId).toBe(done.node.nodeId)
    expect(saved.sessionId).toBe(done.sessionId)
  })

  it('บันทึกแล้ว GET session (เหมือนกด F5) ยังได้ข้อความเดิมกลับมา', async () => {
    const done = await finishResolved()
    await submitOutcome(done.sessionId, 'แก้ได้แล้ว')

    const reloaded = await getSession(done.sessionId)

    expect(reloaded.outcome).toBe('แก้ได้แล้ว')
  })

  it('ทุก response มีฟิลด์ outcome เป็น null จนกว่าจะบันทึก (เหมือน backend ที่ส่งทุกครั้ง)', async () => {
    const started = await startSession(STOPS_WORKING)
    expect(started.outcome).toBeNull()
    expect((await getSession(started.sessionId)).outcome).toBeNull()

    const stepped = await submitAction(started.sessionId, YES)
    expect(stepped.outcome).toBeNull()

    const done = await finishResolved()
    expect(done.outcome).toBeNull()
    expect((await getSession(done.sessionId)).outcome).toBeNull()
  })

  it('ตัดช่องว่างหน้าหลังก่อนเก็บ และเก็บข้อความตามที่พิมพ์ รวมการขึ้นบรรทัดใหม่และ HTML (ไม่ตีความ)', async () => {
    const done = await finishResolved()

    const saved = await submitOutcome(done.sessionId, '  บรรทัดแรก\n<b>บรรทัดสอง</b> & "เครื่องหมายคำพูด" \n')

    expect(saved.outcome).toBe('บรรทัดแรก\n<b>บรรทัดสอง</b> & "เครื่องหมายคำพูด"')
  })

  it('ยาว 1000 ตัวอักษรพอดีบันทึกได้', async () => {
    const done = await finishResolved()
    const saved = await submitOutcome(done.sessionId, 'ก'.repeat(1000))
    expect(saved.outcome).toHaveLength(1000)
  })

  it('บันทึกซ้ำ ถูกปฏิเสธ 409 OUTCOME_ALREADY_SUBMITTED และข้อความแรกไม่ถูกทับ', async () => {
    const done = await finishResolved()
    await submitOutcome(done.sessionId, 'ข้อความแรก')

    const error = await failure(submitOutcome(done.sessionId, 'ข้อความที่สอง'))

    expect(error.status).toBe(409)
    expect(error.code).toBe('OUTCOME_ALREADY_SUBMITTED')
    expect((await getSession(done.sessionId)).outcome).toBe('ข้อความแรก')
  })

  it('การตรวจยังไม่จบ ถูกปฏิเสธ 409 SESSION_NOT_COMPLETED และ session ยังเดินต่อได้ปกติ', async () => {
    const running = await startSession(STOPS_WORKING)

    const error = await failure(submitOutcome(running.sessionId, 'ลองบันทึกก่อนจบ'))

    expect(error.status).toBe(409)
    expect(error.code).toBe('SESSION_NOT_COMPLETED')
    // ไม่มีอะไรถูกเก็บ และสถานะไม่ขยับ
    const after = await getSession(running.sessionId)
    expect(after.outcome).toBeNull()
    expect(after.node.nodeId).toBe(running.node.nodeId)
    expect((await submitAction(running.sessionId, YES)).status).toBe('in_progress')
  })

  it('ไม่พบ session ได้ 404 SESSION_NOT_FOUND', async () => {
    const error = await failure(submitOutcome('ไม่มี-session-นี้', 'ข้อความ'))

    expect(error.status).toBe(404)
    expect(error.code).toBe('SESSION_NOT_FOUND')
  })

  it.each([
    ['ว่าง', ''],
    ['มีแต่ช่องว่าง', '   \n\t '],
    ['ยาวเกิน 1000 (1001 ตัวอักษร)', 'ก'.repeat(1001)],
  ])('ข้อความ%s ถูกปฏิเสธ 400 INVALID_OUTCOME และไม่เก็บอะไร', async (_name, text) => {
    const done = await finishResolved()

    const error = await failure(submitOutcome(done.sessionId, text))

    expect(error.status).toBe(400)
    expect(error.code).toBe('INVALID_OUTCOME')
    expect((await getSession(done.sessionId)).outcome).toBeNull()
  })

  it('ลำดับการตรวจตรงกับ backend: ตรวจรูปแบบข้อความก่อน แล้วค่อยหา session และสถานะ', async () => {
    const running = await startSession(STOPS_WORKING)

    // ข้อความผิด + session ไม่มี → 400 (ไม่ใช่ 404)
    expect((await failure(submitOutcome('ไม่มี-session-นี้', ''))).code).toBe('INVALID_OUTCOME')
    // ข้อความผิด + session ยังเดินอยู่ → 400 (ไม่ใช่ 409)
    expect((await failure(submitOutcome(running.sessionId, '  '))).code).toBe('INVALID_OUTCOME')
    // ข้อความถูก + session ไม่มี → 404 ; ข้อความถูก + ยังเดินอยู่ → 409
    expect((await failure(submitOutcome('ไม่มี-session-นี้', 'ข้อความ'))).code).toBe('SESSION_NOT_FOUND')
    expect((await failure(submitOutcome(running.sessionId, 'ข้อความ'))).code).toBe('SESSION_NOT_COMPLETED')
  })

  it('บันทึกผลแล้ว ส่ง action ต่อก็ยังถูกปฏิเสธ 409 SESSION_COMPLETED (ผลลัพธ์ไม่ปลุกการตรวจ)', async () => {
    const done = await finishResolved()
    await submitOutcome(done.sessionId, 'แก้ได้แล้ว')

    const error = await failure(submitAction(done.sessionId, YES))

    expect(error.status).toBe(409)
    expect(error.code).toBe('SESSION_COMPLETED')
  })

  it('ยกเลิกการตรวจแล้ว session หายไปพร้อมผลลัพธ์', async () => {
    const done = await finishResolved()
    await submitOutcome(done.sessionId, 'แก้ได้แล้ว')

    await abandonSession(done.sessionId)

    expect((await failure(getSession(done.sessionId))).code).toBe('SESSION_NOT_FOUND')
    expect((await failure(submitOutcome(done.sessionId, 'ข้อความ'))).code).toBe('SESSION_NOT_FOUND')
  })

  it('ผลลัพธ์ของ session หนึ่งไม่รั่วไป session อื่น', async () => {
    const first = await finishResolved()
    const second = await finishResolved()

    await submitOutcome(first.sessionId, 'ของ session แรก')

    expect((await getSession(second.sessionId)).outcome).toBeNull()
    // session ที่สองยังบันทึกได้ (ไม่ถูกบล็อกว่า "บันทึกไปแล้ว")
    expect((await submitOutcome(second.sessionId, 'ของ session สอง')).outcome).toBe('ของ session สอง')
  })
})

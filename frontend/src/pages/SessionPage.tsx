import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TraversalAction } from '../api/types'
import {
  useAbandonSession,
  useGraphs,
  useSession,
  useStartSession,
  useSubmitAction,
  useSubmitOutcome,
} from '../api/queries'
import { EquipmentPanel } from '../components/EquipmentPanel'
import { OutcomeForm } from '../components/OutcomeForm'
import { SessionErrorNotice } from '../components/SessionErrorNotice'
import { SessionHeader } from '../components/SessionHeader'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { PathRail } from '../components/step/PathRail'
import { StepView } from '../components/step/StepView'
import { TerminalActions } from '../components/TerminalActions'
import { Icon } from '../components/ui/Icon'
import { toTrailEntry } from '../lib/trail'
import type { TrailEntry } from '../lib/trail'
import { useSlowWait } from '../lib/useSlowWait'

/**
 * หน้าตรวจอาการ — route "/session/:sessionId"
 *
 * หน้านี้ประกอบชิ้นส่วนเข้าด้วยกัน ไม่ได้ตัดสินใจอะไรเอง
 *   - สถานะปัจจุบัน   มาจากเซิร์ฟเวอร์ (useSession)
 *   - ขั้นถัดไป        เซิร์ฟเวอร์เป็นคนเลือก หน้าจอแค่ส่ง action ไป (useSubmitAction)
 *   - เส้นทางที่ผ่านมา  หน้าจอบันทึกเอง ใช้แสดงผลอย่างเดียว
 *   - ผลลัพธ์ที่ผู้ใช้กรอกตอนจบ  ส่งไปเก็บที่เซิร์ฟเวอร์ (useSubmitOutcome) เป็นข้อมูลบันทึกอย่างเดียว
 *     ไม่ผ่าน handleAction และไม่เปลี่ยนขั้นตอน ปุ่มที่หน้าจบไม่ขึ้นกับว่ากรอกหรือไม่
 *
 * สิ่งที่ห้ามทำในหน้านี้
 *   - คำนวณเองว่าขั้นถัดไปคืออะไร
 *   - มีปุ่มย้อนกลับ (กลไกควบคุมเครื่องสถานะไม่มีคำสั่งย้อน)
 *   - ใส่ nodeId ลงใน URL (ปุ่ม back ของเบราว์เซอร์จะพาไปขั้นที่เซิร์ฟเวอร์ผ่านไปแล้ว)
 *   - ตรวจรูปแบบรหัสที่ผู้ใช้กรอก
 */

/**
 * ชั้นนอก: อ่าน sessionId จาก URL แล้วส่งต่อ พร้อม key={sessionId}
 *
 * ทำไมต้องแยกสองชั้น: ตอนกด "เริ่มอาการนี้ใหม่" URL เปลี่ยนเป็น session ใหม่
 * แต่ React ใช้ component ตัวเดิม state เก่า (เส้นทาง ข้อผิดพลาด) จะค้างมาด้วย
 * key ที่เปลี่ยนตาม sessionId บังคับให้สร้างใหม่ทั้งหมด state จึงเริ่มจากศูนย์
 */
export function SessionPage() {
  // route นี้มี :sessionId เสมอ ค่าว่างกันไว้ให้ TypeScript เท่านั้น ถ้าเกิดจริงเซิร์ฟเวอร์จะตอบว่าไม่พบ
  const { sessionId = '' } = useParams()
  return <SessionView key={sessionId} sessionId={sessionId} />
}

function SessionView({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const session = useSession(sessionId)
  const graphs = useGraphs()
  const submit = useSubmitAction(sessionId)
  const saveOutcome = useSubmitOutcome(sessionId)
  const abandon = useAbandonSession()
  const restart = useStartSession()

  /** เส้นทางที่ผ่านมา เติมหลังเซิร์ฟเวอร์รับ action แล้วเท่านั้น กด F5 แล้วว่าง */
  const [trail, setTrail] = useState<TrailEntry[]>([])

  /**
   * กันกดเบิ้ล
   * isPending ของ React Query อัปเดตหน้าจอช้ากว่าการคลิกเล็กน้อย
   * ถ้าคลิกสองครั้งเร็วมาก ครั้งที่สองอาจเกิดก่อนปุ่มถูกปิด
   * แล้วคำตอบเดียวกันจะถูกส่งซ้ำไปตอบคำถามถัดไปที่ผู้ใช้ยังไม่เห็น
   * ref เปลี่ยนค่าทันทีโดยไม่ต้องรอ render จึงกันได้แน่นอน
   */
  const isSendingRef = useRef(false)

  /** กันกดบันทึกผลเบิ้ล ด้วยเหตุผลเดียวกับ isSendingRef (เซิร์ฟเวอร์รับได้ครั้งเดียวอยู่แล้ว แต่ครั้งที่สองจะขึ้นข้อผิดพลาดให้เสียเปล่า) */
  const isSavingOutcomeRef = useRef(false)

  /** กรอบของกล่องขั้นตอนปัจจุบัน ใช้ย้ายโฟกัสหลังเปลี่ยนขั้น */
  const stepRef = useRef<HTMLDivElement>(null)

  function handleAction(action: TraversalAction) {
    if (isSendingRef.current || session.data === undefined) return
    isSendingRef.current = true
    // จำสถานะ "ก่อน" ส่งไว้ เพราะพอเซิร์ฟเวอร์ตอบ แคชจะกลายเป็นสถานะใหม่แล้ว
    const nodeBefore = session.data.node

    submit.mutate(action, {
      onSuccess: () => setTrail((previous) => [...previous, toTrailEntry(nodeBefore, action)]),
      onSettled: () => {
        isSendingRef.current = false
      },
    })
  }

  function handleOutcome(text: string) {
    if (isSavingOutcomeRef.current) return
    isSavingOutcomeRef.current = true

    saveOutcome.mutate(text, {
      onSettled: () => {
        isSavingOutcomeRef.current = false
      },
    })
  }

  function handleAbandon() {
    // ไม่ถามยืนยัน และกลับหน้าเลือกอาการแม้เซิร์ฟเวอร์ลบไม่สำเร็จ
    // เพราะผู้ใช้ตั้งใจออกแล้ว session ที่ค้างจะหมดอายุเองฝั่งเซิร์ฟเวอร์
    abandon.mutate(sessionId, { onSettled: () => navigate('/symptoms') })
  }

  function handleRestart(graphId: string) {
    // replace: ไม่ให้ปุ่ม back พากลับมาหน้าจบของ session เก่า
    // ไม่ส่ง query: เริ่มซ้ำคือเริ่มใหม่จากผังเดิม ไม่ใช่การค้นหา session ใหม่จึงไม่มีคะแนนความคล้าย
    restart.mutate({ graphId }, {
      onSuccess: (next) => navigate(`/session/${next.sessionId}`, { replace: true }),
    })
  }

  /** ใช้กับปุ่ม "ลองอีกครั้ง" และ "ดึงขั้นตอนล่าสุด" — ล้างข้อผิดพลาดเดิม แล้วถามเซิร์ฟเวอร์ใหม่ */
  function handleRefresh() {
    submit.reset()
    restart.reset()
    saveOutcome.reset()
    void session.refetch()
  }

  // ---------- หลังเปลี่ยนขั้น: เลื่อนกล่องเข้าจอ แล้วย้ายโฟกัสไปที่หัวข้อของกล่อง ----------
  // ผูกกับจำนวนรายการบนเส้นทาง จึงทำงานเฉพาะหลังผู้ใช้ตอบ ไม่ทำตอนเปิดหน้าครั้งแรก
  useEffect(() => {
    if (trail.length === 0 || stepRef.current === null) return
    stepRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    // หัวข้อใน StepCard มี tabIndex={-1} รอไว้แล้ว โปรแกรมอ่านหน้าจอจะอ่านขั้นใหม่ทันที
    stepRef.current.querySelector<HTMLElement>('h2[tabindex="-1"]')?.focus({ preventScroll: true })
  }, [trail.length])

  // ---------- รอนาน: แบบเดียวกับ SymptomsPage ----------
  const isWaiting = session.isPending || submit.isPending || restart.isPending || saveOutcome.isPending
  const slowNotice = useSlowWait(isWaiting) && <SlowServerNotice />

  // ---------- ยังไม่มีข้อมูล session ----------
  if (session.isPending) {
    return (
      <div className="space-y-6">
        {slowNotice}
        <p className="flex items-center gap-2 text-ink-soft">
          <Icon name="spinner" className="h-5 w-5 animate-spin" />
          กำลังโหลดขั้นตอน
        </p>
      </div>
    )
  }

  if (session.isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">ตรวจอาการ</h1>
        <SessionErrorNotice error={session.error} onRefresh={handleRefresh} />
      </div>
    )
  }

  // ---------- มีข้อมูลแล้ว ----------
  const { node, graphId, equipment, confidence, outcome: savedOutcome } = session.data
  // รายการอาการอาจยังโหลดไม่เสร็จ หัวข้อชั่วคราวไปก่อน ไม่ค้างทั้งหน้า
  const summary = graphs.data?.find((graph) => graph.graphId === graphId)
  const manualLabel = summary && `${summary.brand} ${summary.modelPattern}`
  // แสดงข้อผิดพลาดของการกระทำล่าสุดครั้งละหนึ่งอย่าง กล่องขั้นตอนยังอยู่ที่เดิม
  // (ข้อผิดพลาดของการบันทึกผลลัพธ์ไม่อยู่ตรงนี้ แสดงในช่องกรอกเองข้างปุ่มบันทึก)
  const actionError = submit.error ?? restart.error

  return (
    <div className="space-y-6">
      <SessionHeader
        summary={summary}
        confidence={confidence}
        canAbandon={!node.isTerminal}
        isAbandoning={abandon.isPending}
        onAbandon={handleAbandon}
      />

      <EquipmentPanel items={equipment} deviceCategory={summary?.deviceCategory} />

      {slowNotice}
      {actionError && <SessionErrorNotice error={actionError} onRefresh={handleRefresh} />}

      <PathRail entries={trail} current={node}>
        <div ref={stepRef}>
          {/* key={node.nodeId}: ล้างช่องติ๊กและช่องกรอกทุกครั้งที่เปลี่ยนสถานะ
              จำเป็นกับ indicator_blinking ที่มีสถานะต้องยืนยันคำเตือนสองสถานะติดกัน */}
          <StepView
            key={node.nodeId}
            node={node}
            onAction={handleAction}
            isPending={submit.isPending}
            manualLabel={manualLabel}
            outcomeForm={
              <OutcomeForm
                savedText={savedOutcome}
                onSubmit={handleOutcome}
                isSending={saveOutcome.isPending}
                error={saveOutcome.error}
                onRefresh={handleRefresh}
              />
            }
            outcomeActions={
              <TerminalActions
                onOtherSymptom={() => navigate('/symptoms')}
                onRestart={() => handleRestart(graphId)}
                isRestarting={restart.isPending}
              />
            }
          />
        </div>
      </PathRail>
    </div>
  )
}

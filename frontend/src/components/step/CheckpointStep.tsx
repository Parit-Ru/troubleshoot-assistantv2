import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

/**
 * สถานะแบบคำถาม (checkpoint) — ตอบได้สองทาง ใช่ หรือ ไม่ใช่
 *
 * กล่องนี้แค่แจ้งคำตอบออกไป ไม่รู้ว่าแต่ละคำตอบพาไปสถานะไหน
 * การเปลี่ยนสถานะตัดสินที่ resolveNextNode ฝั่งเซิร์ฟเวอร์ (on_yes / on_no)
 */
export function CheckpointStep({ node, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard
      label={STEP_KIND_LABELS.checkpoint}
      heading={node.text}
      reference={node.reference}
      manualLabel={manualLabel}
    >
      {/*
        สองปุ่มใช้แบบ answer เหมือนกันทุกอย่าง น้ำหนักเท่ากัน ไม่ใช้เขียว-แดง
        เพราะสีจะชี้นำคำตอบ ผู้ใช้ควรตอบตามที่เห็นจริงที่เครื่อง ไม่ใช่ตามสี

        คำบนปุ่มต้องเป็น "ใช่" และ "ไม่ใช่" ตรงตัว ห้ามเปลี่ยนเป็น "มี/ไม่มี" หรือ "ถูก/ผิด"
        เพราะคำถามบางข้อในข้อมูลเขียนว่า "หากไม่ทราบ ให้ตอบไม่ใช่"
      */}
      <div className="space-y-3">
        <Button
          variant="answer"
          disabled={isPending}
          onClick={() => onAction({ type: 'answer', value: 'yes' })}
        >
          ใช่
        </Button>
        <Button
          variant="answer"
          disabled={isPending}
          onClick={() => onAction({ type: 'answer', value: 'no' })}
        >
          ไม่ใช่
        </Button>
      </div>
    </StepCard>
  )
}
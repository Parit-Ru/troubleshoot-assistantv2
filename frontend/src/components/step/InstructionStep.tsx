import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

/**
 * สถานะแบบขั้นตอน (instruction) ที่ไม่ต้องยืนยันคำเตือน — มีทางไปต่อทางเดียว
 *
 * instruction ที่ต้องยืนยันคำเตือนไม่ได้มาที่กล่องนี้ StepView ส่งไป SafetyGateStep แทน
 * ถ้าส่ง { type: 'continue' } ให้สถานะที่ต้องยืนยัน เซิร์ฟเวอร์จะปฏิเสธและสถานะไม่ขยับ
 */
export function InstructionStep({ node, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard
      label={STEP_KIND_LABELS.instruction}
      heading={node.text}
      reference={node.reference}
      manualLabel={manualLabel}
    >
      {/*
        ใช้คำกลางๆ ว่า "ถัดไป" ไม่ใช่ "ทำแล้ว" หรือ "เสร็จแล้ว"
        เพราะบางผังขั้นตอนเริ่มด้วยคำอธิบาย ไม่ใช่คำสั่งให้ลงมือทำ
      */}
      <Button variant="primary" disabled={isPending} onClick={() => onAction({ type: 'continue' })}>
        ถัดไป
      </Button>
    </StepCard>
  )
}
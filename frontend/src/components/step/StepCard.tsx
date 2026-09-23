import type { ReactNode } from 'react'
import type { NodeReference } from '../../api/types'
import { ReferenceLine } from './ReferenceLine'

/**
 * กรอบที่กล่องขั้นตอนทุกแบบใช้ร่วมกัน
 *
 * ลำดับภายในกรอบ (บนลงล่าง)
 *   1. ป้ายบอกชนิด       เช่น "คำถาม"
 *   2. notice            ช่องสำหรับกล่องคำเตือน (ใช้เฉพาะสถานะที่ต้องยืนยันคำเตือน)
 *   3. heading           ข้อความหลักของสถานะ
 *   4. children          ส่วนควบคุม เช่น ปุ่ม ช่องกรอก
 *   5. บรรทัดที่มา
 *
 * notice อยู่ก่อน heading เพราะผู้ใช้ต้องเห็นคำเตือนก่อนอ่านว่าจะให้ทำอะไร
 * กรอบนี้แค่จัดวาง ไม่รู้ว่ากล่องข้างในเป็นแบบไหน และไม่แจ้ง action เอง
 */
type StepCardTone = 'default' | 'danger'

interface StepCardProps {
  /** ป้ายบอกชนิด จาก STEP_KIND_LABELS ไม่ส่งมาก็ไม่แสดง */
  label?: string
  /** ข้อความหลักของสถานะ */
  heading: ReactNode
  /** danger = ขอบแดง ใช้กับสถานะที่ต้องยืนยันคำเตือน */
  tone?: StepCardTone
  /** วางก่อน heading */
  notice?: ReactNode
  reference: NodeReference
  manualLabel?: string
  children?: ReactNode
}

/** เขียนชื่อคลาสเต็ม เพราะ Tailwind หาชื่อคลาสจากข้อความในไฟล์ ต่อชื่อด้วยตัวแปรไม่ได้ */
const TONE_CLASSES: Record<StepCardTone, string> = {
  default: 'border border-line',
  danger: 'border-2 border-danger',
}

export function StepCard({
  label,
  heading,
  tone = 'default',
  notice,
  reference,
  manualLabel,
  children,
}: StepCardProps) {
  const classes = ['rounded-xl bg-panel p-5 md:p-6', TONE_CLASSES[tone]].join(' ')

  return (
    <section className={classes}>
      {label !== undefined && <p className="mb-2 text-sm text-ink-soft">{label}</p>}

      {notice !== undefined && <div className="mb-4">{notice}</div>}

      {/*
        heading รับโฟกัสได้ด้วยโค้ด (tabIndex={-1}) แต่กด Tab มาไม่ถึง
        หน้าตรวจอาการ (ขั้น 7) จะย้ายโฟกัสมาที่นี่เมื่อเปลี่ยนสถานะ
        โปรแกรมอ่านหน้าจอจึงอ่านข้อความของสถานะใหม่ทันที
        aria-live="polite" รอให้อ่านสิ่งที่ค้างอยู่จบก่อน ไม่พูดแทรก
        outline-none เพราะกรอบโฟกัสบนหัวข้อไม่ช่วยอะไร ผู้ใช้กดที่นี่ไม่ได้
      */}
      <h2 tabIndex={-1} aria-live="polite" className="text-lg leading-relaxed outline-none">
        {heading}
      </h2>

      {children !== undefined && <div className="mt-5">{children}</div>}

      <ReferenceLine reference={reference} manualLabel={manualLabel} />
    </section>
  )
}
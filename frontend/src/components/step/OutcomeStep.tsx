import type { ReactNode } from 'react'
import type { OutcomeKind } from '../../api/types'
import { OUTCOME_TITLES } from '../../lib/labels'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

/**
 * สถานะสิ้นสุด (resolution หรือ escalation) — จบการตรวจอาการ ไม่มีทางไปต่อ
 *
 * outcomeKind บอกว่าจบแบบไหน
 *   user_fixed        ผู้ใช้แก้เองได้แล้ว
 *   normal_behavior   เครื่องไม่ได้เสีย เป็นพฤติกรรมปกติ
 *   handoff_informed  ส่งต่อศูนย์บริการ พร้อมข้อมูลให้ช่าง เช่น รหัสข้อผิดพลาด
 *   handoff_unknown   เดินมาถึงกรณีที่คู่มือไม่ครอบคลุม ระบบจึงไม่เดาต่อ
 *
 * กล่องนี้ไม่มีปุ่มของตัวเอง ปุ่ม "ตรวจอาการอื่น" กับ "เริ่มอาการนี้ใหม่" ต้องใช้
 * router และการเริ่ม session ใหม่ ซึ่งเป็นงานของหน้าตรวจอาการ (ขั้น 7)
 * จึงรับเข้ามาทาง prop actions แทน กล่องจะได้ไม่ต้องรู้จัก API
 */
interface OutcomeStepProps extends Pick<StepProps, 'node' | 'manualLabel'> {
  actions?: ReactNode
}

/** สีของไอคอนและหัวข้อ เขียนชื่อคลาสเต็มเพราะ Tailwind ต่อชื่อด้วยตัวแปรไม่ได้ */
const OUTCOME_COLOR_CLASSES: Record<OutcomeKind, string> = {
  user_fixed: 'text-success',
  normal_behavior: 'text-info',
  handoff_informed: 'text-accent',
  handoff_unknown: 'text-accent',
}

const OUTCOME_ICONS: Record<OutcomeKind, IconName> = {
  user_fixed: 'success',
  normal_behavior: 'info',
  handoff_informed: 'wrench',
  handoff_unknown: 'wrench',
}

export function OutcomeStep({ node, manualLabel, actions }: OutcomeStepProps) {
  /**
   * สถานะสิ้นสุดทุกตัวในข้อมูลมี outcomeKind (ตรวจแล้ว 29/29 สถานะ)
   * ถ้าวันหนึ่งหายไป ให้ถือเป็น handoff_unknown เพราะเป็นทางที่ปลอดภัยที่สุด
   * ระบบไม่ควรบอกว่า "แก้ได้แล้ว" ในกรณีที่ไม่รู้ว่าจบแบบไหน
   */
  const kind: OutcomeKind = node.outcomeKind ?? 'handoff_unknown'
  const headingClasses = ['flex items-start gap-2 font-semibold', OUTCOME_COLOR_CLASSES[kind]].join(' ')

  return (
    <StepCard
      heading={
        <span className={headingClasses}>
          {/* mt-1 จัดไอคอนให้ตรงกับบรรทัดแรกของหัวข้อ เมื่อหัวข้อยาวจนขึ้นบรรทัดใหม่ */}
          <Icon name={OUTCOME_ICONS[kind]} className="mt-1 h-5 w-5 shrink-0" />
          {OUTCOME_TITLES[kind]}
        </span>
      }
      reference={node.reference}
      manualLabel={manualLabel}
    >
      <p className="leading-relaxed">{node.text}</p>
      {actions !== undefined && <div className="mt-5 space-y-3">{actions}</div>}
    </StepCard>
  )
}
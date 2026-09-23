import type { ReactNode } from 'react'
import { CheckpointStep } from './CheckpointStep'
import { InputStep } from './InputStep'
import { InstructionStep } from './InstructionStep'
import { OutcomeStep } from './OutcomeStep'
import { SafetyGateStep } from './SafetyGateStep'
import type { StepProps } from './stepProps'

/**
 * เลือกกล่องให้ตรงกับสถานะปัจจุบัน — ผู้เรียกใช้แค่ชิ้นนี้ชิ้นเดียว
 *
 * ลำดับการเลือก
 *   1. node.isTerminal                  → OutcomeStep
 *   2. node.requiresSafetyConfirmation  → SafetyGateStep
 *   3. node.type                        → CheckpointStep / InputStep / อื่นๆ เป็น InstructionStep
 *
 * ทำไมดูค่า flag ก่อน type: isTerminal และ requiresSafetyConfirmation เป็นค่าที่
 * เซิร์ฟเวอร์คำนวณมาให้แล้ว ถือเป็นคำตอบสุดท้าย หน้าจอไม่ต้องคิดซ้ำจาก type
 * ถ้าดู type ก่อน instruction ที่ต้องยืนยันคำเตือนจะหลุดไปเป็นกล่อง "ถัดไป" ธรรมดา
 *
 * ⚠️ ผู้เรียกต้องใส่ key={node.nodeId} ให้ชิ้นนี้เสมอ
 * เพื่อให้ state ในกล่อง (ช่องติ๊กคำเตือน ค่าที่พิมพ์ในช่องกรอก) ล้างทุกครั้งที่เปลี่ยนสถานะ
 */
interface StepViewProps extends StepProps {
  /** ปุ่มของสถานะสิ้นสุด ส่งต่อให้ OutcomeStep (สถานะแบบอื่นไม่ใช้) */
  outcomeActions?: ReactNode
}

export function StepView({ outcomeActions, ...stepProps }: StepViewProps) {
  const { node } = stepProps

  if (node.isTerminal) {
    return <OutcomeStep node={node} manualLabel={stepProps.manualLabel} actions={outcomeActions} />
  }

  if (node.requiresSafetyConfirmation) {
    return <SafetyGateStep {...stepProps} />
  }

  if (node.type === 'checkpoint') {
    return <CheckpointStep {...stepProps} />
  }

  if (node.type === 'input') {
    return <InputStep {...stepProps} />
  }

  // instruction ธรรมดา และเป็นทางสำรองถ้าเจอ type ที่ไม่รู้จัก
  // (resolution / escalation ไม่มาถึงบรรทัดนี้ เพราะ isTerminal จับไปแล้ว)
  return <InstructionStep {...stepProps} />
}
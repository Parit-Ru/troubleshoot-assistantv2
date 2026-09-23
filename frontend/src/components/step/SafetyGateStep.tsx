import { useState } from 'react'
import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

/**
 * สถานะแบบขั้นตอนที่ต้องยืนยันคำเตือนก่อน (instruction ที่ safety_critical)
 *
 * ⚠️ ช่องติ๊กในกล่องนี้ "ไม่ใช่" ตัวบังคับความปลอดภัย
 * ตัวบังคับจริงอยู่ที่ resolveNextNode ฝั่งเซิร์ฟเวอร์ ซึ่งรับเฉพาะ { type: 'confirm_safety' }
 * ถ้าใครแก้โค้ดหน้าจอให้ส่ง { type: 'continue' } มาแทน เซิร์ฟเวอร์จะปฏิเสธและสถานะไม่ขยับ
 *
 * ช่องติ๊กมีไว้เพื่อประสบการณ์ใช้งาน: หลังกด "ถัดไป" ติดกันหลายครั้ง นิ้วจะกด
 * ตำแหน่งเดิมโดยไม่อ่าน ช่องติ๊กบังคับให้เปลี่ยนท่าทาง ผู้ใช้จึงต้องหยุดอ่านก่อน
 */
export function SafetyGateStep({ node, onAction, isPending, manualLabel }: StepProps) {
  /**
   * ติ๊กแล้วหรือยัง เก็บในกล่องนี้ เพราะไม่มีใครอื่นต้องรู้
   *
   * ต้องเริ่มจากว่างทุกครั้งที่เปลี่ยนสถานะ ตัวที่ทำให้เป็นแบบนั้นคือ key={node.nodeId}
   * ที่ผู้เรียกใส่ให้ (หน้าตรวจอาการในขั้น 7 และหน้า gallery) — เมื่อ key เปลี่ยน
   * React ทิ้งกล่องเดิมแล้วสร้างใหม่ state จึงกลับเป็น false
   *
   * ถ้าไม่มี key: ผังขั้นตอน indicator_blinking มีสถานะที่ต้องยืนยันสองสถานะติดกัน
   * (n_power_off แล้ว n_power_back_on) React จะใช้กล่องเดิมซ้ำ ช่องติ๊กจะค้างเป็นติ๊ก
   * มาจากสถานะแรก ผู้ใช้กดยืนยันสถานะที่สองได้เลยโดยไม่ได้อ่านคำเตือนใหม่
   */
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <StepCard
      label={STEP_KIND_LABELS.safety_instruction}
      tone="danger"
      // คำเตือนมาก่อนข้อความขั้นตอน ผู้ใช้ต้องเห็นอันตรายก่อนรู้ว่าจะให้ทำอะไร
      notice={
        <Notice tone="danger" title="คำเตือนก่อนทำขั้นตอนนี้">
          {node.safetyWarning}
        </Notice>
      }
      heading={node.text}
      reference={node.reference}
      manualLabel={manualLabel}
    >
      <div className="space-y-4">
        {/*
          ใช้ <input type="checkbox"> จริง ไม่ทำช่องติ๊กปลอมจาก div
          เพราะได้การกด Space, โปรแกรมอ่านหน้าจอ และการกดที่ข้อความมาฟรี
          <label> ห่อทั้งช่องและข้อความ แตะตรงไหนของแถวก็ติ๊กได้ (สูง 48px ขึ้นไป)
          คลาส focus-visible ชุดเดียวกับ Button ให้กรอบโฟกัสเป็นสีส้มเหมือนกันทั้งหน้า
        */}
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={isPending}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
          />
          <span>ฉันอ่านคำเตือนแล้ว และจะทำตามก่อนลงมือ</span>
        </label>

        <Button
          variant="primary"
          disabled={!acknowledged || isPending}
          onClick={() => onAction({ type: 'confirm_safety' })}
        >
          ยืนยันและทำขั้นตอนนี้
        </Button>
      </div>
    </StepCard>
  )
}
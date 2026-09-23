import { useState } from 'react'
import type { NodeReference } from '../../api/types'
import { formatSourceLine } from '../../lib/reference'
import { Button } from '../ui/Button'

/**
 * บรรทัดบอกที่มาของขั้นตอน อยู่ล่างสุดของกล่องขั้นตอนทุกกล่อง
 *
 * ทุกสถานะต้องบอกที่มาได้เสมอ ตามหลักของโครงงานที่ว่าระบบไม่แต่งขั้นตอนเอง
 * บรรทัดหลักแสดงชื่อคู่มือที่คนอ่านรู้เรื่อง ส่วนรหัสเอกสารซึ่งยาวและ
 * ผู้ใช้ทั่วไปไม่ได้ใช้ ซ่อนไว้ในส่วนที่กางดูได้ สำหรับคนที่อยากตรวจย้อนกับไฟล์จริง
 */
interface ReferenceLineProps {
  reference: NodeReference
  /** เช่น 'Samsung AR70H**D1***' ไม่มีก็จะแสดงรหัสเอกสารแทนในบรรทัดหลัก */
  manualLabel?: string
}

export function ReferenceLine({ reference, manualLabel }: ReferenceLineProps) {
  // เปิดปิดเฉพาะกล่องนี้ ไม่มีใครอื่นต้องรู้ จึงเก็บเป็น state ในชิ้นนี้
  const [isCodeShown, setIsCodeShown] = useState(false)

  return (
    <div className="mt-5 border-t border-line pt-3 text-sm text-ink-faint">
      <p>{formatSourceLine(reference, manualLabel)}</p>

      <Button
        variant="text"
        // aria-expanded บอกโปรแกรมอ่านหน้าจอว่าปุ่มนี้กางหรือยุบส่วนอื่นอยู่
        aria-expanded={isCodeShown}
        onClick={() => setIsCodeShown(!isCodeShown)}
      >
        {isCodeShown ? 'ซ่อนรหัสเอกสาร' : 'ดูรหัสเอกสาร'}
      </Button>

      {isCodeShown && (
        // break-all เพราะรหัสเป็นข้อความยาวคำเดียว ถ้าไม่ตัดจะล้นขอบบนมือถือ
        <p className="mt-1 break-all font-mono text-xs">{reference.source}</p>
      )}
    </div>
  )
}
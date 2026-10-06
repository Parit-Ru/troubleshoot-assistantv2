import type { GraphSummary } from '../api/types'
import { formatScore } from '../lib/search'
import { symptomName } from '../lib/symptoms'
import { Button } from './ui/Button'

/**
 * หัวหน้าตรวจอาการ: ชื่ออาการ รุ่นเครื่อง ปุ่ม "ยกเลิกการตรวจ" และบรรทัดคะแนนความคล้าย
 *
 * รับค่าทาง props อย่างเดียว ไม่เรียก API ผู้เรียกบอกเองว่าจะให้ยกเลิกได้หรือไม่ (canAbandon)
 */
interface SessionHeaderProps {
  /** undefined = รายการอาการยังโหลดไม่เสร็จ แสดงหัวข้อชั่วคราวไปก่อน */
  summary: GraphSummary | undefined
  confidence: number | null | undefined
  canAbandon: boolean
  isAbandoning: boolean
  onAbandon: () => void
}

export function SessionHeader({
  summary,
  confidence,
  canAbandon,
  isAbandoning,
  onAbandon,
}: SessionHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{summary ? symptomName(summary) : 'ตรวจอาการ'}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {summary && (
            <>
              {summary.brand} <code className="font-mono">{summary.modelPattern}</code>
            </>
          )}
        </p>
        {canAbandon && (
          <Button variant="text" onClick={onAbandon} isLoading={isAbandoning}>
            ยกเลิกการตรวจ
          </Button>
        )}
      </div>
      {/* มีเฉพาะ session ที่เริ่มจากผลค้นหา (null/ไม่มี = เลือกจากรายการเอง ไม่แต่งตัวเลขขึ้นมา)
          เป็นข้อมูลประกอบอย่างเดียว ไม่ได้ใช้ตัดสินขั้นตอน และไม่ใช่ความน่าจะเป็น */}
      {confidence != null && (
        <p className="text-sm text-ink-faint">
          คะแนนความคล้ายกับที่พิมพ์ค้นหา <span className="font-mono">{formatScore(confidence)}</span>
          {' '}(แสดงเป็นข้อมูลประกอบเท่านั้น ขั้นตอนถัดไปตัดสินตามคู่มือ)
        </p>
      )}
    </div>
  )
}

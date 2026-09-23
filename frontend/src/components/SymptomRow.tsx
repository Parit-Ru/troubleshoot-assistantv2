import type { GraphSummary } from '../api/types'
import { symptomName } from '../lib/symptoms'
import { Icon } from './ui/Icon'

/**
 * แถวอาการหนึ่งแถวในหน้าเลือกอาการ
 *
 * component นี้ไม่เรียก API เอง รับข้อมูลผ่าน props แล้วแจ้งออกผ่าน onSelect
 * หน้า SymptomsPage เป็นคนตัดสินใจว่าจะเริ่ม session เมื่อไร
 */
interface SymptomRowProps {
  summary: GraphSummary
  /** แถวนี้กำลังเริ่ม session */
  isStarting: boolean
  /** มีแถวอื่นกำลังเริ่มอยู่ แถวนี้จึงกดไม่ได้ */
  disabled: boolean
  onSelect: (graphId: string) => void
}

/**
 * แถวมี 3 สภาพ
 * - idle      กดได้ตามปกติ
 * - starting  แถวที่ถูกกด กดซ้ำไม่ได้ แต่ไม่จาง เพื่อให้เห็นชัดว่าแถวไหนกำลังทำงาน
 * - disabled  แถวอื่นระหว่างรอ จางลงและกดไม่ได้
 */
type RowState = 'idle' | 'starting' | 'disabled'

/** เขียนชื่อคลาสเต็มทุกคำ เพราะ Tailwind หาชื่อคลาสจากข้อความในไฟล์ ต่อชื่อด้วยตัวแปรไม่ได้ */
const STATE_CLASSES: Record<RowState, string> = {
  idle: 'hover:bg-panel',
  starting: 'cursor-wait',
  disabled: 'cursor-not-allowed opacity-40',
}

const BASE_CLASSES =
  'flex min-h-12 w-full items-center gap-3 px-1 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function SymptomRow({ summary, isStarting, disabled, onSelect }: SymptomRowProps) {
  // isStarting มาก่อน เผื่อผู้เรียกส่ง true มาทั้งคู่ แถวที่กดจะยังแสดงตัวหมุน
  const state: RowState = isStarting ? 'starting' : disabled ? 'disabled' : 'idle'
  const classes = [BASE_CLASSES, STATE_CLASSES[state]].join(' ')

  return (
    <li className="border-b border-line">
      <button
        type="button"
        // ปิดปุ่มทั้งแถวที่กำลังเริ่มและแถวอื่น กันกดซ้ำจนได้ session สองอัน
        disabled={state !== 'idle'}
        aria-busy={isStarting || undefined}
        className={classes}
        onClick={() => onSelect(summary.graphId)}
      >
        {/* min-w-0 ทำให้ข้อความยาวขึ้นบรรทัดใหม่ได้ แทนที่จะดันไอคอนตกขอบ */}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{symptomName(summary)}</span>
          {/* ชื่ออังกฤษ = หัวข้อเดียวกับในคู่มือ ใช้เทียบกับคู่มือได้ */}
          <span className="block text-sm text-ink-faint">{summary.entrySymptom}</span>
        </span>

        {isStarting ? (
          <span className="flex shrink-0 items-center gap-2 text-sm text-accent">
            <Icon name="spinner" className="h-4 w-4 animate-spin" />
            กำลังเริ่ม
          </span>
        ) : (
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
        )}
      </button>
    </li>
  )
}
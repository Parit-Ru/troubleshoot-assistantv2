import type { ReactNode } from 'react'
import type { OutcomeKind, RenderedNode } from '../../api/types'
import type { TrailEntry, TrailMarker } from '../../lib/trail'
import { Icon } from '../ui/Icon'

/**
 * เส้นทางการตรวจ — เส้นแนวตั้งทางซ้ายที่ร้อยทุกขั้นที่ผ่านมากับขั้นปัจจุบันเข้าด้วยกัน
 * เป็นส่วนเดียวที่ดีไซน์ตั้งใจให้โดดเด่น
 *
 * แสดงผลอย่างเดียว ไม่มีปุ่ม กดรายการเก่าไม่ได้ และไม่มีทางย้อนกลับ
 * เพราะกลไกควบคุมเครื่องสถานะไม่มีคำสั่งย้อน
 *
 * การจัดวาง
 *   - แต่ละรายการเว้นซ้าย (pl-8 บนจอใหญ่ pl-10) ไว้เป็นคอลัมน์ของเส้นกับสัญลักษณ์ กว้าง 24px (w-6)
 *   - เส้นและสัญลักษณ์วางด้วย absolute กึ่งกลางอยู่ที่ 12px จากซ้ายเท่ากัน
 *     เส้นใช้ left-3 (12px) แล้วเลื่อนกลับครึ่งความกว้างตัวเอง (-translate-x-1/2)
 *     สัญลักษณ์อยู่ในกล่อง w-6 ที่จัดกึ่งกลางด้วย flex
 *   - เส้นแบ่งเป็นท่อน ท่อนละรายการ แต่ละท่อนสูงเต็มรายการ (top-0 bottom-0)
 *     ระยะห่างระหว่างรายการจึงต้องใช้ padding (pb-6) ไม่ใช่ margin ไม่งั้นเส้นจะขาด
 *   - สัญลักษณ์มีพื้น bg-canvas ทับเส้นด้านหลัง เส้นจึงดูเหมือนเข้าไปต่อที่จุด
 */

interface PathRailProps {
  entries: TrailEntry[]
  /** สถานะปัจจุบัน ใช้เลือกสัญลักษณ์ของจุดล่างสุด */
  current: RenderedNode
  /** กล่องขั้นตอนปัจจุบัน (StepView) */
  children: ReactNode
}

/** สีของสี่เหลี่ยมที่สถานะสิ้นสุด ใช้สีชุดเดียวกับหัวข้อใน OutcomeStep */
const OUTCOME_MARKER_CLASSES: Record<OutcomeKind, string> = {
  user_fixed: 'bg-success',
  normal_behavior: 'bg-info',
  handoff_informed: 'bg-accent',
  handoff_unknown: 'bg-accent',
}

const LINE_CLASSES = 'absolute left-3 w-px -translate-x-1/2 bg-ink-faint/50'

/** กล่องที่ใช้จัดสัญลักษณ์ให้อยู่กึ่งกลางคอลัมน์ พื้น bg-canvas บังเส้นด้านหลัง */
const MARKER_BOX_CLASSES = 'absolute left-0 flex w-6 items-center justify-center bg-canvas'

/** สัญลักษณ์ของขั้นที่ผ่านมาแล้ว */
function PastMarker({ marker }: { marker: TrailMarker }) {
  if (marker === 'switch-off') {
    return <Icon name="switch-off" className="h-5 w-3 text-ink-faint" />
  }
  return <span className="h-3 w-3 rounded-full border-2 border-ink-faint" />
}

/**
 * สัญลักษณ์ของขั้นปัจจุบัน เลือกตามลำดับนี้
 *   1. สถานะสิ้นสุด             → สี่เหลี่ยมเล็ก สีตามว่าจบแบบไหน
 *   2. ต้องยืนยันคำเตือนก่อนไปต่อ → สวิตช์เปิดสีแดง (ยืนยันแล้วจะกลายเป็นสวิตช์ปิดบนเส้นทาง)
 *   3. ขั้นอื่นทั้งหมด            → วงกลมทึบสีหลัก
 */
function CurrentMarker({ node }: { node: RenderedNode }) {
  if (node.isTerminal) {
    // ไม่มี outcomeKind ให้ถือเป็น handoff_unknown แบบเดียวกับ OutcomeStep
    const kind: OutcomeKind = node.outcomeKind ?? 'handoff_unknown'
    return <span className={`h-3 w-3 rounded-sm ${OUTCOME_MARKER_CLASSES[kind]}`} />
  }
  if (node.requiresSafetyConfirmation) {
    return <Icon name="switch-on" className="h-5 w-3 text-danger" />
  }
  return <span className="h-3 w-3 rounded-full bg-accent" />
}

export function PathRail({ entries, current, children }: PathRailProps) {
  const hasPast = entries.length > 0

  return (
    <ol aria-label="เส้นทางการตรวจ">
      {entries.map((entry, index) => (
        /*
          key ใช้ลำดับประกอบด้วย ไม่ใช้ nodeId อย่างเดียว เพราะ nodeId ซ้ำได้
          เช่น กรอกรหัสผิดแล้ววนกลับมาที่ช่องกรอกเดิม (n_record_code) สองรอบ
          รายการนี้เติมต่อท้ายอย่างเดียว ไม่มีการลบหรือสลับ ลำดับจึงไม่เปลี่ยน
        */
        <li key={`${index}-${entry.nodeId}`} className="relative pb-6 pl-8 md:pl-10">
          {/* ท่อนแรกเริ่มที่จุด ไม่ให้มีเส้นโผล่เหนือจุดแรก */}
          <span aria-hidden className={`${LINE_CLASSES} bottom-0 ${index === 0 ? 'top-3' : 'top-0'}`} />

          {/* h-6 เท่ากับความสูงบรรทัด (leading-6) จุดจึงตรงกับบรรทัดแรกของข้อความ */}
          <span aria-hidden className={`${MARKER_BOX_CLASSES} top-0 h-6`}>
            <PastMarker marker={entry.marker} />
          </span>

          {/* ข้อความเก่าตัดที่ 2 บรรทัด ส่วนคำตอบแสดงเต็มเสมอ */}
          <p className="line-clamp-2 text-sm leading-6 text-ink-soft">{entry.text}</p>
          <p className="text-sm leading-6 text-ink">{entry.answerLabel}</p>
        </li>
      ))}

      <li aria-current="step" className="relative pl-8 md:pl-10">
        {/* ท่อนเชื่อมจากรายการก่อนหน้าลงมาถึงจุดปัจจุบัน ไม่มีเส้นต่อลงไปข้างล่าง */}
        {hasPast && <span aria-hidden className={`${LINE_CLASSES} top-0 h-6 md:h-7`} />}

        {/*
          จัดจุดให้ตรงกับบรรทัดป้ายชนิด (เช่น "คำถาม") ในกล่องขั้นตอน
          กล่องเว้นขอบบน 20px (p-5) บนจอใหญ่ 24px (md:p-6) และป้ายสูง 20px
          กล่องสัญลักษณ์สูง 20px (h-5) จึงวางที่ top-5 และ md:top-6 ให้กึ่งกลางตรงกัน
        */}
        <span aria-hidden className={`${MARKER_BOX_CLASSES} top-5 h-5 md:top-6`}>
          <CurrentMarker node={current} />
        </span>

        {children}
      </li>
    </ol>
  )
}
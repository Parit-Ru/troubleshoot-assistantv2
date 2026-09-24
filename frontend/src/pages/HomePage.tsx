import { useNavigate } from 'react-router-dom'
import { useGraphs } from '../api/queries'
import type { RenderedNode } from '../api/types'
import { PathRail } from '../components/step/PathRail'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { DEVICE_CATEGORY_LABELS, STEP_KIND_LABELS } from '../lib/labels'
import { formatSourceLine } from '../lib/reference'
import { groupSymptoms } from '../lib/symptoms'
import { toTrailEntry } from '../lib/trail'
import { checkpointNode, safetyGateNode } from '../mocks/fixtures'

/**
 * หน้าแรก
 *
 * เป็นหน้าแรกที่ผู้ใช้และกรรมการเห็น หน้าที่คือบอกด้วยภาษาผู้ใช้ทั่วไปว่าระบบทำอะไร
 * และต่างจากการถาม AI ตรงไหน จึงไม่ใช้ศัพท์เทคนิค และไม่ใส่ตัวเลขสถิติใดๆ
 * (ไม่มีข้อมูลจริงรองรับ)
 *
 * มี 3 ส่วน
 *   1. ข้อความแนะนำ + ปุ่มไปหน้าเลือกอาการ
 *   2. "รองรับตอนนี้" ดึงจากข้อมูลจริง ไม่พิมพ์ตายตัว เพิ่มเครื่องใหม่แล้วขึ้นเอง
 *   3. ภาพตัวอย่างเส้นทางการตรวจ เป็นภาพนิ่ง กดอะไรไม่ได้
 */

// ============================================================
// ข้อมูลของภาพตัวอย่าง
// ============================================================

/**
 * ตัวอย่างนี้คือเส้นทางจริงของอาการ "แอร์ไม่ทำงาน เปิดไม่ติด" 3 ขั้น
 *   n1 เครื่องได้รับไฟฟ้าอยู่หรือไม่?  → ตอบ ใช่
 *   n2 เบรกเกอร์ตัดอยู่หรือไม่?        → ตอบ ใช่
 *   n_fix_breaker สับเบรกเกอร์กลับขึ้น (ขั้นที่ต้องยืนยันคำเตือน)
 *
 * fixtures.ts มีสถานะ n2 กับ n_fix_breaker อยู่แล้ว แต่ยังไม่มี n1
 * จึงสร้าง n1 ที่นี่จาก n2 โดยเปลี่ยนแค่รหัสกับข้อความ
 * ข้อความ n1 คัดลอกจาก data/manuals/samsung_ac_ar70h.json ตรงๆ
 * ส่วนที่มา (คู่มือหน้า 43) เหมือน n2 ทุกอย่าง ตรวจกับข้อมูลแล้ว
 */
const POWER_CHECKPOINT: RenderedNode = {
  ...checkpointNode,
  nodeId: 'n1',
  text: 'เครื่องได้รับไฟฟ้าอยู่หรือไม่? (ตรวจปลั๊ก/เต้ารับ)',
}

/**
 * สองขั้นที่ผ่านมาแล้ว สร้างด้วย toTrailEntry ตัวเดียวกับที่หน้าตรวจอาการใช้
 * ข้อความ "ตอบ ใช่" จึงมาจากที่เดียวกัน ไม่ได้พิมพ์ซ้ำในไฟล์นี้
 * คำนวณครั้งเดียวนอกฟังก์ชัน เพราะค่าไม่เปลี่ยน
 */
const SAMPLE_TRAIL = [
  toTrailEntry(POWER_CHECKPOINT, { type: 'answer', value: 'yes' }),
  toTrailEntry(checkpointNode, { type: 'answer', value: 'yes' }),
]

/** ชื่ออาการและคู่มือที่ใช้เขียนคำกำกับภาพตัวอย่าง (ค่าจากข้อมูลอาการเดียวกับด้านบน) */
const SAMPLE_SYMPTOM_NAME = 'แอร์ไม่ทำงาน เปิดไม่ติด'
const SAMPLE_MANUAL_LABEL = 'Samsung AR70H**D1***'

// ============================================================
// หน้าจอ
// ============================================================

export function HomePage() {
  const graphs = useGraphs()
  const navigate = useNavigate()

  /**
   * จัดกลุ่มเมื่อโหลดสำเร็จเท่านั้น ที่เหลือ (กำลังโหลด / โหลดไม่สำเร็จ) ให้เป็นรายการว่าง
   * กำลังโหลดแสดงข้อความรอ ส่วนโหลดไม่สำเร็จหรือไม่มีข้อมูลซ่อนทั้งส่วน
   * ไม่ขึ้นกล่องแดง เพราะหน้าแรกยังใช้งานได้ และหน้าเลือกอาการแจ้งข้อผิดพลาดเองอยู่แล้ว
   */
  const groups = graphs.isSuccess ? groupSymptoms(graphs.data) : []
  const showSupported = graphs.isPending || groups.length > 0

  return (
    /*
      จอเล็ก เรียงบนลงล่าง: ข้อความแนะนำ → ภาพตัวอย่าง → รองรับตอนนี้ (ภาพตัวอย่างอยู่ใต้ปุ่ม)
      จอ lg: ขึ้นไป แบ่งสองคอลัมน์ ข้อความแนะนำกับ "รองรับตอนนี้" ซ้อนกันทางซ้าย
      ภาพตัวอย่างอยู่ขวา สูงข้ามสองแถว ลำดับใน HTML จึงไม่ตรงกับตำแหน่งบนจอใหญ่ ต้องระบุตำแหน่งเอง
      แถวล่าง 1fr = ให้แถวล่างรับความสูงที่เหลือ ไม่ให้ช่องว่างไปโผล่ระหว่างสองส่วนทางซ้าย
    */
    <div className="grid gap-10 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-10">
      {/* ---------- 1. ข้อความแนะนำ ---------- */}
      <section className="space-y-5 lg:col-start-1 lg:row-start-1">
        {/* แยกสองบรรทัดด้วย block เพื่อไม่ให้เบราว์เซอร์ตัดกลางวลี */}
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
          <span className="block">ตรวจอาการทีละขั้น</span>
          <span className="block text-accent">ตามคู่มือของผู้ผลิต</span>
        </h1>

        <p className="text-ink-soft">
          เลือกอาการของเครื่องใช้ไฟฟ้าที่พบ แล้วตอบคำถามทีละข้อ ลำดับขั้นตอนมาจากคู่มือ
          ไม่ได้ให้ AI เดาเอาเอง ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องยืนยันคำเตือนก่อนทุกครั้ง
          และทุกขั้นบอกหน้าคู่มือที่มา
        </p>

        <Button onClick={() => navigate('/symptoms')}>เลือกอาการที่พบ</Button>
      </section>

      {/* ---------- 3. ภาพตัวอย่าง (อยู่ตรงกลางในลำดับ HTML แต่ไปคอลัมน์ขวาบนจอใหญ่) ---------- */}
      <figure className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <figcaption className="text-sm text-ink-soft">
          ตัวอย่างจากอาการ {SAMPLE_SYMPTOM_NAME}
        </figcaption>

        {/*
          ใช้ PathRail จริง แต่ไม่ใช้ StepView หรือ StepCard สำหรับกล่องขั้นตอน
          เพราะ StepView มีปุ่มที่กดได้จริง แต่กดแล้วไม่มีอะไรเกิดขึ้น
          และ StepCard มีปุ่ม "ดูรหัสเอกสาร" ที่กดได้ในภาพที่ควรเป็นภาพนิ่ง
          จึงเขียนกล่องอ่านอย่างเดียวขึ้นมาเองด้านล่าง หน้าตาเหมือน StepCard ที่ใช้ tone="danger"
        */}
        <PathRail entries={SAMPLE_TRAIL} current={safetyGateNode}>
          <div className="rounded-xl border-2 border-danger bg-panel p-5 md:p-6">
            <p className="mb-2 text-sm text-ink-soft">{STEP_KIND_LABELS.safety_instruction}</p>

            <div className="mb-4">
              <Notice tone="danger" title="คำเตือนก่อนทำขั้นตอนนี้">
                {safetyGateNode.safetyWarning}
              </Notice>
            </div>

            <p className="text-lg leading-relaxed">{safetyGateNode.text}</p>

            <p className="mt-5 text-sm text-ink-soft">
              ต้องยืนยันว่าอ่านคำเตือนแล้ว จึงจะไปขั้นต่อไปได้
            </p>

            <p className="mt-5 border-t border-line pt-3 text-sm text-ink-faint">
              {formatSourceLine(safetyGateNode.reference, SAMPLE_MANUAL_LABEL)}
            </p>
          </div>
        </PathRail>
      </figure>

      {/* ---------- 2. รองรับตอนนี้ ---------- */}
      {showSupported && (
        <section className="space-y-3 lg:col-start-1 lg:row-start-2">
          <h2 className="font-semibold">รองรับตอนนี้</h2>

          {graphs.isPending && (
            <p className="flex items-center gap-2 text-ink-soft">
              <Icon name="spinner" className="h-5 w-5 animate-spin" />
              กำลังโหลด
            </p>
          )}

          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={`${group.deviceCategory}|${group.brand}|${group.modelPattern}`}>
                <p>
                  {DEVICE_CATEGORY_LABELS[group.deviceCategory]} {group.brand}{' '}
                  <code className="font-mono">{group.modelPattern}</code>
                </p>
                <p className="text-sm text-ink-soft">{group.symptoms.length} อาการ</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
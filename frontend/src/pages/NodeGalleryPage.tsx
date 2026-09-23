import { useState } from 'react'
import type { TraversalAction } from '../api/types'
import { StepView } from '../components/step/StepView'
import { allFixtureNodes } from '../mocks/fixtures'

/**
 * หน้ารวมตัวอย่างสถานะ (gallery)
 *
 * แสดงกล่องขั้นตอนทั้ง 8 แบบจาก mocks/fixtures.ts ผ่าน StepView ตัวเดียวกับหน้าจริง
 * ใช้ตรวจหน้าตาก่อนมี REST API และใช้ถ่ายภาพหน้าจอลงรายงาน
 *
 * หน้านี้ไม่เรียก API เลย กดปุ่มแล้วแค่แสดงว่าถ้าเป็นหน้าจริงจะส่ง action อะไรไปเซิร์ฟเวอร์
 * ข้อความทุกข้อความในกล่องคัดลอกจากข้อมูลจริง ไม่ได้แต่งขึ้น (ดู fixtures.ts)
 *
 * route คือ "/gallery" ไม่อยู่ในเมนู เข้าได้จากการพิมพ์ URL เท่านั้น
 * ชื่อไฟล์ยังใช้คำว่า Node ตามชื่อในโค้ด (NodeGalleryPage = หน้ารวมตัวอย่างสถานะ)
 */

/** ชื่อคู่มือที่หน้าตรวจอาการจะหามาจาก GraphSummary ในหน้านี้ใส่ค่าคงที่ไว้ */
const MANUAL_LABEL = 'Samsung AR70H**D1***'

export function NodeGalleryPage() {
  /**
   * action ล่าสุดของแต่ละกล่อง เก็บแยกตาม nodeId (รหัสของสถานะ)
   * ข้อความจะขึ้นใต้กล่องที่กด ไม่ปนกับกล่องอื่น
   */
  const [lastActions, setLastActions] = useState<Record<string, string>>({})

  function showAction(nodeId: string, action: TraversalAction) {
    setLastActions({ ...lastActions, [nodeId]: JSON.stringify(action) })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ตัวอย่างสถานะ</h1>
        <p className="text-ink-soft">
          กล่องขั้นตอนทั้ง 8 แบบ ข้อความจากคู่มือจริง กดปุ่มได้ แต่หน้านี้ไม่ส่งอะไรไปเซิร์ฟเวอร์
        </p>
      </div>

      <ul className="space-y-8">
        {allFixtureNodes.map((node) => (
          // key={node.nodeId} แบบเดียวกับหน้าตรวจอาการ ให้ state ในกล่องผูกกับสถานะของมัน
          <li key={node.nodeId} className="space-y-2">
            <p className="font-mono text-xs text-ink-faint">{node.nodeId}</p>

            <StepView
              node={node}
              onAction={(action) => showAction(node.nodeId, action)}
              isPending={false}
              manualLabel={MANUAL_LABEL}
            />

            {lastActions[node.nodeId] !== undefined && (
              // aria-live ให้โปรแกรมอ่านหน้าจออ่านผลเมื่อกดปุ่ม
              <p aria-live="polite" className="break-all font-mono text-xs text-ink-soft">
                เมื่อกดจริงจะส่ง: {lastActions[node.nodeId]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
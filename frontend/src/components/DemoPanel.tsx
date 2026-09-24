import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import type { RenderedNode } from '../api/types'
import { ApiError } from '../api/http'
import { queryKeys } from '../api/queries'
import { getSession, submitAction } from '../api/traversal'
import { Button } from './ui/Button'

/**
 * แผงสาธิตด่านความปลอดภัย — เครื่องมือสำหรับสอบ ไม่ใช่ส่วนของผู้ใช้ทั่วไป
 *
 * แสดงเมื่อ URL มี ?demo=1 เท่านั้น ไม่มีลิงก์ในเมนู
 *
 * สิ่งที่แผงนี้ทำ: ส่ง { type: 'continue' } ไปที่สถานะที่ต้องยืนยันคำเตือน
 * โดยไม่ผ่านช่องติ๊กบนหน้าจอเลย เหมือนคนที่แก้โค้ดหน้าเว็บเพื่อข้ามด่าน
 * แล้วแสดงสามอย่าง: สถานะ HTTP, code ที่เซิร์ฟเวอร์ตอบ, และ nodeId ก่อนกับหลังส่ง
 *
 * ⚠️ ข้อจำกัด
 * ในโหมดจำลอง (VITE_USE_MOCK=true) โค้ดที่ปฏิเสธคำขอรันอยู่ในเบราว์เซอร์เดียวกับคนกด
 * ผลที่ได้จึงพิสูจน์แค่ว่ากลไกควบคุมเครื่องสถานะปฏิเสธถูกต้อง
 * ยังพิสูจน์ไม่ได้ว่า "เซิร์ฟเวอร์" บังคับด่านนี้ ต้องรอ REST API แล้วสาธิตซ้ำ (ขั้น 10.2)
 * แผงจึงแสดงคำเตือนนี้เองทุกครั้งที่อยู่ในโหมดจำลอง
 *
 * แผงนี้ไม่ใช้ useSubmitAction เพราะไม่อยากให้ผลของการสาธิตไปปนกับ
 * สถานะกำลังส่งและข้อผิดพลาดของกล่องขั้นตอนหลัก
 */

interface DemoPanelProps {
  sessionId: string
  node: RenderedNode
}

interface DemoResult {
  /** null = ไม่ได้คำตอบจากเซิร์ฟเวอร์เลย หรือเกิด error ที่ไม่ใช่ ApiError */
  status: number | null
  code: string
  nodeIdBefore: string
  /** null = ดึงสถานะล่าสุดไม่สำเร็จ */
  nodeIdAfter: string | null
}

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export function DemoPanel({ sessionId, node }: DemoPanelProps) {
  // hook ทุกตัวต้องเรียกก่อน return null ด้านล่าง ลำดับการเรียก hook ห้ามเปลี่ยนระหว่าง render
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [result, setResult] = useState<DemoResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  if (searchParams.get('demo') !== '1') {
    return null
  }

  async function runBypass() {
    setIsRunning(true)
    setResult(null)
    const nodeIdBefore = node.nodeId

    // 1. ส่ง continue โดยไม่ยืนยันคำเตือน
    let status: number | null = null
    let code: string
    try {
      await submitAction(sessionId, { type: 'continue' })
      status = 200
      code = 'ACCEPTED'
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status
        code = error.code
      } else {
        code = 'UNKNOWN_ERROR'
      }
    }

    // 2. ถามเซิร์ฟเวอร์อีกครั้งว่าตอนนี้อยู่สถานะไหน ไม่เชื่อค่าที่หน้าจอถืออยู่
    let nodeIdAfter: string | null
    try {
      const latest = await getSession(sessionId)
      nodeIdAfter = latest.node.nodeId
    } catch {
      nodeIdAfter = null
    }

    // 3. ให้หน้าหลักดึงสถานะใหม่ด้วย ถ้าเซิร์ฟเวอร์ขยับจริง หน้าจอต้องไม่ค้างขั้นเก่า
    await queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) })

    setResult({ status, code, nodeIdBefore, nodeIdAfter })
    setIsRunning(false)
  }

  const blocked = result !== null && result.status === 400 && result.nodeIdAfter === result.nodeIdBefore

  return (
    <section className="rounded-xl border border-dashed border-ink-faint/60 p-4 text-sm text-ink-soft">
      <h2 className="font-semibold text-ink">แผงสาธิตด่านความปลอดภัย</h2>
      <p className="mt-1">
        ส่งคำสั่งไปต่อโดยไม่ติ๊กยืนยันคำเตือน เหมือนคนที่แก้โค้ดหน้าเว็บเพื่อข้ามด่าน
      </p>

      {IS_MOCK ? (
        <p className="mt-2 text-accent">
          ตอนนี้เป็นโหมดจำลอง กลไกควบคุมเครื่องสถานะรันอยู่ในเบราว์เซอร์นี้
          ผลด้านล่างจึงยังไม่ใช่หลักฐานว่าเซิร์ฟเวอร์บังคับด่านนี้
        </p>
      ) : (
        <p className="mt-2 break-all">ส่งไปที่ {import.meta.env.VITE_API_URL}</p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
        <dt>nodeId</dt>
        <dd className="break-all text-ink">{node.nodeId}</dd>
        <dt>type</dt>
        <dd className="text-ink">{node.type}</dd>
        <dt>requiresSafetyConfirmation</dt>
        <dd className="text-ink">{String(node.requiresSafetyConfirmation)}</dd>
      </dl>

      <Button
        variant="secondary"
        className="mt-4"
        onClick={runBypass}
        disabled={!node.requiresSafetyConfirmation}
        isLoading={isRunning}
      >
        ส่ง continue โดยไม่ยืนยัน
      </Button>
      {!node.requiresSafetyConfirmation && (
        <p className="mt-2 text-xs">ปุ่มนี้กดได้เฉพาะสถานะที่ต้องยืนยันคำเตือน</p>
      )}

      {result !== null && (
        <div aria-live="polite" className="mt-4 space-y-1 font-mono text-xs">
          <p>
            HTTP {result.status ?? '—'} <span className="text-ink">{result.code}</span>
          </p>
          <p>
            nodeId ก่อนส่ง: <span className="text-ink">{result.nodeIdBefore}</span>
          </p>
          <p>
            nodeId หลังส่ง: <span className="text-ink">{result.nodeIdAfter ?? 'ดึงสถานะล่าสุดไม่สำเร็จ'}</span>
          </p>
          <p className={blocked ? 'font-sans text-sm text-success' : 'font-sans text-sm text-danger'}>
            {blocked
              ? 'ถูกปฏิเสธ และสถานะไม่ขยับ'
              : 'ผลไม่ตรงกับที่คาด — ด่านความปลอดภัยอาจไม่ทำงาน ต้องตรวจสอบ'}
          </p>
        </div>
      )}
    </section>
  )
}
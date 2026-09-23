import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/http'
import { useGraphs, useStartSession } from '../api/queries'
import { SymptomRow } from '../components/SymptomRow'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { groupSymptoms } from '../lib/symptoms'

/**
 * หน้าเลือกอาการ
 *
 * ดึงรายการอาการ (1 อาการ = เครื่องสถานะ 1 ชุด) มาจัดกลุ่มตามเครื่อง
 * กดแถวไหน = เริ่ม session ของอาการนั้น แล้วไปหน้าตรวจอาการ
 */

/** รอนานเกินเท่านี้ (มิลลิวินาที) จึงบอกว่าเซิร์ฟเวอร์อาจกำลังตื่น */
const SLOW_WAIT_MS = 4000

export function SymptomsPage() {
  const graphs = useGraphs()
  const startSession = useStartSession()
  const navigate = useNavigate()

  /**
   * graphId ของแถวที่กด เก็บเองเพราะ useStartSession บอกได้แค่ว่ากำลังเริ่มอยู่
   * แต่ไม่บอกว่าเริ่มของแถวไหน
   */
  const [startingId, setStartingId] = useState<string | null>(null)
  const isStarting = startSession.isPending

  /**
   * เริ่ม session ใน onClick เท่านั้น ห้ามย้ายไปไว้ใน useEffect
   * เพราะ StrictMode ในโหมด dev เรียก effect สองรอบ จะได้ session สองอัน
   *
   * ไม่ต้อง GET session ซ้ำหลังเริ่ม เพราะ useStartSession ใส่ผลลงแคชให้แล้ว
   * หน้าตรวจอาการจึงแสดงได้ทันที
   */
  function handleSelect(graphId: string) {
    setStartingId(graphId)
    startSession.mutate(graphId, {
      onSuccess: (session) => navigate(`/session/${session.sessionId}`),
    })
  }

  // ---------- รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า ----------
  const isWaiting = graphs.isPending || isStarting
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    if (!isWaiting) return
    const timer = setTimeout(() => setIsSlow(true), SLOW_WAIT_MS)
    // ทำงานเมื่อเลิกรอ (isWaiting เปลี่ยน) หรือออกจากหน้า
    // ล้างนาฬิกาที่ยังไม่ครบเวลา และซ่อนกล่องรอนาน
    return () => {
      clearTimeout(timer)
      setIsSlow(false)
    }
  }, [isWaiting])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">เลือกอาการที่พบ</h1>
        <p className="text-ink-soft">
          เลือกอาการที่ใกล้เคียงที่สุด ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น
        </p>
      </div>

      {isSlow && (
        <Notice tone="info" title="เซิร์ฟเวอร์กำลังเริ่มทำงาน">
          ถ้าไม่มีคนใช้มาสักพัก เซิร์ฟเวอร์ต้องตื่นก่อน อาจใช้เวลาสักครู่
        </Notice>
      )}

      {graphs.isPending && (
        <p className="flex items-center gap-2 text-ink-soft">
          <Icon name="spinner" className="h-5 w-5 animate-spin" />
          กำลังโหลดรายการอาการ
        </p>
      )}

      {graphs.isError && (
        <ErrorNotice error={graphs.error}>
          <Button variant="secondary" className="mt-3" onClick={() => graphs.refetch()}>
            ลองอีกครั้ง
          </Button>
        </ErrorNotice>
      )}

      {graphs.isSuccess && graphs.data.length === 0 && (
        <p className="text-ink-soft">ยังไม่มีอาการให้เลือก</p>
      )}

      {graphs.isSuccess && graphs.data.length > 0 && (
        <div className="space-y-6">
          {/* เริ่มไม่สำเร็จ: แสดงบนสุดของรายการ ทุกแถวกดได้อีกครั้งเพราะ isPending กลับเป็น false */}
          {startSession.isError && <ErrorNotice error={startSession.error} />}

          {groupSymptoms(graphs.data).map((group) => (
            <section key={`${group.deviceCategory}|${group.brand}|${group.modelPattern}`}>
              <h2 className="font-semibold">{DEVICE_CATEGORY_LABELS[group.deviceCategory]}</h2>
              <p className="text-sm text-ink-soft">
                {group.brand} <code className="font-mono">{group.modelPattern}</code>
              </p>

              <ul className="mt-2 border-t border-line">
                {group.symptoms.map((summary) => (
                  <SymptomRow
                    key={summary.graphId}
                    summary={summary}
                    isStarting={isStarting && startingId === summary.graphId}
                    disabled={isStarting && startingId !== summary.graphId}
                    onSelect={handleSelect}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * กล่องแจ้งข้อผิดพลาด ใช้ร่วมกันทั้งตอนโหลดรายการไม่ได้ และตอนเริ่ม session ไม่ได้
 * - เชื่อมต่อไม่ได้ (NETWORK_ERROR) → บอกให้ลองใหม่
 * - เซิร์ฟเวอร์ตอบกลับมาว่าผิดพลาด → แสดง HTTP status ไว้ใช้ไล่หาสาเหตุ
 *
 * ใช้แค่ในหน้านี้ จึงไม่แยกไฟล์ ถ้าหน้าอื่นต้องใช้ค่อยย้ายไป components
 */
function ErrorNotice({ error, children }: { error: Error; children?: ReactNode }) {
  const isNetwork = error instanceof ApiError && error.code === 'NETWORK_ERROR'

  if (isNetwork) {
    return (
      <Notice tone="danger" title="เชื่อมต่อเซิร์ฟเวอร์ไม่ได้">
        ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง
        {children}
      </Notice>
    )
  }

  const status = error instanceof ApiError ? `HTTP ${error.status}` : error.message
  return (
    <Notice tone="danger" title="เกิดข้อผิดพลาด">
      เซิร์ฟเวอร์ตอบกลับผิดปกติ ({status})
      {children}
    </Notice>
  )
}
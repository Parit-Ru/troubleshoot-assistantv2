import { useEffect, useState } from 'react'

/** รอนานเกินเท่านี้ (มิลลิวินาที) จึงบอกว่าเซิร์ฟเวอร์อาจกำลังตื่น */
const SLOW_WAIT_MS = 4000

/**
 * บอกว่ารอเซิร์ฟเวอร์นานเกินไปหรือยัง ใช้กับหน้าที่ต้องแสดงกล่อง "เซิร์ฟเวอร์กำลังเริ่มทำงาน"
 * (เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า)
 *
 * @param isWaiting true = ตอนนี้กำลังรอเซิร์ฟเวอร์อยู่
 * @returns true เมื่อรอต่อเนื่องเกิน SLOW_WAIT_MS และยังไม่เลิกรอ
 */
export function useSlowWait(isWaiting: boolean): boolean {
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

  return isSlow
}

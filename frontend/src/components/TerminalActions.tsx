import { Button } from './ui/Button'

/**
 * ปุ่มสองปุ่มท้ายหน้าจบ: "ตรวจอาการอื่น" กับ "เริ่มอาการนี้ใหม่"
 *
 * กดได้เสมอ ไม่ขึ้นกับว่าผู้ใช้กรอกผลลัพธ์หรือไม่
 * รับฟังก์ชันทาง props เพราะการไปหน้าอื่นและการเริ่ม session ใหม่เป็นงานของหน้าตรวจอาการ
 */
interface TerminalActionsProps {
  onOtherSymptom: () => void
  onRestart: () => void
  isRestarting: boolean
}

export function TerminalActions({ onOtherSymptom, onRestart, isRestarting }: TerminalActionsProps) {
  return (
    <>
      <Button variant="primary" className="w-full" onClick={onOtherSymptom}>
        ตรวจอาการอื่น
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        onClick={onRestart}
        isLoading={isRestarting}
      >
        เริ่มอาการนี้ใหม่
      </Button>
    </>
  )
}

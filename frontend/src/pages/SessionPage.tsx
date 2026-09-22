import { useParams } from 'react-router-dom'

/**
 * หน้าตรวจอาการ — ฉบับชั่วคราวของขั้น 4
 *
 * route คือ "/session/:sessionId" ส่วน :sessionId ใน URL จะถูกอ่านออกมาด้วย useParams()
 * ตอนนี้แค่แสดงค่าที่อ่านได้ เพื่อทดสอบว่า route ที่มีพารามิเตอร์ทำงานถูก
 * ตัวจริงจะส่ง sessionId ต่อให้ useSession() เพื่อดึงสถานะปัจจุบันของเครื่องสถานะมาแสดง
 */
export function SessionPage() {
  // ชนิดเป็น string | undefined เพราะ TypeScript ไม่รู้ว่าหน้านี้ถูกผูกกับ route ที่มี :sessionId เสมอ
  const { sessionId } = useParams()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">ตรวจอาการ</h1>
      <p className="text-ink-soft">หน้าชั่วคราว — ขั้นตอนการตรวจจะมาในขั้นถัดไป</p>
      <p className="text-sm text-ink-soft">
        รหัส session: <code className="font-mono text-ink">{sessionId ?? '(ไม่มี)'}</code>
      </p>
    </div>
  )
}
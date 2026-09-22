import { Link } from 'react-router-dom'

/**
 * หน้าแรก — ฉบับชั่วคราวของขั้น 4
 *
 * มีไว้ให้ route "/" มีอะไรแสดง และให้ทดสอบโครงแอป (AppShell) กับการเปลี่ยนหน้าได้
 * เนื้อหาจริงจะเขียนแทนทั้งไฟล์ในขั้นที่ทำหน้าแรก
 */
export function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">หน้าแรก</h1>
      <p className="text-ink-soft">หน้าชั่วคราว — เนื้อหาจริงจะมาในขั้นถัดไป</p>
      <Link to="/symptoms" className="text-accent underline-offset-4 hover:underline">
        ไปหน้าเลือกอาการ
      </Link>
    </div>
  )
}
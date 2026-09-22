import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'

/**
 * หน้าที่แสดงเมื่อเปิด URL ที่ไม่มีอยู่ในแอป เช่น พิมพ์ผิด หรือลิงก์เก่าที่เลิกใช้แล้ว
 *
 * route คือ path="*" ใน App.tsx ต้องวางไว้เป็นเส้นสุดท้าย
 * (react-router เลือก route ที่ตรงที่สุดให้เองอยู่แล้ว แต่วางท้ายสุดจะอ่านง่ายกว่า)
 *
 * หน้านี้ไม่ใช่หน้าที่แสดงตอนหา session ไม่เจอ
 * กรณีนั้น URL ถูกต้อง แต่เซิร์ฟเวอร์ตอบ SESSION_NOT_FOUND ซึ่ง SessionPage ต้องจัดการเอง
 */
export function NotFoundPage() {
  // pathname คือส่วนหลัง # เช่น "/sympotms" ใช้บอกผู้ใช้ว่าเปิดอะไรมา
  const { pathname } = useLocation()

  return (
    <div className="space-y-4">
      <Icon name="warning" className="h-8 w-8 text-accent" />
      <h1 className="text-2xl font-semibold">ไม่พบหน้านี้</h1>
      <p className="text-ink-soft">
        ไม่มีหน้า <code className="break-all font-mono text-ink">{pathname}</code> ในระบบ
        ลิงก์อาจพิมพ์ผิดหรือเลิกใช้แล้ว
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/" className="text-accent underline-offset-4 hover:underline">
          กลับหน้าแรก
        </Link>
        <Link to="/symptoms" className="text-accent underline-offset-4 hover:underline">
          ไปหน้าเลือกอาการ
        </Link>
      </div>
    </div>
  )
}
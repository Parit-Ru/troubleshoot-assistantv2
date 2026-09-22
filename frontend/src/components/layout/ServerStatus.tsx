import { useHealth } from '../../api/queries'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

/**
 * ป้ายเล็กๆ บอกว่าตอนนี้เชื่อมต่อเซิร์ฟเวอร์ได้ไหม มี 5 แบบ
 *
 * - mock      โหมดจำลอง ไม่มีเซิร์ฟเวอร์ให้เช็ค จึงไม่เรียก /health เลย
 * - checking  กำลังรอ /health ตอบ
 * - ok        เซิร์ฟเวอร์และฐานข้อมูลปกติ
 * - degraded  เซิร์ฟเวอร์ตอบได้ แต่ต่อฐานข้อมูลไม่ได้
 * - offline   เรียก /health ไม่สำเร็จ เช่น เซิร์ฟเวอร์ดับ เน็ตหลุด หรือไม่ได้ตั้ง VITE_API_URL
 */

type ServerState = 'mock' | 'checking' | 'ok' | 'degraded' | 'offline'

/** ข้อความ ไอคอน และสีของแต่ละแบบ ชื่อคลาสเขียนเต็มด้วยเหตุผลเดียวกับ Button.tsx */
const STATES: Record<ServerState, { label: string; icon: IconName; color: string }> = {
  mock: { label: 'โหมดจำลอง', icon: 'info', color: 'text-info' },
  checking: { label: 'กำลังเชื่อมต่อเซิร์ฟเวอร์', icon: 'spinner', color: 'text-ink-faint' },
  ok: { label: 'เซิร์ฟเวอร์พร้อมใช้งาน', icon: 'success', color: 'text-success' },
  degraded: { label: 'ฐานข้อมูลของเซิร์ฟเวอร์มีปัญหา', icon: 'warning', color: 'text-accent' },
  offline: { label: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', icon: 'warning', color: 'text-danger' },
}

export function ServerStatus() {
  // ต้องเรียก hook ทุกครั้งก่อน if ใดๆ เพราะกฎของ React ห้ามเรียก hook แบบมีเงื่อนไข
  // ในโหมดจำลอง useHealth ตั้ง enabled: false ไว้แล้ว จึงไม่ยิง request จริง
  const health = useHealth()

  // เลือกแบบตามลำดับ ต้องเช็คโหมดจำลองก่อน
  // เพราะ query ที่ปิดไว้จะค้างสถานะ pending ตลอด ถ้าเช็คทีหลังจะขึ้นว่า "กำลังเชื่อมต่อ" ไม่มีวันจบ
  let state: ServerState
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    state = 'mock'
  } else if (health.isPending) {
    state = 'checking'
  } else if (health.isError) {
    state = 'offline'
  } else if (health.data.status === 'degraded') {
    state = 'degraded'
  } else {
    state = 'ok'
  }

  const { label, icon, color } = STATES[state]

  return (
    // role="status" ให้โปรแกรมอ่านหน้าจออ่านข้อความใหม่เมื่อสถานะเปลี่ยน โดยไม่ขัดสิ่งที่กำลังอ่านอยู่
    // title แสดงสาเหตุจริงของ error เมื่อเอาเมาส์ชี้ ช่วยตอนหาบั๊ก เช่น ลืมตั้ง VITE_API_URL
    <div
      role="status"
      title={health.error?.message}
      className={`flex items-center gap-2 text-xs ${color}`}
    >
      <Icon name={icon} className={state === 'checking' ? 'h-4 w-4 shrink-0 animate-spin' : 'h-4 w-4 shrink-0'} />
      <span>{label}</span>
    </div>
  )
}
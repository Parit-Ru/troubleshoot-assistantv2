import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * กล่องข้อความแจ้งเตือน มี 4 สี
 *
 * - info     ฟ้า  ข้อมูลทั่วไป เช่น "ตอนนี้เป็นโหมดจำลอง"
 * - success  เขียว แก้ปัญหาได้แล้ว (สถานะสิ้นสุดแบบ resolution)
 * - accent   ส้ม  เรื่องที่ควรสังเกต เช่น ส่งต่อศูนย์บริการ (สถานะสิ้นสุดแบบ escalation)
 * - danger   แดง  คำเตือนความปลอดภัยของสถานะที่ safety_critical
 *
 * กล่องนี้แค่แสดงผล ไม่มีช่องติ๊กหรือปุ่มยืนยันในตัว
 * ด่านความปลอดภัย (ติ๊กแล้วกด) จะประกอบในหน้า SessionPage โดยวางช่องติ๊กไว้ใน children
 */

export type NoticeTone = 'info' | 'success' | 'accent' | 'danger'

/**
 * ชื่อคลาสของแต่ละสี เขียนเต็มทุกคำด้วยเหตุผลเดียวกับ Button.tsx
 * /10 และ /40 คือความทึบ 10% และ 40% พื้นจึงเป็นสีจางๆ ไม่แย่งสายตาจากตัวอักษร
 */
const TONE_CLASSES: Record<NoticeTone, { box: string; accent: string }> = {
  info: { box: 'border-info/40 bg-info/10', accent: 'text-info' },
  success: { box: 'border-success/40 bg-success/10', accent: 'text-success' },
  accent: { box: 'border-accent/40 bg-accent/10', accent: 'text-accent' },
  danger: { box: 'border-danger/40 bg-danger/10', accent: 'text-danger' },
}

/** ไอคอนปกติของแต่ละสี เปลี่ยนได้ด้วย prop icon เช่น ส่งต่อช่างใช้ wrench */
const DEFAULT_ICONS: Record<NoticeTone, IconName> = {
  info: 'info',
  success: 'success',
  accent: 'warning',
  danger: 'warning',
}

interface NoticeProps {
  tone: NoticeTone
  /** หัวข้อสั้นๆ ตัวหนา (ไม่ใส่ก็ได้) */
  title?: string
  /** ใช้ไอคอนอื่นแทนไอคอนปกติของสีนั้น */
  icon?: IconName
  /** เนื้อความ ใส่ข้อความหรือองค์ประกอบอื่นได้ เช่น ช่องติ๊ก */
  children?: ReactNode
  /** คลาสเพิ่มเรื่องตำแหน่ง เช่น mt-4 ไม่ใช้เปลี่ยนสี */
  className?: string
}

export function Notice({ tone, title, icon, children, className }: NoticeProps) {
  const toneClasses = TONE_CLASSES[tone]
  const boxClasses = ['flex gap-3 rounded-lg border p-4 text-sm', toneClasses.box, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={boxClasses}>
      {/* mt-0.5 ขยับไอคอนลงให้ตรงกับบรรทัดแรกของข้อความ */}
      <Icon name={icon ?? DEFAULT_ICONS[tone]} className={`mt-0.5 h-5 w-5 shrink-0 ${toneClasses.accent}`} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className={`font-semibold ${toneClasses.accent}`}>{title}</p>}
        {children && <div className="text-ink">{children}</div>}
      </div>
    </div>
  )
}
import type { ComponentProps } from 'react'
import { Icon } from './Icon'

/**
 * ปุ่มของทั้งแอป มี 4 แบบ
 *
 * - primary   ปุ่มส้ม ใช้กับการกระทำหลักของหน้า เช่น "เริ่มวินิจฉัย" หรือ "ยืนยันแล้ว ไปต่อ"
 * - secondary ปุ่มขอบเทา ใช้กับการกระทำรอง เช่น "ยกเลิก"
 * - answer    ปุ่มกว้างเต็มแถว ใช้ตอบคำถามของสถานะแบบ checkpoint เช่น "ใช่" / "ไม่ใช่"
 * - text      ตัวอักษรอย่างเดียว ใช้กับลิงก์เล็กๆ เช่น "ดูหน้าคู่มือ"
 *
 * isLoading = กำลังรอเซิร์ฟเวอร์ตอบ ปุ่มจะแสดงตัวหมุนและกดซ้ำไม่ได้
 * กันผู้ใช้กดเบิ้ลแล้วส่งคำตอบเดียวกันสองครั้ง
 */

export type ButtonVariant = 'primary' | 'secondary' | 'answer' | 'text'

/**
 * ชื่อคลาสของแต่ละแบบ เขียนเต็มทุกคำ ห้ามต่อสตริง เช่น `bg-${color}`
 * เพราะ Tailwind หาคลาสที่ต้องสร้างโดยอ่านข้อความในไฟล์ตรงๆ
 * ถ้าชื่อคลาสถูกประกอบตอนโปรแกรมทำงาน Tailwind จะมองไม่เห็นและไม่สร้าง CSS ให้
 *
 * padding และการจัดตำแหน่งอยู่ในแต่ละแบบ ไม่อยู่ในคลาสพื้นฐาน
 * เพราะถ้ามี px-4 กับ px-0 ในปุ่มเดียวกัน ตัวไหนชนะขึ้นกับลำดับใน CSS ไม่ใช่ลำดับที่เขียน
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // ตัวอักษรบนปุ่มส้มต้องเป็น text-canvas เสมอ ห้าม text-white (อ่านยากบนสีส้ม)
  primary: 'justify-center rounded-lg bg-accent px-4 py-2 font-semibold text-canvas enabled:hover:brightness-110',
  secondary: 'justify-center rounded-lg border border-line bg-panel px-4 py-2 text-ink enabled:hover:border-ink-faint',
  answer:
    'w-full justify-start rounded-lg border border-line bg-panel px-4 py-3 text-left text-ink enabled:hover:border-accent',
  text: 'justify-center px-0 py-1 text-ink-soft underline-offset-4 enabled:hover:text-ink enabled:hover:underline',
}

/** คลาสที่ทุกแบบใช้ร่วมกัน */
const BASE_CLASSES =
  'inline-flex items-center gap-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

/**
 * รับ attribute ทุกตัวของ <button> ปกติได้ (onClick, disabled, aria-*, ...)
 * แล้วเพิ่ม variant กับ isLoading
 */
interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  isLoading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  // className จากผู้เรียก (ถ้ามี) ต่อท้าย ใช้เพิ่มเรื่องตำแหน่ง เช่น mt-4 ไม่ใช้เปลี่ยนสี
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(' ')

  return (
    <button
      // ค่าปกติของ <button> คือ submit ซึ่งจะส่งฟอร์มโดยไม่ตั้งใจ จึงเปลี่ยนเป็น button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={classes}
      {...rest}
    >
      {isLoading && <Icon name="spinner" className="h-4 w-4 shrink-0 animate-spin" />}
      {children}
    </button>
  )
}
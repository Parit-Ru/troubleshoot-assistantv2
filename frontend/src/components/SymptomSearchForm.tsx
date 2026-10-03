import { useId } from 'react'
import type { FormEvent } from 'react'
import { MAX_QUERY_LENGTH, checkQuery } from '../lib/search'
import { Button } from './ui/Button'

/**
 * ช่องพิมพ์อาการ + ปุ่มค้นหา
 *
 * component นี้ไม่เรียก API เอง ผู้เรียกถือข้อความและสั่งค้นหาเอง (ผ่าน value / onSubmit)
 * ปุ่มกดได้เมื่อมีข้อความจริง (ไม่ใช่ช่องว่างล้วน) เท่านั้น
 * ส่วนการตัดสินว่าข้อความใช้ได้หรือไม่ เซิร์ฟเวอร์ตรวจซ้ำเสมอ
 */
interface SymptomSearchFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** กำลังค้นหาอยู่ ปุ่มแสดงตัวหมุนและกดซ้ำไม่ได้ */
  isSearching: boolean
  /** กำลังเริ่ม session จากแถวที่กดไปแล้ว จึงค้นหาใหม่ไม่ได้ */
  disabled: boolean
}

export function SymptomSearchForm({
  value,
  onChange,
  onSubmit,
  isSearching,
  disabled,
}: SymptomSearchFormProps) {
  // เชื่อม label กับช่องพิมพ์ ให้โปรแกรมอ่านหน้าจอรู้ว่าช่องนี้คืออะไร
  const inputId = useId()
  const canSearch = checkQuery(value) === 'ok'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์โหลดหน้าใหม่ตามค่าเริ่มต้นของ form
    event.preventDefault()
    if (canSearch && !disabled && !isSearching) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor={inputId} className="block font-semibold">
        พิมพ์อาการที่พบ
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          // ตัดที่ขีดจำกัดเดียวกับเซิร์ฟเวอร์ ผู้ใช้จึงไม่พิมพ์ยาวเกินจนเซิร์ฟเวอร์ปฏิเสธ
          maxLength={MAX_QUERY_LENGTH}
          placeholder="เช่น แอร์ไม่เย็น มีน้ำหยด รีโมทกดไม่ติด"
          autoComplete="off"
          disabled={disabled}
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-panel px-4 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={isSearching}
          disabled={!canSearch || disabled}
        >
          ค้นหา
        </Button>
      </div>
    </form>
  )
}

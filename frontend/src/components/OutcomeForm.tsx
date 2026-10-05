import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { describeError } from '../lib/errors'
import {
  MAX_OUTCOME_LENGTH,
  checkOutcome,
  formatOutcomeCounter,
  normalizeOutcome,
} from '../lib/outcome'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

/**
 * ช่องกรอกผลลัพธ์ที่หน้าสุดท้ายของการตรวจ (ทั้ง resolution และ escalation)
 *
 * component นี้ไม่เรียก API เอง หน้าตรวจอาการถือ mutation และส่งสถานะเข้ามาทาง props
 * ผู้ใช้ไม่กรอกก็ได้ ปุ่ม "ตรวจอาการอื่น" กับ "เริ่มอาการนี้ใหม่" อยู่นอกฟอร์มนี้และไม่ขึ้นกับมัน
 *
 * สองสถานะ ตัดสินจาก savedText ที่เซิร์ฟเวอร์ส่งมาเท่านั้น (ไม่มี state "บันทึกแล้ว" แยกในหน้าจอ)
 *   - ยังไม่มี  → ฟอร์ม
 *   - มีแล้ว    → ข้อความอ่านอย่างเดียว (บันทึกได้ครั้งเดียว) กด F5 แล้วเห็นเหมือนกัน
 *
 * ข้อความของผู้ใช้แสดงเป็น text ของ React เท่านั้น (ไม่ใช้ dangerouslySetInnerHTML)
 * จึงไม่มีทางที่ <script> หรือ HTML ที่พิมพ์มาจะถูกตีความ
 *
 * ไม่ใส่สีเขียว/แดงให้คำตอบ และไม่มีปุ่มเลือกคำตอบสำเร็จรูป ผู้ใช้เล่าด้วยคำพูดของตัวเอง
 * ข้อมูลที่กรอกเป็นข้อมูลบันทึกอย่างเดียว ไม่ได้ใช้ตัดสินขั้นตอนใด
 */
interface OutcomeFormProps {
  /** ข้อความที่บันทึกไว้แล้ว string = แสดงอ่านอย่างเดียว · null/undefined = ยังไม่ได้กรอก */
  savedText: string | null | undefined
  /** ส่งข้อความที่ตัดช่องว่างแล้ว (เรียกเมื่อผ่านการตรวจเบื้องต้นแล้วเท่านั้น) */
  onSubmit: (text: string) => void
  /** กำลังบันทึก ปุ่มแสดงตัวหมุนและกดซ้ำไม่ได้ */
  isSending: boolean
  /** ข้อผิดพลาดของการบันทึกครั้งล่าสุด (null = ไม่มี) */
  error: Error | null
  /** ดึงสถานะล่าสุดจากเซิร์ฟเวอร์ ใช้กับข้อผิดพลาดแบบ reload-session */
  onRefresh: () => void
}

const TEXTAREA_CLASSES =
  'w-full resize-y rounded-lg border border-line bg-canvas px-4 py-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

export function OutcomeForm({ savedText, onSubmit, isSending, error, onRefresh }: OutcomeFormProps) {
  // เชื่อม label / คำอธิบาย / ตัวนับ กับช่องพิมพ์ ให้โปรแกรมอ่านหน้าจอรู้ว่าช่องนี้คืออะไร
  const textareaId = useId()
  const hintId = useId()
  const counterId = useId()

  const [value, setValue] = useState('')
  const isSaved = typeof savedText === 'string'

  /**
   * หลังกดบันทึก ปุ่มที่โฟกัสอยู่หายไปจากหน้า โฟกัสจะตกไปที่ body และโปรแกรมอ่านหน้าจอเงียบ
   * จึงย้ายโฟกัสไปที่ "บันทึกผลแล้ว" ให้อ่านทันที
   * แต่ไม่ย้ายตอนเปิดหน้าที่บันทึกไว้แล้ว (กด F5) เพราะไม่ใช่ผลของการกระทำของผู้ใช้
   */
  const wasSavedAtMount = useRef(isSaved)
  const savedHeadingRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (isSaved && !wasSavedAtMount.current) savedHeadingRef.current?.focus()
  }, [isSaved])

  if (isSaved) {
    return (
      <section className="space-y-2">
        <p ref={savedHeadingRef} tabIndex={-1} className="font-semibold outline-none">
          บันทึกผลแล้ว
        </p>
        {/* whitespace-pre-wrap: คงการขึ้นบรรทัดใหม่ที่ผู้ใช้พิมพ์ · break-words: คำยาวไม่ดันหน้าจอล้น */}
        <p className="whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas px-4 py-3 text-ink">
          {savedText}
        </p>
      </section>
    )
  }

  const canSubmit = checkOutcome(value) === 'ok' && !isSending
  const described = error === null ? null : describeError(error)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์โหลดหน้าใหม่ตามค่าเริ่มต้นของ form
    event.preventDefault()
    if (!canSubmit) return
    onSubmit(normalizeOutcome(value))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={textareaId} className="block font-semibold">
          ผลเป็นอย่างไรบ้าง? <span className="font-normal text-ink-faint">(ไม่บังคับ)</span>
        </label>
        <p id={hintId} className="text-sm text-ink-soft">
          ไม่ต้องใส่ข้อมูลส่วนตัว เช่น ชื่อ เบอร์โทร หรือที่อยู่ · บันทึกได้ครั้งเดียว แก้ไขภายหลังไม่ได้
        </p>
      </div>

      <div className="space-y-1">
        <textarea
          id={textareaId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // ตัดที่เพดานเดียวกับเซิร์ฟเวอร์ ผู้ใช้จึงไม่พิมพ์ยาวเกินจนเซิร์ฟเวอร์ปฏิเสธ
          maxLength={MAX_OUTCOME_LENGTH}
          rows={4}
          placeholder="เช่น ทำตามขั้นตอนแล้วแอร์กลับมาทำงานปกติ หรือยังไม่หาย"
          disabled={isSending}
          aria-describedby={`${hintId} ${counterId}`}
          className={TEXTAREA_CLASSES}
        />
        <p id={counterId} className="text-right text-xs text-ink-faint">
          {formatOutcomeCounter(value)}
        </p>
      </div>

      {described !== null && (
        <div role="alert">
          <Notice tone="danger" title={described.title}>
            <p>{described.detail}</p>
            {described.recovery === 'reload-session' && (
              <Button variant="secondary" className="mt-3" onClick={onRefresh}>
                ดึงข้อมูลล่าสุด
              </Button>
            )}
          </Notice>
        </div>
      )}

      {/* secondary: ปุ่มหลักของหน้าคือ "ตรวจอาการอื่น" การบันทึกผลเป็นของเสริม ไม่แย่งความสำคัญ */}
      <Button
        type="submit"
        variant="secondary"
        className="w-full sm:w-auto"
        isLoading={isSending}
        disabled={!canSubmit}
      >
        บันทึกผล
      </Button>
    </form>
  )
}

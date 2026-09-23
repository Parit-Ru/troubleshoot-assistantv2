import { useState } from 'react'
import type { FormEvent } from 'react'
import type { InputType } from '../../api/types'
import { INPUT_SUBMIT_LABELS, STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

/**
 * สถานะแบบกรอกข้อมูล (input) เช่น ให้กรอกรหัสข้อผิดพลาดที่หน้าจอแอร์
 *
 * ⚠️ ห้ามตรวจรูปแบบของค่าที่กรอกในหน้าจอ
 *   1. เซิร์ฟเวอร์ไม่ได้ส่งรูปแบบที่ถูกต้องมาให้ ถ้าเขียนเองจะเป็นกฎชุดที่สองที่อาจไม่ตรงกับข้อมูล
 *   2. การกรอกผิดไม่ใช่ข้อผิดพลาด แต่เป็นการเปลี่ยนสถานะ (on_invalid) ไปยังสถานะ
 *      ที่อธิบายว่ารหัสหน้าตาเป็นอย่างไร ถ้าหน้าจอกันไว้ ผู้ใช้จะไม่มีทางไปถึงสถานะนั้น
 * หน้าจอทำแค่ตัดช่องว่างหัวท้าย และไม่ให้ส่งค่าว่าง
 */

/** รหัสอ่านง่ายกว่าเมื่อทุกตัวอักษรกว้างเท่ากัน (แยก 0 กับ O, 1 กับ l ได้) */
const INPUT_FONT_CLASSES: Record<InputType, string> = {
  error_code: 'font-mono',
  model_number: 'font-mono',
  number: '',
  text: '',
}

const BASE_INPUT_CLASSES =
  'w-full rounded-lg border border-line bg-canvas px-4 py-3 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-40'

export function InputStep({ node, onAction, isPending, manualLabel }: StepProps) {
  // สถานะ input ทุกตัวควรมี inputType ถ้าไม่มีให้ถือเป็นข้อความทั่วไป
  const inputType: InputType = node.inputType ?? 'text'

  // ค่าที่พิมพ์อยู่ ล้างเองเมื่อเปลี่ยนสถานะ เพราะผู้เรียกใส่ key={node.nodeId}
  const [value, setValue] = useState('')
  const trimmed = value.trim()
  const canSubmit = trimmed !== '' && !isPending

  /**
   * ใช้ <form> เพื่อให้กด Enter ในช่องแล้วส่งได้เอง โดยไม่ต้องดักปุ่มคีย์บอร์ด
   * preventDefault กันเบราว์เซอร์โหลดหน้าใหม่ตามพฤติกรรมเดิมของฟอร์ม
   * ต้องเช็ค canSubmit ซ้ำ เพราะกด Enter ได้แม้ปุ่มถูกปิดอยู่
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    onAction({ type: 'input', value: trimmed })
  }

  const inputClasses = [BASE_INPUT_CLASSES, INPUT_FONT_CLASSES[inputType]].filter(Boolean).join(' ')

  return (
    <StepCard
      label={STEP_KIND_LABELS.input}
      heading={node.text}
      reference={node.reference}
      manualLabel={manualLabel}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
          // ช่องไม่มีป้ายที่มองเห็น จึงให้โปรแกรมอ่านหน้าจออ่านข้อความของสถานะแทน
          aria-label={node.text}
          // numeric = มือถือเปิดแป้นตัวเลข ส่วนแบบอื่นใช้แป้นปกติ
          inputMode={inputType === 'number' ? 'numeric' : 'text'}
          // ปิดการเดา แก้คำ และขึ้นตัวพิมพ์ใหญ่อัตโนมัติ เพราะรหัสไม่ใช่คำในพจนานุกรม
          // และไม่แปลงเป็นตัวพิมพ์ใหญ่ให้ ค่าที่ส่งต้องตรงกับที่ผู้ใช้เห็น
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputClasses}
        />

        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {INPUT_SUBMIT_LABELS[inputType]}
        </Button>
      </form>
    </StepCard>
  )
}
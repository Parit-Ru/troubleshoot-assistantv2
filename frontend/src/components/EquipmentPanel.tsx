import { useId, useState } from 'react'
import type { DeviceCategory, EquipmentItem } from '../api/types'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { Icon } from './ui/Icon'

/**
 * แผงอุปกรณ์ที่อาจต้องใช้ แสดงเหนือเส้นทางการตรวจในหน้าตรวจอาการ
 *
 * รายการผูกกับประเภทเครื่อง ไม่ได้ผูกกับอาการ ทุกอาการของแอร์ได้รายการเดียวกัน
 * หัวข้อจึงเขียนบอกไว้ตรงๆ ผู้ใช้จะได้ไม่เข้าใจว่าต้องใช้ครบทุกชิ้นกับอาการนี้
 *
 * ทุกชิ้นบอกที่มาเสมอ ตามหลักการของโครงงานที่ห้ามอ้างว่าคู่มือพูดสิ่งที่ไม่ได้พูด
 *   - มี sourcePage          → "คู่มือหน้า 43"
 *   - ไม่มี แต่มี authorNote → "ผู้พัฒนาแนะนำเพิ่ม"
 *
 * การพับ
 *   - มือถือ: พับไว้เป็นปุ่มแถวเดียว เพราะถ้ากาง 7 รายการ คำถามแรกจะถูกดันออกนอกจอ
 *   - จอ md: ขึ้นไป: กางเสมอ ไม่มีปุ่ม
 *   ใช้คลาส md:hidden และ md:block สลับกัน ไม่ต้องเขียนโค้ดตรวจขนาดจอเอง
 */

interface EquipmentPanelProps {
  /** ไม่มีหรือว่าง = ซ่อนทั้งแผง */
  items?: EquipmentItem[]
  /** มาจาก GraphSummary ถ้ายังโหลดไม่เสร็จ หัวข้อจะไม่มีชื่อประเภทต่อท้าย */
  deviceCategory?: DeviceCategory
}

/** บรรทัดที่มาของอุปกรณ์ 1 ชิ้น */
function EquipmentSource({ item }: { item: EquipmentItem }) {
  if (item.sourcePage !== undefined) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon name="book" className="h-3.5 w-3.5 shrink-0" />
        คู่มือหน้า {item.sourcePage}
      </p>
    )
  }
  if (item.authorNote !== undefined) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon name="pencil" className="h-3.5 w-3.5 shrink-0" />
        ผู้พัฒนาแนะนำเพิ่ม
      </p>
    )
  }
  // สัญญากับเซิร์ฟเวอร์บอกว่าต้องมีอย่างใดอย่างหนึ่งเสมอ
  // ถ้าไม่มีทั้งคู่ ไม่แสดงอะไร ดีกว่าเดาที่มาให้
  return null
}

export function EquipmentPanel({ items, deviceCategory }: EquipmentPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  // id สำหรับผูกปุ่มกับรายการ (aria-controls) useId สร้างให้ไม่ซ้ำกันทั้งหน้า
  const listId = useId()

  if (items === undefined || items.length === 0) {
    return null
  }

  const title =
    deviceCategory === undefined
      ? 'อุปกรณ์ที่อาจต้องใช้'
      : `อุปกรณ์ที่อาจต้องใช้กับ${DEVICE_CATEGORY_LABELS[deviceCategory]}`

  return (
    <section className="rounded-xl border border-line bg-panel">
      {/* มือถือ: ปุ่มพับ/กาง */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={listId}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:hidden"
      >
        <Icon name="box" className="h-5 w-5 shrink-0 text-ink-soft" />
        <span className="flex-1">
          {title} <span className="text-ink-faint">({items.length} รายการ)</span>
        </span>
        <span className="text-ink-soft">{isOpen ? 'ซ่อน' : 'แสดง'}</span>
      </button>

      {/* จอใหญ่: หัวข้อธรรมดา ไม่มีปุ่ม */}
      <h2 className="hidden items-center gap-2 px-5 pt-4 font-semibold md:flex">
        <Icon name="box" className="h-5 w-5 shrink-0 text-ink-soft" />
        {title}
      </h2>

      {/* มือถือแสดงตาม isOpen จอใหญ่แสดงเสมอ (md:block ชนะ hidden) */}
      <div id={listId} className={`${isOpen ? 'block' : 'hidden'} px-4 pb-4 md:block md:px-5`}>
        <p className="border-t border-line pt-3 text-xs text-ink-faint md:mt-1 md:border-t-0 md:pt-0">
          รายการเดียวกันสำหรับทุกอาการของเครื่องประเภทนี้
        </p>

        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.equipmentId} className="text-sm">
              <p className="font-medium">{item.nameTh}</p>
              <p className="text-ink-soft">{item.purposeTh}</p>
              <EquipmentSource item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
import type { NodeReference } from '../api/types'

/**
 * สร้างข้อความบอกที่มาของขั้นตอน
 *
 * ทุกสถานะมี `reference` ติดมาด้วยเสมอ (รหัสเอกสารคู่มือ + ช่วงหน้า)
 * ค่านี้มาจากข้อมูลผังขั้นตอนการวินิจฉัย ไม่ได้ให้ LLM สร้างขึ้นเอง
 * หน้าจอจึงแค่จัดรูปแบบข้อความ ไม่ได้แต่งเนื้อหาเพิ่ม
 */

/** ขีดยาว en dash (U+2013) ใช้คั่นช่วงตัวเลข ไม่ใช่ hyphen ที่ใช้เชื่อมคำ */
const EN_DASH = '–'

/**
 * แปลงช่วงหน้าเป็นข้อความ
 * [43, 43] → 'หน้า 43'   (สถานะส่วนใหญ่อยู่หน้าเดียว)
 * [43, 44] → 'หน้า 43–44'
 */
export function formatPages(pageRange: [number, number]): string {
  const [first, last] = pageRange
  if (first === last) return `หน้า ${first}`
  return `หน้า ${first}${EN_DASH}${last}`
}

/**
 * ข้อความที่มาแบบเต็มบรรทัด
 *
 * ใช้คำว่า "ที่มาของขั้นตอนนี้" ไม่ใช่ "อ้างอิง" เฉยๆ เพื่อผูกที่มาเข้ากับ
 * ตัวขั้นตอนโดยตรง ไม่ให้เข้าใจผิดว่าทุกข้อความในกล่องมาจากคู่มือ
 * (คำเตือนความปลอดภัยบางข้อผู้พัฒนาเขียนเอง — งานค้าง B3)
 *
 * manualLabel เช่น 'Samsung AR70H**D1***' หน้าตรวจอาการหาได้จาก GraphSummary
 * ถ้าไม่มีจะถอยไปใช้รหัสเอกสาร เพื่อให้บรรทัดนี้ไม่มีทางว่าง
 */
export function formatSourceLine(reference: NodeReference, manualLabel?: string): string {
  const manual = manualLabel === undefined ? reference.source : `คู่มือ ${manualLabel}`
  return `ที่มาของขั้นตอนนี้: ${manual} ${formatPages(reference.pageRange)}`
}
/**
 * ตรรกะเล็กๆ ของช่องกรอกผลลัพธ์ตอนการตรวจจบ (ฟังก์ชันล้วน ไม่แตะ React และไม่เรียก API)
 *
 * ตรวจฝั่งหน้าจอไว้แค่เพื่อไม่ให้กดบันทึกโดยเปล่าประโยชน์ เช่น ช่องว่างล้วน
 * เซิร์ฟเวอร์ตรวจซ้ำเสมอและเป็นผู้ตัดสิน (INVALID_OUTCOME) หน้าจอไม่ได้ป้องกันอะไรแทนเซิร์ฟเวอร์
 *
 * ผลลัพธ์เป็นข้อมูลบันทึกอย่างเดียว ไม่ผ่านเครื่องสถานะและไม่มีผลต่อขั้นตอนใด
 * จึงไม่มีการตรวจเนื้อหา (ไม่กรองคำ ไม่ตรวจข้อมูลส่วนตัว) ตรวจแค่ว่าว่างหรือยาวเกิน
 */

/**
 * ความยาวสูงสุดของข้อความผลลัพธ์ ต้องตรงกับ MAX_OUTCOME_LENGTH ใน
 * backend/src/traversal/traversal.dto.ts (ลอกมา ถ้าฝั่งนั้นเปลี่ยนต้องแก้ที่นี่ด้วย)
 *
 * นับเป็นหน่วยของ JavaScript (.length) เหมือนที่เซิร์ฟเวอร์นับ และเป็นหน่วยเดียวกับ
 * maxLength ของช่องกรอกในเบราว์เซอร์ อีโมจินับเป็น 2
 */
export const MAX_OUTCOME_LENGTH = 1000

/** ตัดช่องว่างหน้าหลัง เหมือนที่เซิร์ฟเวอร์ทำก่อนตรวจความยาวและก่อนเก็บ */
export function normalizeOutcome(raw: string): string {
  return raw.trim()
}

/**
 * ผลตรวจข้อความผลลัพธ์
 * - ok       บันทึกได้
 * - empty    ว่างหรือมีแต่ช่องว่าง (ผู้ใช้ไม่กรอกก็ได้ แต่ถ้าจะส่งต้องมีเนื้อหา)
 * - too-long ยาวเกินที่เซิร์ฟเวอร์รับ
 */
export type OutcomeCheck = 'ok' | 'empty' | 'too-long'

export function checkOutcome(raw: string): OutcomeCheck {
  const text = normalizeOutcome(raw)
  if (text === '') return 'empty'
  if (text.length > MAX_OUTCOME_LENGTH) return 'too-long'
  return 'ok'
}

/**
 * ตัวนับที่แสดงใต้ช่องกรอก เช่น "12/1000"
 * นับตามที่พิมพ์จริง (ไม่ตัดช่องว่าง) เพราะเป็นตัวเลขเทียบกับ maxLength ของช่อง
 * ซึ่งนับตัวอักษรทั้งหมดที่อยู่ในช่อง ผลที่ได้จึงไม่มีทางทำให้ข้อความที่ตัดช่องว่างแล้วยาวเกิน
 */
export function formatOutcomeCounter(raw: string): string {
  return `${raw.length}/${MAX_OUTCOME_LENGTH}`
}

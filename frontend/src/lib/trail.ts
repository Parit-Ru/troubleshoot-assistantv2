import type { RenderedNode, TraversalAction } from '../api/types'

/**
 * รายการบนเส้นทางทางซ้ายของหน้าตรวจอาการ (PathRail)
 * เก็บว่าผ่านสถานะไหนมาแล้ว และผู้ใช้ทำอะไรที่สถานะนั้น
 *
 * ข้อมูลนี้หน้าจอบันทึกเอง เซิร์ฟเวอร์ไม่ได้ส่งมา
 * ใช้แสดงผลอย่างเดียว ไม่ได้ใช้ตัดสินใจอะไรทั้งสิ้น
 * ขั้นถัดไปคืออะไร เป็นหน้าที่ของฟังก์ชันเปลี่ยนสถานะฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ผลที่ตามมา: กด F5 แล้วรายการจะหายหมด เหลือแต่ขั้นปัจจุบัน ถือว่าถูกต้องตามที่ตกลงไว้ (D7)
 */

/**
 * สัญลักษณ์หน้ารายการ
 * - dot        วงกลมกลวง ขั้นที่ผ่านแล้วทั่วไป
 * - switch-off ไอคอนสวิตช์ปิด ขั้นที่ยืนยันคำเตือนความปลอดภัยแล้ว
 */
export type TrailMarker = 'dot' | 'switch-off'

export interface TrailEntry {
  nodeId: string
  /** ข้อความของสถานะที่เพิ่งผ่าน */
  text: string
  /** สิ่งที่ผู้ใช้ทำที่สถานะนั้น เช่น "ตอบ ใช่" */
  answerLabel: string
  marker: TrailMarker
}

/**
 * @param node   สถานะ "ก่อน" ส่ง action ไม่ใช่สถานะใหม่ที่เซิร์ฟเวอร์ตอบกลับมา
 * @param action สิ่งที่เพิ่งส่งไปและเซิร์ฟเวอร์รับแล้ว
 *
 * switch ครบทั้ง 4 แบบของ TraversalAction จึงไม่มี default
 * ถ้าวันหนึ่ง engine เพิ่ม action แบบใหม่ TypeScript จะแจ้งว่าฟังก์ชันนี้คืนค่าไม่ครบ
 */
export function toTrailEntry(node: RenderedNode, action: TraversalAction): TrailEntry {
  const passed = { nodeId: node.nodeId, text: node.text }

  switch (action.type) {
    case 'answer':
      return {
        ...passed,
        answerLabel: action.value === 'yes' ? 'ตอบ ใช่' : 'ตอบ ไม่ใช่',
        marker: 'dot',
      }

    case 'continue':
      return { ...passed, answerLabel: 'ไปต่อแล้ว', marker: 'dot' }

    case 'confirm_safety':
      return { ...passed, answerLabel: 'ยืนยันคำเตือนแล้ว', marker: 'switch-off' }

    case 'input':
      // แสดงตามที่ผู้ใช้พิมพ์ ไม่แปลงหรือตรวจรูปแบบ
      // การตัดสินว่ารหัสถูกไหมเป็นหน้าที่ของกลไกควบคุมเครื่องสถานะ
      return { ...passed, answerLabel: `กรอก ${action.value}`, marker: 'dot' }
  }
}
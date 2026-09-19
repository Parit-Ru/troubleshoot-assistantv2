import type { NodeReference, RenderedNode } from '../api/types'

/**
 * โหนดตัวอย่าง 8 สถานะ ครบทุกแบบที่หน้าจอต้องรองรับ
 *
 * ข้อความทุกข้อความคัดลอกจาก data/manuals/samsung_ac_ar70h.json ตรงๆ
 * ไม่มีข้อความไหนที่แต่งขึ้นเอง เพราะภาพหน้าจอจากหน้า gallery
 * จะถูกเอาไปใช้ในรายงาน และการสร้างเนื้อหาขึ้นเองขัดหลักการของโครงงาน
 *
 * ต่างจาก mockServer.ts ที่เดินกราฟจริงเพื่อตอบว่ากดแล้วไปไหนต่อ
 * ไฟล์นี้ตอบแค่ว่ากล่องขั้นตอนแต่ละแบบหน้าตาเป็นอย่างไร
 */

const REFERENCE_P43: NodeReference = {
  source: 'RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04',
  pageRange: [43, 43],
}

const REFERENCE_P44: NodeReference = {
  source: 'RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04',
  pageRange: [44, 44],
}

/** คำถามใช่หรือไม่ใช่ — จากกราฟอาการแอร์ไม่ทำงาน */
export const checkpointNode: RenderedNode = {
  nodeId: 'n2',
  type: 'checkpoint',
  text: 'เบรกเกอร์ไฟฟ้า (circuit breaker) ตัดอยู่หรือไม่?',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: false,
  reference: REFERENCE_P43,
}

/** ขั้นตอนธรรมดา — โหนดแรกของกราฟอาการแอร์มีกลิ่นเหม็น */
export const instructionNode: RenderedNode = {
  nodeId: 'n0',
  type: 'instruction',
  text: 'ก่อนอื่น ทราบไว้ว่าไม่มีชิ้นส่วนใดในเครื่องปรับอากาศที่สร้างกลิ่นแรงด้วยตัวเอง กลิ่นที่ได้มักมาจากอากาศในห้องหรือท่อน้ำทิ้งที่สกปรก',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: false,
  reference: REFERENCE_P44,
}

/**
 * ด่านความปลอดภัย — หน้าจอที่สำคัญที่สุดของโครงงาน
 * เป็น 1 ใน 3 โหนดทั้งระบบที่ต้องยืนยันคำเตือนก่อนเดินต่อ
 */
export const safetyGateNode: RenderedNode = {
  nodeId: 'n_fix_breaker',
  type: 'instruction',
  text: 'สับเบรกเกอร์กลับขึ้น แล้วลองเปิดเครื่องใหม่',
  safetyCritical: true,
  safetyWarning:
    'ก่อนแตะเบรกเกอร์: ตรวจสอบว่ามือแห้งและยืนบนพื้นแห้ง หากเบรกเกอร์ตัดซ้ำทันทีหลังสับขึ้น ห้ามสับซ้ำอีก — ให้ติดต่อช่างไฟฟ้าทันที (อาจมีไฟฟ้าลัดวงจร)',
  requiresSafetyConfirmation: true,
  isTerminal: false,
  reference: REFERENCE_P43,
}

/** ช่องกรอก — มีจุดเดียวทั้งระบบ อยู่ในกราฟอาการหน้าจอขึ้นรหัสข้อผิดพลาด */
export const inputNode: RenderedNode = {
  nodeId: 'n_record_code',
  type: 'input',
  text: 'กรอกรหัสข้อผิดพลาดที่แสดงบนหน้าจอ เช่น E1 หรือ C4 (กรอกให้ครบทั้งตัวอักษรและตัวเลข)',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  inputType: 'error_code',
  isTerminal: false,
  reference: REFERENCE_P44,
}

/** หน้าจบแบบที่ 1 — ทำตามขั้นตอนแล้วแก้ได้จริง */
export const userFixedNode: RenderedNode = {
  nodeId: 'n_resolved',
  type: 'resolution',
  text: 'กลิ่นหายไปแล้ว — แนะนำให้ทำความสะอาดแผ่นกรองอากาศและท่อน้ำทิ้งเป็นประจำเพื่อป้องกันกลิ่นกลับมา',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: true,
  outcomeKind: 'user_fixed',
  reference: REFERENCE_P44,
}

/** หน้าจบแบบที่ 2 — เครื่องไม่ได้เสีย เป็นการทำงานปกติ */
export const normalBehaviorNode: RenderedNode = {
  nodeId: 'n_normal',
  type: 'resolution',
  text: 'นี่เป็นอาการปกติ ไม่ใช่ความเสียหาย — เกิดจากไอน้ำในอากาศควบแน่นเป็นหยดน้ำที่ผิวท่อ เมื่ออุณหภูมิหรือความชื้นภายนอกเปลี่ยนแปลงมาก ไม่ต้องดำเนินการใดๆ',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: true,
  outcomeKind: 'normal_behavior',
  reference: REFERENCE_P44,
}

/**
 * หน้าจบแบบที่ 3 — ส่งต่อช่างพร้อมข้อมูลเจาะจง
 *
 * ในไฟล์กราฟ ข้อความนี้เขียนว่า {{error_code}} แต่ที่นี่เป็นคำว่า E1 แล้ว
 * เพราะเซิร์ฟเวอร์แทนค่าให้ก่อนส่งมา ไฟล์นี้จำลองสิ่งที่หน้าจอได้รับ
 * ไม่ใช่สิ่งที่อยู่ในไฟล์กราฟ
 */
export const handoffInformedNode: RenderedNode = {
  nodeId: 'n_escalate_with_code',
  type: 'escalation',
  text: 'รหัสข้อผิดพลาด E1 บ่งชี้ปัญหาที่ต้องให้ช่างผู้เชี่ยวชาญตรวจสอบ ติดต่อศูนย์บริการ Samsung และแจ้งรหัส E1 พร้อมรุ่นเครื่อง เพื่อให้ช่างเตรียมอะไหล่ที่ถูกต้องมาได้',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: true,
  outcomeKind: 'handoff_informed',
  reference: REFERENCE_P44,
}

/** หน้าจบแบบที่ 4 — คู่มือไม่ครอบคลุมกรณีนี้ ระบบยอมรับตรงๆ แทนที่จะเดา */
export const handoffUnknownNode: RenderedNode = {
  nodeId: 'n_escalate',
  type: 'escalation',
  text: 'หากน้ำรั่วจากจุดอื่นที่ไม่ใช่จุดเชื่อมต่อท่อ อาจเป็นปัญหาการติดตั้งหรือท่อน้ำทิ้งอุดตัน แนะนำให้ติดต่อศูนย์บริการ Samsung เพื่อตรวจสอบ',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: true,
  outcomeKind: 'handoff_unknown',
  reference: REFERENCE_P44,
}

/** เรียงตามลำดับที่หน้า gallery จะแสดง */
export const allFixtureNodes: RenderedNode[] = [
  checkpointNode,
  instructionNode,
  safetyGateNode,
  inputNode,
  userFixedNode,
  normalBehaviorNode,
  handoffInformedNode,
  handoffUnknownNode,
]
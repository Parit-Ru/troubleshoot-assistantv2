import type { NodeReference, RenderedNode } from '../api/types'

/**
 * สถานะตัวอย่าง 4 แบบ: คำถาม คำแนะนำ ด่านความปลอดภัย และช่องกรอก (ไม่มีตัวอย่างของสถานะสิ้นสุด)
 *
 * ข้อความทุกข้อความคัดลอกจาก data/manuals/samsung_ac_ar70h.json ตรงๆ
 * ไม่มีข้อความไหนที่แต่งขึ้นเอง เพราะตัวอย่างเหล่านี้ถูกแสดงบนหน้าจอจริง
 * (เช่นภาพตัวอย่างในหน้าแรก) และการสร้างเนื้อหาขึ้นเองขัดหลักการของโครงงาน
 *
 * ต่างจาก mockServer.ts ที่ดำเนินการตามเครื่องสถานะจริงเพื่อตอบว่ากดแล้วไปไหนต่อ
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

/** คำถามใช่หรือไม่ใช่ — จากผังขั้นตอนอาการแอร์ไม่ทำงาน */
export const checkpointNode: RenderedNode = {
  nodeId: 'n2',
  type: 'checkpoint',
  text: 'เบรกเกอร์ไฟฟ้า (circuit breaker) ตัดอยู่หรือไม่?',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: false,
  reference: REFERENCE_P43,
}

/** ขั้นตอนธรรมดา — สถานะแรกของผังขั้นตอนอาการแอร์มีกลิ่นเหม็น */
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
 * เป็น 1 ใน 3 สถานะทั้งระบบที่ต้องยืนยันคำเตือนก่อนไปต่อ
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

/** ช่องกรอก — มีจุดเดียวทั้งระบบ อยู่ในผังขั้นตอนอาการหน้าจอขึ้นรหัสข้อผิดพลาด */
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

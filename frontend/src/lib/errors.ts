import { ApiError } from '../api/http'
import { MAX_OUTCOME_LENGTH } from './outcome'

/**
 * แปลงข้อผิดพลาดจากเซิร์ฟเวอร์เป็นข้อความที่ผู้ใช้อ่านแล้วรู้ว่าต้องทำอะไรต่อ
 *
 * ตัดสินจาก code เท่านั้น ไม่ใช้ message ที่เซิร์ฟเวอร์ส่งมา
 * เพราะ message ของกลไกควบคุมเครื่องสถานะเขียนไว้ให้นักพัฒนาอ่าน
 * เช่น มีรหัสสถานะภาษาอังกฤษปนอยู่ ผู้ใช้ทั่วไปอ่านไม่เข้าใจ
 *
 * ฟังก์ชันนี้ใช้แสดงผลอย่างเดียว ไม่ได้ตัดสินว่าขั้นตอนถัดไปคืออะไร
 */

/**
 * สิ่งที่หน้าจอควรให้ผู้ใช้ทำต่อ
 * - retry            ลองส่งคำขอเดิมอีกครั้ง
 * - reload-session   ดึงสถานะล่าสุดของการตรวจจากเซิร์ฟเวอร์มาแสดงใหม่
 * - back-to-symptoms กลับไปหน้าเลือกอาการ
 * - stay             อยู่ขั้นเดิม ไม่ต้องทำอะไรเพิ่ม
 */
export type ErrorRecovery = 'retry' | 'reload-session' | 'back-to-symptoms' | 'stay'

export interface ErrorDescription {
  title: string
  detail: string
  recovery: ErrorRecovery
  /** แสดงให้เห็นเฉพาะกรณีข้อมูลขั้นตอนไม่สมบูรณ์ (500) เพื่อให้ผู้ใช้แจ้งผู้ดูแลระบบได้ */
  code?: string
}

const UNKNOWN_ERROR: ErrorDescription = {
  title: 'เกิดข้อผิดพลาดที่ระบบไม่รู้จัก',
  detail: 'ลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้กลับไปเลือกอาการแล้วเริ่มตรวจใหม่',
  recovery: 'retry',
}

/**
 * ใช้ switch แทนตาราง Record เพราะรหัสจากเซิร์ฟเวอร์เป็น string ใดก็ได้
 * switch ตกไปที่ default เองเมื่อเจอรหัสที่ไม่รู้จัก ไม่ต้องเช็คเพิ่ม
 */
export function describeError(error: unknown): ErrorDescription {
  // Error ธรรมดา string หรือ undefined ไม่มี code ให้อ่าน จึงถือว่าไม่รู้จักทั้งหมด
  if (!(error instanceof ApiError)) {
    return UNKNOWN_ERROR
  }

  // 400 ที่ไม่มี code: Express ตอบเองเมื่อ JSON ผิดไวยากรณ์ ก่อนถึงตัวแปลง error ของเรา
  // http.ts จึงให้รหัส UNKNOWN_ERROR มา แยกจาก 500 ที่ไม่รู้สาเหตุด้วย status
  // หน้าจอเราส่ง JSON ที่ถูกต้องเสมอ กรณีนี้จึงแทบไม่เกิด แต่ถ้าเกินต้องไม่ขึ้นว่า "ระบบไม่รู้จัก"
  if (error.code === 'UNKNOWN_ERROR' && error.status === 400) {
    return {
      title: 'เซิร์ฟเวอร์อ่านคำขอไม่ได้',
      detail: 'ลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้รีเฟรชหน้าแล้วทำใหม่',
      recovery: 'retry',
    }
  }

  switch (error.code) {
    case 'NETWORK_ERROR':
      return {
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
        detail:
          'ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง ถ้าเพิ่งเปิดเว็บ เซิร์ฟเวอร์อาจใช้เวลาเริ่มทำงานสักครู่',
        recovery: 'retry',
      }

    case 'SAFETY_CONFIRMATION_REQUIRED':
      return {
        title: 'เซิร์ฟเวอร์ไม่ให้ข้ามขั้นตอนนี้',
        detail: 'อ่านคำเตือนและติ๊กยืนยันก่อน จึงจะไปขั้นถัดไปได้',
        recovery: 'stay',
      }

    case 'INVALID_ACTION':
      return {
        title: 'หน้าจอไม่ตรงกับเซิร์ฟเวอร์',
        detail: 'ขั้นตอนบนหน้าจอเก่ากว่าที่เซิร์ฟเวอร์บันทึกไว้ ดึงขั้นตอนล่าสุดมาแสดง แล้วทำต่อจากตรงนั้น',
        recovery: 'reload-session',
      }

    case 'SESSION_COMPLETED':
      return {
        title: 'การตรวจนี้จบไปแล้ว',
        detail: 'การตรวจนี้ถึงสถานะสิ้นสุดแล้ว ดึงข้อมูลล่าสุดมาแสดงเพื่อดูผลการตรวจ',
        recovery: 'reload-session',
      }

    case 'SESSION_NOT_FOUND':
      return {
        title: 'ไม่พบการตรวจนี้',
        detail: 'การตรวจนี้อาจหมดอายุหรือถูกยกเลิกไปแล้ว เลือกอาการเพื่อเริ่มตรวจใหม่',
        recovery: 'back-to-symptoms',
      }

    case 'GRAPH_NOT_FOUND':
      return {
        title: 'ไม่พบอาการนี้',
        detail: 'อาการนี้ไม่มีในระบบแล้ว เลือกอาการอื่นจากรายการ',
        recovery: 'back-to-symptoms',
      }

    // ---------- ค้นหาอาการ (POST /symptom-search) ----------

    case 'INVALID_QUERY':
      return {
        title: 'ข้อความที่พิมพ์ใช้ค้นหาไม่ได้',
        detail: 'พิมพ์อาการที่พบให้ไม่ว่างและไม่ยาวเกิน 200 ตัวอักษร แล้วลองอีกครั้ง',
        recovery: 'stay',
      }

    // กำลังโหลดโมเดล (เซิร์ฟเวอร์เพิ่งตื่น) รอสักครู่แล้วลองใหม่ได้
    case 'SEARCH_NOT_READY':
      return {
        title: 'ระบบค้นหากำลังเริ่มทำงาน',
        detail: 'รอสักครู่แล้วกดค้นหาอีกครั้ง หรือเลือกอาการจากรายการด้านล่างได้เลย',
        recovery: 'retry',
      }

    // ปิดสวิตช์อยู่หรือโหลดไม่สำเร็จ รอแล้วก็ไม่หาย ทางที่ใช้ได้คือรายการอาการเดิม
    case 'SEARCH_UNAVAILABLE':
      return {
        title: 'ระบบค้นหาไม่พร้อมใช้งานตอนนี้',
        detail: 'เลือกอาการจากรายการด้านล่างแทน ระบบจะถามทีละข้อตามคู่มือเหมือนกัน',
        recovery: 'stay',
      }

    // ---------- บันทึกผลลัพธ์ (POST /traversal/sessions/:id/outcome) ----------

    // ว่างหรือยาวเกิน (ช่องกรอกกันไว้แล้ว รหัสนี้จึงเกิดยาก) แก้ข้อความแล้วกดบันทึกใหม่ได้เลย
    case 'INVALID_OUTCOME':
      return {
        title: 'ข้อความผลลัพธ์บันทึกไม่ได้',
        detail: `พิมพ์ข้อความให้ไม่ว่างและไม่ยาวเกิน ${MAX_OUTCOME_LENGTH} ตัวอักษร แล้วกดบันทึกอีกครั้ง`,
        recovery: 'stay',
      }

    // หน้าจอแสดงช่องกรอกเฉพาะตอนจบ รหัสนี้จึงเกิดได้ต่อเมื่อหน้าจอเก่ากว่าเซิร์ฟเวอร์
    case 'SESSION_NOT_COMPLETED':
      return {
        title: 'การตรวจนี้ยังไม่จบ',
        detail: 'บันทึกผลได้เมื่อการตรวจถึงขั้นสุดท้ายแล้ว ดึงข้อมูลล่าสุดมาแสดงเพื่อดูสถานะจริง',
        recovery: 'reload-session',
      }

    // บันทึกได้ครั้งเดียว (เช่น กดจากสองแท็บ) ข้อความที่ติดอยู่คือของครั้งแรก ดึงมาดูได้
    case 'OUTCOME_ALREADY_SUBMITTED':
      return {
        title: 'การตรวจนี้บันทึกผลไปแล้ว',
        detail: 'บันทึกผลได้ครั้งเดียวต่อการตรวจ ดึงข้อมูลล่าสุดมาแสดงเพื่อดูข้อความที่บันทึกไว้',
        recovery: 'reload-session',
      }

    // สองรหัสนี้หมายถึงข้อมูลในฐานข้อมูลผิด ผู้ใช้แก้เองไม่ได้
    // ระบบหยุดไว้แทนการเดาขั้นตอนต่อ และแสดงรหัสไว้ให้แจ้งผู้ดูแลระบบ
    case 'GRAPH_NODE_MISSING':
    case 'GRAPH_SCHEMA_UNSUPPORTED':
      return {
        title: 'ข้อมูลขั้นตอนของอาการนี้ไม่สมบูรณ์',
        detail:
          'ระบบหยุดการตรวจไว้เพื่อไม่ให้แสดงขั้นตอนที่ผิด แจ้งรหัสด้านล่างให้ผู้ดูแลระบบ แล้วเลือกอาการอื่นไปก่อน',
        recovery: 'back-to-symptoms',
        code: error.code,
      }

    default:
      return UNKNOWN_ERROR
  }
}
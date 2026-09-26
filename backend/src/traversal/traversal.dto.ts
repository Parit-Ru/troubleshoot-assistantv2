/**
 * traversal.dto.ts — รูปร่างของ request/response ของ REST API
 *                    พร้อมตัวตรวจ body ที่เขียนเอง
 *
 * ไฟล์นี้ "บริสุทธิ์" เหมือนกลไกควบคุมเครื่องสถานะ: ไม่ import NestJS
 * ไม่แตะฐานข้อมูล ทำให้เทสได้เร็วโดยไม่ต้องเปิดเซิร์ฟเวอร์
 *
 * ทำไมเขียนตัวตรวจเอง ไม่ใช้ class-validator:
 *   - body ของ API นี้มีแค่ 2 แบบ และเรียบง่ายมาก
 *   - ไม่ต้องลงแพ็กเกจเพิ่ม และไม่ต้องอธิบาย decorator
 *   - เขียนเป็นฟังก์ชันธรรมดาแล้วอธิบายได้ทุกบรรทัด
 *
 * ถ้า body ผิดรูปแบบ ฟังก์ชันในไฟล์นี้โยน InvalidRequestBodyError
 * แล้ว filter (A.6) แปลงเป็น 400 INVALID_ACTION
 */

import type {
  RenderedNode,
  SessionStatus,
  TraversalAction,
} from '../traversal-engine/types';

// ============================================================
// ค่าคงที่
// ============================================================

/**
 * ความยาวสูงสุดของค่าที่ผู้ใช้กรอกในสถานะ input
 *
 * ต้องตรงกับ session_history.action_value ซึ่งเป็น VARCHAR(255)
 * ถ้าไม่ตั้งเพดานตรงนี้ การบันทึกประวัติจะล้มกลางทางเป็น 500
 * ทั้งที่จริงเป็นความผิดของ request (ควรเป็น 400)
 */
export const MAX_INPUT_LENGTH = 255;

// ============================================================
// ข้อผิดพลาด
// ============================================================

/**
 * body ของ request ผิดรูปแบบ
 *
 * เป็น error ของเราเอง ไม่ใช่ของ NestJS เพื่อให้ filter จับด้วย instanceof
 * ได้เหมือน error ของกลไกควบคุมเครื่องสถานะ (ไม่ต้องอ่านข้อความ)
 *
 * message เขียนไว้ให้นักพัฒนาอ่าน หน้าจอเลือกข้อความไทยจาก code ไม่ใช่ message
 */
export class InvalidRequestBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ============================================================
// Request: ตัวตรวจ body
// ============================================================

/** body ของ POST /traversal/sessions */
export interface StartSessionBody {
  graphId: string;
}

/**
 * ตรวจว่า body เป็น object ธรรมดา
 * (ไม่ใช่ null, ไม่ใช่ array, ไม่ใช่ string/number)
 *
 * typeof null === 'object' ใน JavaScript จึงต้องเช็ค null แยก
 */
function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidRequestBodyError('body ต้องเป็น JSON object');
  }
  return body as Record<string, unknown>;
}

/**
 * ตรวจ body ของการเริ่ม session: ต้องมี graphId เป็น string ไม่ว่าง
 *
 * ตรวจแค่ "รูปร่าง" เท่านั้น ส่วนการมีผังขั้นตอนนี้อยู่จริงหรือไม่
 * เป็นหน้าที่ของ service (ไม่พบ = 404 GRAPH_NOT_FOUND)
 */
export function parseStartSessionBody(body: unknown): StartSessionBody {
  const obj = asObject(body);
  const graphId = obj.graphId;

  if (typeof graphId !== 'string' || graphId.trim() === '') {
    throw new InvalidRequestBodyError('graphId ต้องเป็นข้อความที่ไม่ว่าง');
  }

  // สร้าง object ใหม่จาก field ที่รู้จักเท่านั้น field แปลกปลอมจึงไม่ผ่านไปต่อ
  return { graphId };
}

/**
 * ตรวจ body ของการส่ง action เข้า session
 *
 * body คือ TraversalAction ตรงๆ (ไม่ห่อด้วย object อื่น) ตามสัญญาข้อ 4
 *
 * ตรวจแค่ว่ารูปร่างเป็น action ที่ถูกต้องหรือไม่
 * ส่วน "action นี้ใช้กับสถานะปัจจุบันได้ไหม" (เช่น ส่ง answer ให้สถานะ input)
 * และ "ต้องยืนยันคำเตือนก่อนไหม" เป็นการตัดสินใจของ engine ไม่ใช่ที่นี่
 * ไฟล์นี้จึงไม่มีตรรกะการเปลี่ยนสถานะเลย
 */
export function parseTraversalAction(body: unknown): TraversalAction {
  const obj = asObject(body);

  switch (obj.type) {
    case 'answer': {
      const value = obj.value;
      if (value !== 'yes' && value !== 'no') {
        throw new InvalidRequestBodyError(
          "action 'answer' ต้องมี value เป็น 'yes' หรือ 'no'",
        );
      }
      return { type: 'answer', value };
    }

    case 'continue':
      return { type: 'continue' };

    case 'confirm_safety':
      return { type: 'confirm_safety' };

    case 'input': {
      const value = obj.value;
      if (typeof value !== 'string') {
        throw new InvalidRequestBodyError(
          "action 'input' ต้องมี value เป็นข้อความ",
        );
      }
      if (value.length > MAX_INPUT_LENGTH) {
        throw new InvalidRequestBodyError(
          `action 'input' ยาวเกิน ${MAX_INPUT_LENGTH} ตัวอักษร`,
        );
      }
      return { type: 'input', value };
    }

    default:
      // ไม่ใส่ค่าที่ผู้ใช้ส่งมาลงในข้อความ เพราะอาจยาวหรือมีอะไรแปลกปลอม
      throw new InvalidRequestBodyError(
        "type ต้องเป็น 'answer', 'continue', 'confirm_safety' หรือ 'input'",
      );
  }
}

// ============================================================
// Response
// ============================================================

/**
 * อุปกรณ์ 1 ชิ้นที่ควรเตรียมก่อนทำตามขั้นตอน
 * ผูกกับประเภทเครื่อง ไม่ได้ผูกกับอาการ
 *
 * sourcePage กับ authorNote ต้องมีอย่างน้อยหนึ่งอย่างเสมอ
 * (ตาราง equipment_usage มี CHECK บังคับไว้แล้ว)
 * เพื่อให้บอกที่มาของอุปกรณ์ได้ทุกชิ้น
 */
export interface EquipmentItemDto {
  equipmentId: string;
  nameTh: string;
  purposeTh: string;
  /** มีค่า = อ้างอิงหน้าคู่มือได้ */
  sourcePage?: number;
  /** มีค่า = ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือ */
  authorNote?: string;
}

/**
 * สิ่งที่ endpoint ของ session ทุกตัวตอบกลับ (ยกเว้น DELETE ที่ตอบ 204)
 *
 * node คือผลจาก engine ตรงๆ ห้ามดัดแปลง
 *
 * equipment เป็น field บังคับฝั่งเซิร์ฟเวอร์ (ส่งเสมอ ประเภทที่ยังไม่มีข้อมูล
 * ส่ง [] ) ส่วนฝั่งหน้าจอประกาศเป็น optional ไว้ ซึ่งรับค่านี้ได้โดยไม่ขัดกัน
 */
export interface SessionResponseDto {
  sessionId: string;
  graphId: string;
  status: SessionStatus;
  node: RenderedNode;
  equipment: EquipmentItemDto[];
}
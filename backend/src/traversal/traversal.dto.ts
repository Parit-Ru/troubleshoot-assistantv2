/**
 * traversal.dto.ts — รูปร่างของ request/response ของ REST API
 *                    พร้อมตัวตรวจ body ที่เขียนเอง
 *
 * ไฟล์นี้ "บริสุทธิ์" เหมือนกลไกควบคุมเครื่องสถานะ: ไม่ import NestJS
 * ไม่แตะฐานข้อมูล ทำให้เทสได้เร็วโดยไม่ต้องเปิดเซิร์ฟเวอร์
 *
 * ทำไมเขียนตัวตรวจเอง ไม่ใช้ class-validator:
 *   - body ของ API นี้มีแค่ 3 แบบ และเรียบง่ายมาก
 *   - ไม่ต้องลงแพ็กเกจเพิ่ม และไม่ต้องอธิบาย decorator
 *   - เขียนเป็นฟังก์ชันธรรมดาแล้วอธิบายได้ทุกบรรทัด
 *
 * ถ้า body ผิดรูปแบบ ฟังก์ชันในไฟล์นี้โยน InvalidRequestBodyError
 * แล้ว filter (A.6) แปลงเป็น 400 INVALID_ACTION
 * ยกเว้น body ของผลลัพธ์ที่ผู้ใช้กรอก (parseOutcomeBody) ที่โยน InvalidOutcomeError
 * แล้ว filter แปลงเป็น 400 INVALID_OUTCOME แยกต่างหาก
 */

import type {
  RenderedNode,
  SessionStatus,
  TraversalAction,
} from '../traversal-engine/types';
import { MAX_QUERY_LENGTH } from '../symptom-search/symptom-search.dto';

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

/**
 * ความยาวสูงสุดของข้อความผลลัพธ์ที่ผู้ใช้กรอกตอนการตรวจจบ (นับหลังตัดช่องว่างหน้าหลัง)
 *
 * นับเป็นหน่วยของ JavaScript (.length) อักขระนอก BMP เช่นอีโมจิ นับเป็น 2
 * หน้าจอใช้ค่าเดียวกันกับ maxLength ของช่องกรอก (ลอกไว้ที่ frontend ถ้าเปลี่ยนต้องแก้สองที่)
 * ไม่ผูกกับคอลัมน์โดยตรง: outcome_text เป็น TEXT (65,535 ไบต์) กว้างกว่า 1,000 ตัวอักษรมาก
 * เพดานนี้มีไว้กันข้อความยาวผิดปกติ ไม่ใช่ข้อจำกัดของฐานข้อมูล
 */
export const MAX_OUTCOME_LENGTH = 1000;

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

/**
 * body ของ POST /traversal/sessions/:id/outcome ผิดรูปแบบ
 *
 * แยกจาก InvalidRequestBodyError เพราะ filter ต้องแปลงเป็นรหัสคนละตัว (INVALID_OUTCOME)
 * หน้าจอจะได้แสดงข้อความ "ข้อความผลลัพธ์ใช้ไม่ได้" ไม่ปนกับ INVALID_ACTION
 * ที่หมายถึงหน้าจอส่งคำสั่งเดินขั้นตอนผิด
 */
export class InvalidOutcomeError extends Error {
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
  /**
   * คำที่ผู้ใช้พิมพ์ค้นหา (ไม่บังคับ) ไว้ให้เซิร์ฟเวอร์คำนวณคะแนนความมั่นใจของ session
   * ไม่ส่ง = ผู้ใช้เลือกอาการจากรายการเอง → confidence เป็น null
   */
  query?: string;
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

  // query ไม่บังคับ: ถ้าส่งมาต้องเป็นข้อความที่ไม่ว่าง และยาวไม่เกินเพดานเดียวกับการค้นหา
  // (ส่งข้อความว่างมาถือว่าผิดรูปแบบ ไม่ตีเป็น "ไม่ส่ง" เพื่อให้หน้าจอที่ผิดพลาดเห็นได้ชัด)
  if (obj.query === undefined) {
    // สร้าง object ใหม่จาก field ที่รู้จักเท่านั้น field แปลกปลอมจึงไม่ผ่านไปต่อ
    return { graphId };
  }
  if (typeof obj.query !== 'string') {
    throw new InvalidRequestBodyError('query ต้องเป็นข้อความ');
  }
  const query = obj.query.trim();
  if (query === '') {
    throw new InvalidRequestBodyError('query ต้องไม่ว่าง');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new InvalidRequestBodyError(`query ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`);
  }
  return { graphId, query };
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

/** body ของ POST /traversal/sessions/:id/outcome */
export interface OutcomeBody {
  /** ข้อความผลลัพธ์ที่ผู้ใช้กรอก ตัดช่องว่างหน้าหลังแล้ว ไม่ว่าง ไม่เกิน MAX_OUTCOME_LENGTH */
  text: string;
}

/**
 * ตรวจ body ของการบันทึกผลลัพธ์: ต้องเป็น object ที่มี text เป็นข้อความ
 * ไม่ว่างหลังตัดช่องว่าง และยาวไม่เกิน MAX_OUTCOME_LENGTH
 *
 * - ตัดช่องว่างหน้าหลังให้ ("  แก้ได้แล้ว \n" → "แก้ได้แล้ว") เก็บเฉพาะข้อความที่ตัดแล้ว
 * - ข้อความว่างหรือมีแต่ช่องว่างถือว่าผิดรูปแบบ (ผู้ใช้ไม่กรอกก็ได้ แต่ถ้าส่งมาต้องมีเนื้อหา)
 * - สร้าง object ใหม่จาก field text เท่านั้น field แปลกปลอมจึงไม่ผ่านไปต่อ
 * - ตรวจแค่ "รูปร่าง" ส่วนว่า session จบแล้วหรือยัง/เคยส่งไปแล้วหรือไม่ เป็นหน้าที่ของ service
 * - ไม่ตรวจเนื้อหา (ไม่กรองข้อมูลส่วนตัว ไม่กรองคำ) ข้อความเป็นข้อมูลบันทึกอย่างเดียว
 */
export function parseOutcomeBody(body: unknown): OutcomeBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidOutcomeError('body ต้องเป็น JSON object');
  }

  const raw = (body as Record<string, unknown>).text;
  if (typeof raw !== 'string') {
    throw new InvalidOutcomeError('text ต้องเป็นข้อความ');
  }

  const text = raw.trim();
  if (text === '') {
    throw new InvalidOutcomeError('text ต้องไม่ว่าง');
  }
  if (text.length > MAX_OUTCOME_LENGTH) {
    throw new InvalidOutcomeError(`text ยาวเกิน ${MAX_OUTCOME_LENGTH} ตัวอักษร`);
  }

  return { text };
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
  /**
   * คะแนนความมั่นใจของ session = คะแนนความคล้าย (cosine) ปัด 3 ตำแหน่ง
   * เซิร์ฟเวอร์คำนวณเอง · null = ผู้ใช้เลือกอาการจากรายการเอง หรือระบบค้นหาไม่พร้อม
   * ไม่ใช่ความน่าจะเป็น หน้าจอต้องเรียกว่า "คะแนนความคล้าย"
   */
  confidence: number | null;
  /**
   * ข้อความผลลัพธ์ที่ผู้ใช้กรอกตอนการตรวจจบ · null = ยังไม่ได้กรอก (หรือการตรวจยังไม่จบ)
   * เป็นข้อมูลบันทึกอย่างเดียว ไม่มีโค้ดส่วนไหนอ่านไปตัดสินขั้นถัดไปหรือด่านความปลอดภัย
   * ไม่ใช่ข้อมูลที่ระบบ "เรียนรู้" จากมัน
   */
  outcome: string | null;
}
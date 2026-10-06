// backend/src/symptom-search/symptom-search.dto.ts

/**
 * symptom-search.dto.ts — รูปร่าง request/response ของ API ค้นหาอาการ
 *                         พร้อมตัวตรวจ body ที่เขียนเอง
 *
 * แนวเดียวกับ traversal.dto.ts: บริสุทธิ์ ไม่ import NestJS ไม่แตะโมเดลหรือฐานข้อมูล
 * เขียนตัวตรวจเองเป็นฟังก์ชันธรรมดา (ไม่ใช้ class-validator) เพราะ body มี field เดียว
 *
 * ถ้า body ผิดรูปแบบ parseSearchBody โยน InvalidSearchQueryError
 * แล้ว SymptomSearchExceptionFilter แปลงเป็น 400 INVALID_QUERY
 */

import type { DeviceCategory } from '../traversal-engine/types';

// ============================================================
// ค่าคงที่
// ============================================================

/**
 * ความยาวสูงสุดของคำค้น (นับหลังตัดช่องว่างหน้าหลัง)
 *
 * คำค้นถูกส่งเข้าโมเดลทุกครั้ง ถ้าไม่จำกัด ผู้ใช้ส่งข้อความยาวมากมาได้
 * ทำให้เซิร์ฟเวอร์บน Render free (0.1 CPU) ช้าหรือหน่วยความจำพุ่ง
 * อาการที่ผู้ใช้พิมพ์จริงสั้นกว่านี้มาก
 */
export const MAX_QUERY_LENGTH = 200;

// ============================================================
// ข้อผิดพลาด
// ============================================================

/**
 * body ของ request ค้นหาผิดรูปแบบ
 * เป็น error ของเราเอง เพื่อให้ filter จับด้วย instanceof ได้
 * message เขียนไว้ให้นักพัฒนาอ่าน หน้าจอเลือกข้อความไทยจาก code ไม่ใช่ message
 */
export class InvalidSearchQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ============================================================
// Request: ตัวตรวจ body
// ============================================================

/** body ของ POST /symptom-search */
export interface SearchBody {
  query: string;
}

/**
 * ตรวจ body: ต้องเป็น object ที่มี query เป็นข้อความ ไม่ว่าง ยาวไม่เกิน MAX_QUERY_LENGTH
 *
 * - ตัดช่องว่างหน้าหลังให้ ("  แอร์ไม่เย็น " → "แอร์ไม่เย็น")
 * - สร้าง object ใหม่จาก field ที่รู้จักเท่านั้น field แปลกปลอมจึงไม่ผ่านไปต่อ
 * - ตรวจแค่ "รูปร่าง" ส่วนการจับคู่กับผังขั้นตอนเป็นหน้าที่ของ service
 */
export function parseSearchBody(body: unknown): SearchBody {
  // typeof null === 'object' ใน JavaScript จึงต้องเช็ค null และ array แยก
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidSearchQueryError('body ต้องเป็น JSON object');
  }

  const raw = (body as Record<string, unknown>).query;
  if (typeof raw !== 'string') {
    throw new InvalidSearchQueryError('query ต้องเป็นข้อความ');
  }

  const query = raw.trim();
  if (query === '') {
    throw new InvalidSearchQueryError('query ต้องไม่ว่าง');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new InvalidSearchQueryError(
      `query ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`,
    );
  }

  return { query };
}

// ============================================================
// Response
// ============================================================

/** ผังขั้นตอน 1 รายการที่ผ่านเกณฑ์ความคล้าย */
export interface SymptomMatchDto {
  graphId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  /**
   * คะแนนความคล้าย (cosine) ปัดทศนิยม 3 ตำแหน่ง
   * ไม่ใช่ความน่าจะเป็น หน้าจอต้องเรียกว่า "คะแนนความคล้าย" ห้ามแสดงเป็น "มั่นใจ x%"
   */
  score: number;
  /** ข้อความอาการที่ทำให้ได้คะแนนนี้ (ไว้อธิบายให้ผู้ใช้ว่าทำไมจึงตรง) */
  matchedText: string;
}

/** ผลของ POST /symptom-search */
export interface SymptomSearchResponseDto {
  /** คำค้นหลังตัดช่องว่างแล้ว */
  query: string;
  /** เกณฑ์ที่ใช้ตัดสินรอบนี้ */
  threshold: number;
  /**
   * คะแนนสูงสุดที่พบ ส่งเสมอแม้ไม่มีผังผ่านเกณฑ์
   * (null เมื่อไม่มีผังขั้นตอนให้เทียบเลย)
   */
  bestScore: number | null;
  /** ผังที่ผ่านเกณฑ์ เรียงมากไปน้อย ว่าง = หน้าจอต้องแสดงการส่งต่อศูนย์บริการ */
  matches: SymptomMatchDto[];
}

/** สถานะของระบบค้นหา (disabled = ปิดสวิตช์ไว้) */
export type SearchState = 'disabled' | 'loading' | 'ready' | 'failed';

/** ผลของ GET /symptom-search/status */
export interface SearchStatusDto {
  state: SearchState;
  model: string;
  dtype: string;
  /** จำนวนข้อความอาการที่อยู่ในดัชนี */
  indexedTexts: number;
  /** จำนวนผังขั้นตอนที่อยู่ในดัชนี */
  indexedGraphs: number;
  /** เวลาโหลดโมเดลและสร้างดัชนี (มิลลิวินาที) null = ยังไม่เสร็จ */
  loadMs: number | null;
  modelFilesFoundLocally: boolean;
  /** ข้อความ error เมื่อ state = failed */
  error: string | null;
  /** หน่วยความจำที่โปรเซสใช้ (MB) ไว้ตรวจว่าเกิน 512 MB ของ Render free หรือไม่ */
  memoryRssMb: number;
}
/**
 * traversal.exception.filter.ts — แปลง error ทุกชนิดที่เกิดใน TraversalController
 *                                 ให้เป็น HTTP response ตามตารางข้อ 4 ของ HANDOFF
 *
 * ใช้ instanceof กับคลาส error โดยตรง ไม่จับจากข้อความ (error.message) เพราะข้อความ
 * เขียนไว้ให้นักพัฒนาอ่าน เปลี่ยนได้ตลอดโดยไม่ควรกระทบพฤติกรรมของ API
 *
 * error ที่ต้องรู้จักมาจาก 3 แหล่ง:
 *   - traversal-engine/types.ts   (5 ชนิด: ปัญหาจากการเดินเครื่องสถานะ)
 *   - traversal.service.ts (A.5) (2 ชนิด: หากราฟ/session ไม่เจอ)
 *   - traversal.dto.ts     (A.1) (1 ชนิด: body ผิดรูปแบบ)
 * รวม 8 ชนิด + 1 แถว "อื่นๆ" ท้ายตาราง
 *
 * ทำไมแยกฟังก์ชัน toErrorBody() ออกจากคลาส filter:
 *   ฟังก์ชันนี้เป็นตรรกะล้วน (รับ error คืน object) ทดสอบได้โดยไม่ต้องปลอม
 *   ArgumentsHost/Response ของ NestJS เลย ส่วนคลาส filter มีหน้าที่แค่เรียกมันแล้ว
 *   เขียนผลลงไปที่ HTTP response จริง
 *
 * ขอบเขตที่รู้อยู่แล้วและยังไม่แก้ตอนนี้: filter นี้ทำงานเฉพาะ error ที่เกิด "ระหว่าง"
 * รัน route handler ของ TraversalController (ติดตั้งด้วย @UseFilters ระดับ controller
 * ใน A.7) ถ้า body เป็น JSON ที่ผิดไวยากรณ์ล้วนๆ (เช่น `{`) Express จะโยน SyntaxError
 * ออกมาจากตัว body-parser เอง ก่อนที่ Nest จะส่งต่อมาถึง route handler filter นี้จึง
 * ไม่ได้ทำงาน กรณีนี้ต่างจาก "body เป็น JSON ที่ถูกต้องแต่ field ผิด" ซึ่ง parseTraversalAction
 * ใน A.1 จะจับได้ปกติ
 */

import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { InvalidRequestBodyError } from './traversal.dto';
import { GraphNotFoundError, SessionNotFoundError } from './traversal.service';
import {
  InvalidActionError,
  NodeNotFoundError,
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
  UnsupportedSchemaVersionError,
} from '../traversal-engine/types';

/** รูปร่าง response ตอน error ทุกกรณี ตรงกับ ApiErrorBody ฝั่งหน้าจอ (ตารางข้อ 4) */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/**
 * ตารางแปลง error → HTTP response ตัวจริง (ตารางข้อ 4 ของ HANDOFF)
 *
 * เรียงลำดับการเช็คตามที่อ่านง่าย ไม่ได้มีนัยเรื่องความสำคัญก่อนหลัง เพราะ error
 * ทั้ง 8 ชนิดเป็นพี่น้องกัน (extends Error หรือ TraversalError โดยตรง) ไม่มีคลาสไหน
 * เป็น superclass ของอีกคลาส จึงสลับลำดับกันได้โดยผลไม่เปลี่ยน
 *
 * แถวสุดท้าย (else) ดักทุกอย่างที่ไม่รู้จัก — บั๊กที่ยังไม่เจอ, error จาก mysql2 เอง,
 * หรือ error ชนิดที่ยังไม่ได้เพิ่มเข้าตารางนี้ ต้องเป็น 500 เสมอ เพราะไม่รู้สาเหตุจริง
 * (ตัดสินใจแล้วในข้อ 9: ใช้ INTERNAL_ERROR ไม่ใช่ UNKNOWN_ERROR ที่ mock ใช้)
 */
export function toErrorBody(exception: unknown): ApiErrorBody {
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  if (exception instanceof SafetyConfirmationRequiredError) {
    return { statusCode: 400, code: 'SAFETY_CONFIRMATION_REQUIRED', message };
  }
  if (exception instanceof InvalidActionError) {
    return { statusCode: 400, code: 'INVALID_ACTION', message };
  }
  if (exception instanceof InvalidRequestBodyError) {
    // body ผิดรูปแบบ ใช้ code เดียวกับ InvalidActionError ตามตารางข้อ 4
    // (สองแถวนี้ต่างกันแค่ "ผิดตอนไหน" แต่ผู้ใช้เห็นข้อความไทยเดียวกัน)
    return { statusCode: 400, code: 'INVALID_ACTION', message };
  }
  if (exception instanceof SessionAlreadyCompletedError) {
    return { statusCode: 409, code: 'SESSION_COMPLETED', message };
  }
  if (exception instanceof SessionNotFoundError) {
    return { statusCode: 404, code: 'SESSION_NOT_FOUND', message };
  }
  if (exception instanceof GraphNotFoundError) {
    return { statusCode: 404, code: 'GRAPH_NOT_FOUND', message };
  }
  if (exception instanceof NodeNotFoundError) {
    return { statusCode: 500, code: 'GRAPH_NODE_MISSING', message };
  }
  if (exception instanceof UnsupportedSchemaVersionError) {
    return { statusCode: 500, code: 'GRAPH_SCHEMA_UNSUPPORTED', message };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
}

@Catch()
export class TraversalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TraversalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);

    // log เฉพาะ 500 เท่านั้น: 400/404/409 เป็นผลที่คาดไว้แล้วของการใช้งานปกติ
    // (กรอกผิด, session หมดอายุ, กดซ้ำ) ไม่ใช่เรื่องที่นักพัฒนาต้องมานั่งไล่ดู log
    // ส่วน 500 ทุกกรณีคือสิ่งที่ไม่ควรเกิด (ข้อมูลกราฟเสีย, บั๊ก, หรือ error ที่ยังไม่รู้จัก)
    // จึงต้องมี stack trace ให้ตามรอยได้เสมอ
    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(body.statusCode).json(body);
  }
}
/**
 * traversal.controller.ts — 5 endpoint ตามตารางข้อ 4 ของ HANDOFF
 *
 * ไฟล์นี้ตั้งใจให้ "โง่" ที่สุดเท่าที่เป็นไปได้ ไม่มีการตัดสินใจอะไรเองเลย:
 *   - รับ request
 *   - ตรวจรูปร่าง body ด้วยฟังก์ชันจาก traversal.dto.ts (A.1)
 *   - ส่งต่อให้ TraversalService (A.5) ทำงานจริง
 *   - คืนสิ่งที่ service ให้กลับมาตรงๆ
 *
 * error ทุกชนิดที่เกิดขึ้น (ไม่ว่าจาก parse* หรือจาก service) ไม่ได้ถูกจับที่นี่เลย
 * ปล่อยให้หลุดขึ้นไปให้ TraversalExceptionFilter (A.6) ที่ติดไว้ระดับ controller
 * ด้านล่างเป็นคนแปลงเป็น HTTP response แทน
 *
 * @Body() รับเป็น unknown เสมอ ไม่ประกาศเป็น DTO class ของ NestJS/class-validator
 * เพราะตัดสินใจแล้วในขั้น A.1 ว่าจะไม่ใช้ class-validator — รูปร่างของ body ที่แท้จริง
 * ถูกพิสูจน์ (และแปลง type ให้ TypeScript เชื่อ) ผ่าน parseStartSessionBody /
 * parseTraversalAction เท่านั้น
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseFilters } from '@nestjs/common';

import { parseStartSessionBody, parseTraversalAction } from './traversal.dto';
import type { SessionResponseDto } from './traversal.dto';
import { TraversalExceptionFilter } from './traversal.exception.filter';
import { TraversalService } from './traversal.service';
import type { GraphSummary } from './graph.repository';

@Controller('traversal')
@UseFilters(TraversalExceptionFilter)
export class TraversalController {
  constructor(private readonly traversalService: TraversalService) {}

  /** GET /traversal/graphs */
  @Get('graphs')
  listGraphs(): GraphSummary[] {
    // ไม่ async เพราะ service.listGraphs() เองก็ไม่ async (อ่านจากหน่วยความจำล้วน)
    return this.traversalService.listGraphs();
  }

  /** POST /traversal/sessions — body: { graphId } */
  @Post('sessions')
  async startSession(@Body() body: unknown): Promise<SessionResponseDto> {
    // parseStartSessionBody โยน InvalidRequestBodyError ทันทีถ้า body ผิดรูปแบบ
    // โค้ดจะไม่เดินไปถึง service เลยในกรณีนั้น (filter จับ error แล้วแปลงเป็น 400 แทน)
    const { graphId } = parseStartSessionBody(body);
    return this.traversalService.startSession(graphId);
  }

  /** GET /traversal/sessions/:id */
  @Get('sessions/:id')
  async getSession(@Param('id') sessionId: string): Promise<SessionResponseDto> {
    return this.traversalService.getSession(sessionId);
  }

  /** POST /traversal/sessions/:id/actions — body คือ TraversalAction ตรงๆ ไม่ห่อ object อื่น */
  @Post('sessions/:id/actions')
  async submitAction(
    @Param('id') sessionId: string,
    @Body() body: unknown,
  ): Promise<SessionResponseDto> {
    const action = parseTraversalAction(body);
    return this.traversalService.submitAction(sessionId, action);
  }

  /**
   * DELETE /traversal/sessions/:id
   *
   * ต้องตอบ 204 ไม่มี body ตามตารางข้อ 4 — @HttpCode(204) บังคับ status code เอง
   * ฟังก์ชันคืน Promise<void> พอ ไม่ต้อง return อะไร NestJS จะไม่แนบ body ให้
   */
  @Delete('sessions/:id')
  @HttpCode(204)
  async abandonSession(@Param('id') sessionId: string): Promise<void> {
    await this.traversalService.abandonSession(sessionId);
  }
}
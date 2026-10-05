/**
 * traversal.service.ts — ต่อสาย GraphRepository + EquipmentRepository + SessionStore
 *                        เข้ากับกลไกควบคุมเครื่องสถานะ (traversal-engine)
 *
 * กฎที่ห้ามละเมิด (หลักการของโครงงาน): ไฟล์นี้ห้ามมีตรรกะการเปลี่ยน
 * สถานะของตัวเองแม้แต่บรรทัดเดียว ทุกการตัดสินใจว่า "ขั้นถัดไปคืออะไร" และ "action นี้
 * ใช้กับสถานะปัจจุบันได้ไหม" ต้องมาจาก startSession/getCurrentNode/submitAction ของ
 * engine เท่านั้น หน้าที่ของไฟล์นี้มีแค่: หาข้อมูลป้อนให้ engine, ส่งต่อผลลัพธ์, บันทึกผล
 *
 * จุดที่บังคับด่านความปลอดภัยจริงๆ อยู่ใน submitAction() ด้านล่าง:
 * เรียก engine ก่อนบันทึกเสมอ ถ้า engine โยน error แถวถัดไป (sessionStore.update)
 * จะไม่ถูกรันเลย จึงไม่ต้องเขียนโค้ด "ย้อนสถานะ" เมื่อเกิด error
 */

import { Injectable } from '@nestjs/common';

import { GraphRepository } from './graph.repository';
import type { GraphSummary } from './graph.repository';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import type { SessionResponseDto } from './traversal.dto';
import {
  getCurrentNode,
  startSession as engineStartSession,
  submitAction as engineSubmitAction,
} from '../traversal-engine/traversal-engine';
import type {
  RenderedNode,
  SessionState,
  TraversalAction,
  TroubleshootingGraph,
} from '../traversal-engine/types';

// ============================================================
// ข้อผิดพลาดของ service เอง
//
// ไม่ extends TraversalError เพราะไม่ได้มาจาก engine — engine ไม่รู้จักคำว่า
// "session" หรือ "graph ที่ไม่มีอยู่" เลย มันรับ SessionState + TroubleshootingGraph
// ที่มีอยู่แล้วมาทำงานเท่านั้น การหาไม่เจอเป็นเรื่องของชั้นข้อมูล (repository/store
// คืน undefined) จึงเป็น service ที่ต้องแปลงเป็น error เอง
// เหมือน InvalidRequestBodyError ใน traversal.dto.ts ที่ไม่ extends TraversalError
// เช่นกัน ด้วยเหตุผลเดียวกัน
//
// TraversalExceptionFilter จะจับทั้งคู่ด้วย instanceof แล้วแปลงเป็น 404 GRAPH_NOT_FOUND /
// 404 SESSION_NOT_FOUND
// ============================================================

export class GraphNotFoundError extends Error {
  constructor(graphId: string) {
    super(`ไม่พบผังขั้นตอน '${graphId}'`);
    this.name = this.constructor.name;
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`ไม่พบ session '${sessionId}' (อาจไม่เคยมีอยู่ หรือหมดอายุแล้ว)`);
    this.name = this.constructor.name;
  }
}

/**
 * บันทึกผลลัพธ์ให้ session ที่ยังเดินอยู่ (ยังไม่ถึงสถานะสิ้นสุด) → 409 SESSION_NOT_COMPLETED
 * ผลลัพธ์ที่ผู้ใช้กรอกมีความหมายเฉพาะตอนการตรวจจบแล้ว จึงรับเฉพาะ session ที่ status เป็น completed
 */
export class SessionNotCompletedError extends Error {
  constructor(sessionId: string) {
    super(`session '${sessionId}' ยังไม่ถึงสถานะสิ้นสุด บันทึกผลลัพธ์ไม่ได้`);
    this.name = this.constructor.name;
  }
}

/** session นี้เคยบันทึกผลลัพธ์ไปแล้ว ส่งซ้ำหรือแก้ไขไม่ได้ → 409 OUTCOME_ALREADY_SUBMITTED */
export class OutcomeAlreadySubmittedError extends Error {
  constructor(sessionId: string) {
    super(`session '${sessionId}' บันทึกผลลัพธ์ไปแล้ว ส่งซ้ำไม่ได้`);
    this.name = this.constructor.name;
  }
}

@Injectable()
export class TraversalService {
  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly sessionStore: SessionStore,
    private readonly symptomSearch: SymptomSearchService,
  ) {}

  // ============================================================
  // 6 เมธอด ตรงกับ 6 endpoint ของ TraversalController
  // ============================================================

  /**
   * GET /traversal/graphs
   *
   * ไม่ async เพราะ GraphRepository โหลดเข้าหน่วยความจำไว้หมดแล้วตอนบูต
   * เมธอดนี้จึงไม่แตะฐานข้อมูลเลย
   */
  listGraphs(): GraphSummary[] {
    return this.graphRepository.listAll();
  }

  /** POST /traversal/sessions */
  async startSession(graphId: string, query?: string): Promise<SessionResponseDto> {
    const graph = this.requireGraph(graphId);
    const confidence = await this.computeConfidence(graphId, query);

    // engine เป็น pure function ถ้าโยน error (เช่น entry_node หาไม่เจอ)
    // sessionStore.create() แถวถัดไปจะไม่ถูกเรียกเลย จึงไม่มี session ค้างอยู่ครึ่งๆ กลางๆ
    const { session, node } = engineStartSession(graph, confidence);
    await this.sessionStore.create(session);

    return this.toResponse(session, node, graph);
  }

  /** GET /traversal/sessions/:id */
  async getSession(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    // แค่ "อ่านซ้ำ" โหนดปัจจุบัน ไม่มีการเปลี่ยนสถานะ จึงไม่ต้องเขียนอะไรกลับ
    const node = getCurrentNode(session, graph);

    // ผลลัพธ์ที่ผู้ใช้กรอกมีได้เฉพาะ session ที่จบแล้ว (saveOutcome รับเฉพาะ completed)
    // จึงอ่านเฉพาะตอนนั้น การเดินขั้นตอนปกติไม่เสียคำสั่ง SQL เพิ่ม (ไม่ผ่าน find() และไม่ผ่าน engine)
    const outcome =
      session.status === 'completed' ? await this.sessionStore.findOutcome(sessionId) : null;

    return this.toResponse(session, node, graph, outcome);
  }

  /**
   * POST /traversal/sessions/:id/actions
   *
   * จุดที่บังคับด่านความปลอดภัยของทั้งระบบอยู่ตรงนี้:
   * เรียก engineSubmitAction() ก่อนเสมอ ถ้ามันโยน error (เช่น
   * SafetyConfirmationRequiredError) โค้ดจะกระโดดออกจากฟังก์ชันทันที
   * บรรทัด sessionStore.update() ด้านล่างจะไม่ถูกรัน — session เดิมในฐานข้อมูล
   * จึงไม่ขยับแม้แต่ก้าวเดียว โดยไม่ต้องเขียนโค้ดตรวจสอบหรือย้อนสถานะเพิ่มเติมเลย
   */
  async submitAction(sessionId: string, action: TraversalAction): Promise<SessionResponseDto> {
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    const result = engineSubmitAction(session, graph, action);

    // ถึงบรรทัดนี้ได้แปลว่า engine อนุมัติ action แล้วเท่านั้น
    // nodeId ที่บันทึกคือโหนดที่ "ออกจาก" (session ก่อนหน้า) ไม่ใช่โหนดใหม่ที่เพิ่งไปถึง
    // ตรงกับคอมเมนต์ในตาราง session_history: "โหนดที่ผู้ใช้อยู่ตอนส่ง action นี้"
    await this.sessionStore.update(result.session, {
      nodeId: session.currentNodeId,
      action,
    });

    return this.toResponse(result.session, result.node, graph);
  }

  /**
   * DELETE /traversal/sessions/:id
   *
   * ตรวจว่ามี session อยู่จริงก่อนลบ (เหมือน mockServer.ts) ผลคือยกเลิกซ้ำสอง
   * ครั้งจะได้ 404 ในครั้งที่สอง ไม่ใช่ 204 เงียบๆ — สอดคล้องกับสัญญาที่หน้าจอ
   * พัฒนามาด้วย mock ตัวนี้อยู่แล้ว (เทส 43 ข้อฝั่งหน้าจอผ่านด้วยพฤติกรรมนี้)
   */
  async abandonSession(sessionId: string): Promise<void> {
    await this.requireSession(sessionId);
    await this.sessionStore.delete(sessionId);
  }

  /**
   * POST /traversal/sessions/:id/outcome
   *
   * บันทึกข้อความผลลัพธ์ที่ผู้ใช้กรอกตอนการตรวจจบ (ได้ครั้งเดียวต่อ session)
   *
   * ⚠️ ไม่ผ่าน submitAction() และไม่เรียก engine ใดๆ ที่เปลี่ยนสถานะ:
   * session ที่จบแล้วถูกปฏิเสธด้วย SESSION_COMPLETED อยู่แล้ว และ resolveNextNode ต้องเป็น
   * จุดตัดสินใจเดียวต่อไป ผลลัพธ์เป็นข้อมูลบันทึกอย่างเดียว (เหมือน confidence)
   * เรียก getCurrentNode() เพื่อ "อ่าน" สถานะปัจจุบันมาประกอบ response เท่านั้น เหมือน getSession()
   *
   * ลำดับการตรวจ (แต่ละข้อใช้รหัสข้อผิดพลาดต่างกัน หน้าจอจึงแสดงข้อความถูกกรณี):
   *   1. session ไม่มี/หมดอายุ        → SessionNotFoundError          (404 SESSION_NOT_FOUND)
   *   2. session ยังเดินอยู่          → SessionNotCompletedError      (409 SESSION_NOT_COMPLETED)
   *   3. เคยบันทึกไปแล้ว              → OutcomeAlreadySubmittedError  (409 OUTCOME_ALREADY_SUBMITTED)
   *
   * ข้อ 3 ไม่เช็คก่อนเขียน แต่ให้ saveOutcome() ตัดสินในคำสั่ง UPDATE เดียว (atomic) ถ้าได้ false
   * ทั้งที่ข้อ 1 และ 2 ผ่านมาแล้ว แปลว่ามีผลลัพธ์อยู่แล้ว (สองคำขอพร้อมกัน ชนะได้คนเดียว)
   * ช่องว่างเล็กน้อยที่ยอมรับ: ถ้า session หมดอายุพอดีระหว่างข้อ 1 กับ UPDATE
   * UPDATE ยังเขียนสำเร็จ (ไม่เช็คอายุ) ซึ่งไม่มีผลเสีย
   *
   * text ต้องผ่านการตรวจจาก parseOutcomeBody() มาแล้ว (ตัดช่องว่าง ไม่ว่าง ไม่เกินเพดาน)
   * คืน session ปัจจุบันพร้อมฟิลด์ outcome เป็นข้อความที่เพิ่งบันทึก
   */
  async submitOutcome(sessionId: string, text: string): Promise<SessionResponseDto> {
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    if (session.status !== 'completed') {
      throw new SessionNotCompletedError(sessionId);
    }

    const saved = await this.sessionStore.saveOutcome(sessionId, text);
    if (!saved) {
      throw new OutcomeAlreadySubmittedError(sessionId);
    }

    const node = getCurrentNode(session, graph);
    return this.toResponse(session, node, graph, text);
  }

  // ============================================================
  // ตัวช่วยภายใน
  // ============================================================

  /** คืนกราฟ หรือโยน GraphNotFoundError ให้ controller/filter แปลงเป็น 404 ต่อ */
  private requireGraph(graphId: string): TroubleshootingGraph {
    const graph = this.graphRepository.findById(graphId);
    if (!graph) throw new GraphNotFoundError(graphId);
    return graph;
  }

  /** คืน session หรือโยน SessionNotFoundError (ครอบคลุมทั้งไม่เคยมีและหมดอายุแล้ว) */
  private async requireSession(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.find(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  /**
   * ประกอบ SessionResponseDto จากชิ้นส่วนที่กระจายอยู่ 3 แหล่ง:
   * session (สถานะ), node (ผล render จาก engine ตรงๆ ห้ามดัดแปลง),
   * และ equipment (ผูกกับประเภทเครื่องของกราฟ ไม่ใช่ผูกกับอาการ)
   */
  private toResponse(
    session: SessionState,
    node: RenderedNode,
    graph: TroubleshootingGraph,
    outcome: string | null = null,
  ): SessionResponseDto {
    return {
      sessionId: session.sessionId,
      graphId: session.graphId,
      status: session.status,
      node,
      equipment: this.equipmentRepository.findByCategory(graph.device_category),
      confidence: session.confidence ?? null,
      // ผลลัพธ์ที่ผู้ใช้กรอก ไม่ได้มาจาก session (SessionState ของ engine ไม่มีฟิลด์นี้)
      // ผู้เรียกที่รู้ค่า (getSession ตอนจบ, submitOutcome) ส่งเข้ามา ที่เหลือ (start, action) เป็น null
      // ซึ่งถูกต้อง: session ที่เพิ่งเริ่มหรือเพิ่งเดินต่อ (แม้เพิ่งถึงสถานะสิ้นสุด) ยังไม่เคยมีผลลัพธ์
      // เพราะ saveOutcome รับเฉพาะ session ที่จบแล้ว และ action หลังจบถูกปฏิเสธอยู่แล้ว
      outcome,
    };
  }

  /**
   * คะแนนความมั่นใจของ session (ขั้น 1.8)
   *
   * - ไม่มี query (ผู้ใช้เลือกอาการจากรายการเอง) → null
   * - มี query → ให้ระบบค้นหาคำนวณเอง (ไม่รับตัวเลขจากหน้าจอ)
   * - ระบบค้นหาไม่พร้อม หรือคำนวณล้มเหลว → null ไม่แต่งตัวเลข และไม่ทำให้การเริ่ม session ล้ม
   *
   * ค่านี้แสดงผลอย่างเดียว ไม่มีโค้ดส่วนไหนอ่านมันไปตัดสินขั้นถัดไปหรือด่านความปลอดภัย
   */
  private async computeConfidence(graphId: string, query?: string): Promise<number | null> {
    if (query === undefined) return null;
    try {
      return await this.symptomSearch.scoreGraph(query, graphId);
    } catch {
      return null;
    }
  }
}
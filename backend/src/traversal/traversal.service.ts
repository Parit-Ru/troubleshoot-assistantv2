/**
 * traversal.service.ts — ต่อสาย GraphRepository + EquipmentRepository + SessionStore
 *                        เข้ากับกลไกควบคุมเครื่องสถานะ (traversal-engine)
 *
 * กฎที่ห้ามละเมิด (ล็อกไว้ตั้งแต่ PROJECT_CONTEXT.md): ไฟล์นี้ห้ามมีตรรกะการเปลี่ยน
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
// เหมือน InvalidRequestBodyError ใน traversal.dto.ts (A.1) ที่ไม่ extends TraversalError
// เช่นกัน ด้วยเหตุผลเดียวกัน
//
// filter ใน A.6 จะจับทั้งคู่ด้วย instanceof แล้วแปลงเป็น 404 GRAPH_NOT_FOUND /
// 404 SESSION_NOT_FOUND ตามตารางข้อ 4
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

@Injectable()
export class TraversalService {
  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly sessionStore: SessionStore,
  ) {}

  // ============================================================
  // 5 เมธอด ตรงกับ 5 endpoint ของ API (ตารางข้อ 4)
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
  async startSession(graphId: string): Promise<SessionResponseDto> {
    const graph = this.requireGraph(graphId);

    // engine เป็น pure function ถ้าโยน error (เช่น entry_node หาไม่เจอ)
    // sessionStore.create() แถวถัดไปจะไม่ถูกเรียกเลย จึงไม่มี session ค้างอยู่ครึ่งๆ กลางๆ
    const { session, node } = engineStartSession(graph);
    await this.sessionStore.create(session);

    return this.toResponse(session, node, graph);
  }

  /** GET /traversal/sessions/:id */
  async getSession(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    // แค่ "อ่านซ้ำ" โหนดปัจจุบัน ไม่มีการเปลี่ยนสถานะ จึงไม่ต้องเขียนอะไรกลับ
    const node = getCurrentNode(session, graph);

    return this.toResponse(session, node, graph);
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
  ): SessionResponseDto {
    return {
      sessionId: session.sessionId,
      graphId: session.graphId,
      status: session.status,
      node,
      equipment: this.equipmentRepository.findByCategory(graph.device_category),
    };
  }
}
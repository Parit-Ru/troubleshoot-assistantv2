/**
 * session.store.ts — อ่านและเขียนตาราง sessions กับ session_history
 *
 * เก็บและอ่าน SessionState ที่ engine สร้างขึ้น ไม่มีตรรกะเปลี่ยนสถานะอยู่ที่นี่
 * (คนตัดสินว่าขั้นถัดไปคืออะไรคือ submitAction() ของ engine เท่านั้น)
 * SQL เขียนเอง ไม่ใช้ ORM
 *
 * เรื่องเวลา: ทุกการคำนวณเวลาทำใน SQL ด้วย NOW() ไม่ใช้ Date ของ JavaScript
 * เพราะคอลัมน์ TIMESTAMP ของ MySQL ขึ้นกับ time zone ของ connection
 * ถ้าเอาเวลาจากสองที่มาเทียบกัน อาจเห็น session หมดอายุเพี้ยนไปหลายชั่วโมง
 *
 * อายุ session 24 ชั่วโมง นับจากการใช้งานครั้งล่าสุด (ต่ออายุตอนสร้างและทุกครั้งที่ update)
 * ยาวกว่ารอบรอที่ยาวที่สุดในข้อมูล คือสถานะ n_ventilate ที่ให้เปิดพัดลมทิ้งไว้ 3–4 ชั่วโมง
 * ซึ่งเป็นช่วงที่ไม่มี action เกิดขึ้นเลย
 * (คอมเมนต์ใน migration 002 เขียนว่า 2 ชั่วโมง แต่ค่าที่ใช้จริงคือค่าในไฟล์นี้
 * และห้ามแก้ไฟล์ migration ที่รันไปแล้ว)
 *
 * ยังไม่มีตัวกวาด session หมดอายุ: แถวที่หมดอายุยังอยู่ในตารางแต่ find() มองไม่เห็น
 *
 * ผลลัพธ์ที่ผู้ใช้กรอก (outcome_text / outcome_at) เก็บและอ่านผ่าน saveOutcome() / findOutcome()
 * ท้ายคลาสเท่านั้น find() ไม่อ่านคอลัมน์เหล่านี้ และ SessionState ไม่มีฟิลด์นี้
 * engine จึงไม่มีทางเห็นค่า outcome ซึ่งเป็นข้อมูลบันทึกอย่างเดียว
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import type {
  SessionHistoryEntry,
  SessionState,
  SessionStatus,
  TraversalAction,
} from '../traversal-engine/types';

/** อายุ session เป็นชั่วโมง นับจากการใช้งานครั้งล่าสุด */
const SESSION_TTL_HOURS = 24;

/** 1 แถวจากตาราง sessions */
interface SessionRow extends RowDataPacket {
  session_id: string;
  graph_id: string;
  current_node_id: string;
  status: SessionStatus;
  variables: unknown;
  /** DECIMAL(4,3) — mysql2 ส่งมาเป็นข้อความ หรือ null */
  confidence: string | number | null;
}

/** 1 แถวจากตาราง session_history */
interface HistoryRow extends RowDataPacket {
  node_id: string;
  action_type: TraversalAction['type'];
  action_value: string | null;
}

/** ผลลัพธ์ที่ผู้ใช้กรอกของ session หนึ่ง (NULL = ยังไม่ได้กรอก) */
interface OutcomeRow extends RowDataPacket {
  outcome_text: string | null;
}

@Injectable()
export class SessionStore {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  /** บันทึก session ใหม่ ยังไม่มีประวัติ (history เป็น []) จึงเขียนแค่ตาราง sessions */
  async create(session: SessionState): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions
         (session_id, graph_id, current_node_id, status, variables, confidence, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)`,
      [
        session.sessionId,
        session.graphId,
        session.currentNodeId,
        session.status,
        JSON.stringify(session.variables),
        session.confidence ?? null,
        SESSION_TTL_HOURS,
      ],
    );
  }

  /**
   * อ่าน session พร้อมประวัติทั้งหมด (engine ต้องการ SessionState ที่สมบูรณ์)
   * คืน undefined ถ้าไม่มี session นี้ หรือหมดอายุแล้ว (ถือว่าเสมือนไม่มีอยู่ → service ตอบ 404)
   */
  async find(sessionId: string): Promise<SessionState | undefined> {
    const [sessionRows] = await this.pool.query<SessionRow[]>(
      `SELECT session_id, graph_id, current_node_id, status, variables, confidence
         FROM sessions
        WHERE session_id = ? AND expires_at > NOW()`,
      [sessionId],
    );

    const row = sessionRows[0];
    if (!row) return undefined;

    const [historyRows] = await this.pool.query<HistoryRow[]>(
      `SELECT node_id, action_type, action_value
         FROM session_history
        WHERE session_id = ?
        ORDER BY step_order`,
      [sessionId],
    );

    return {
      sessionId: row.session_id,
      graphId: row.graph_id,
      currentNodeId: row.current_node_id,
      status: row.status,
      variables: parseVariables(row.variables),
      // DECIMAL ถูก mysql2 ส่งกลับเป็นข้อความ ('0.707') จึงต้องแปลงเป็นตัวเลข · NULL คงเป็น null
      confidence: row.confidence === null ? null : Number(row.confidence),
      history: historyRows.map(rowToHistoryEntry),
    };
  }

  /**
   * บันทึกผลของ action 1 ครั้ง: สถานะปัจจุบันใหม่ + ประวัติ 1 รายการ
   *
   * session = session ใหม่ที่ engine คืนมา (history มีรายการของ step นี้ต่อท้ายแล้ว)
   * step    = โหนดที่ออกจาก กับ action ที่ทำ (สิ่งที่จะบันทึกลงประวัติ)
   *
   * ต้องอยู่ใน transaction เดียว: ถ้าเขียน sessions สำเร็จแต่บันทึกประวัติล้ม
   * สถานะกับประวัติจะไม่ตรงกัน การยกเลิกทั้งก้อนกันปัญหานี้
   *
   * step_order = history.length - 1 (เพราะ session ที่ส่งมามีรายการของ step นี้เพิ่มเข้าไปแล้ว)
   * ตารางมี UNIQUE KEY (session_id, step_order) กันบันทึกซ้ำ
   * request ซ้ำที่มาพร้อมกันจึงล้มตรงนี้ และยอมให้ตอบ 500
   */
  async update(
    session: SessionState,
    step: { nodeId: string; action: TraversalAction },
  ): Promise<void> {
    if (session.history.length === 0) {
      throw new Error(
        'update() ต้องรับ session ที่ผ่านการ submitAction แล้ว (history ต้องไม่ว่าง)',
      );
    }
    const stepOrder = session.history.length - 1;

    // คำสั่งใน transaction เดียวกันต้องวิ่งผ่าน connection เดียวกัน
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE sessions
            SET current_node_id = ?,
                status = ?,
                variables = ?,
                expires_at = NOW() + INTERVAL ? HOUR
          WHERE session_id = ?`,
        [
          session.currentNodeId,
          session.status,
          JSON.stringify(session.variables),
          SESSION_TTL_HOURS,
          session.sessionId,
        ],
      );

      await conn.query(
        `INSERT INTO session_history
           (session_id, step_order, node_id, action_type, action_value)
         VALUES (?, ?, ?, ?, ?)`,
        [
          session.sessionId,
          stepOrder,
          step.nodeId,
          step.action.type,
          actionValueOf(step.action),
        ],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      // คืนการเชื่อมต่อเข้า pool เสมอ ไม่ว่าสำเร็จหรือล้ม
      // ถ้าลืมข้อนี้ pool (มีแค่ 5 เส้น) จะหมดแล้วเซิร์ฟเวอร์ค้าง
      conn.release();
    }
  }

  /** ลบ session (ประวัติถูกลบตามด้วย ON DELETE CASCADE) ไม่มี session นี้ก็ไม่ error */
  async delete(sessionId: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
  }

  // ============================================================
  // ผลลัพธ์ที่ผู้ใช้กรอกตอนการตรวจจบ (ข้อมูลบันทึกอย่างเดียว)
  // ============================================================

  /**
   * บันทึกข้อความผลลัพธ์ของ session ที่จบแล้ว "ได้ครั้งเดียว"
   *
   * คืน true = บันทึกแล้ว · คืน false = ไม่มีแถวที่ตรงเงื่อนไข (ไม่มี session / ยังไม่จบ / เคยบันทึกแล้ว)
   * ฟังก์ชันนี้ไม่แยกสาเหตุ service ตรวจสองข้อแรกไปแล้วก่อนเรียก จึงถือว่า false คือ "เคยบันทึกแล้ว"
   *
   * เงื่อนไข outcome_text IS NULL อยู่ใน UPDATE เดียวกัน ไม่เช็คก่อนแล้วค่อยเขียน:
   * ถ้าสองคำขอเข้ามาพร้อมกัน ฐานข้อมูลล็อกแถวทีละคำสั่ง คำขอแรกเปลี่ยน NULL เป็นข้อความ
   * คำขอที่สองเห็นว่าไม่ใช่ NULL แล้วจึงแก้ได้ 0 แถว ได้ผู้ชนะคนเดียวโดยไม่ต้องใช้ transaction
   * (ถ้าเช็คก่อนแล้วค่อยเขียนเป็นสองคำสั่ง ทั้งสองคำขออาจผ่านการเช็คพร้อมกันแล้วเขียนทับกัน)
   *
   * status = 'completed' กันอีกชั้นว่าจะไม่บันทึกให้ session ที่ยังเดินอยู่
   * ไม่ต่ออายุ session ตอนบันทึก เพราะการกรอกผลลัพธ์ไม่ใช่ action ของเครื่องสถานะ
   */
  async saveOutcome(sessionId: string, text: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE sessions
          SET outcome_text = ?,
              outcome_at = NOW()
        WHERE session_id = ?
          AND status = 'completed'
          AND outcome_text IS NULL`,
      [text, sessionId],
    );
    return result.affectedRows === 1;
  }

  /**
   * อ่านข้อความผลลัพธ์ที่เคยบันทึก คืน null ถ้ายังไม่เคยกรอก หรือไม่มี session นี้ หรือหมดอายุแล้ว
   * แยกจาก find() โดยตั้งใจ เพื่อให้ SessionState ที่ส่งเข้า engine ไม่มีค่านี้ปนไปเลย
   */
  async findOutcome(sessionId: string): Promise<string | null> {
    const [rows] = await this.pool.query<OutcomeRow[]>(
      `SELECT outcome_text
         FROM sessions
        WHERE session_id = ? AND expires_at > NOW()`,
      [sessionId],
    );
    return rows[0]?.outcome_text ?? null;
  }
}

// ============================================================
// ตัวช่วย
// ============================================================

/** ค่าที่ต้องเก็บในคอลัมน์ action_value: มีเฉพาะ answer กับ input นอกนั้นเป็น NULL */
function actionValueOf(action: TraversalAction): string | null {
  return action.type === 'answer' || action.type === 'input' ? action.value : null;
}

/**
 * แปลงแถวประวัติกลับเป็น SessionHistoryEntry
 * (ย้อนกลับของ actionValueOf ที่ตอนบันทึก)
 *
 * ถ้าข้อมูลในตารางไม่สมบูรณ์ (เช่น answer แต่ไม่มีค่า) โยน error ธรรมดา
 * แล้วจะออกเป็น 500 ดีกว่าส่ง action ที่เสียให้ engine
 */
function rowToHistoryEntry(row: HistoryRow): SessionHistoryEntry {
  return { nodeId: row.node_id, action: rowToAction(row) };
}

function rowToAction(row: HistoryRow): TraversalAction {
  switch (row.action_type) {
    case 'answer':
      if (row.action_value !== 'yes' && row.action_value !== 'no') {
        throw new Error(`ประวัติเสีย: answer ต้องมีค่า yes/no แต่พบ '${String(row.action_value)}'`);
      }
      return { type: 'answer', value: row.action_value };

    case 'input':
      if (row.action_value === null) {
        throw new Error('ประวัติเสีย: input ต้องมีค่า แต่พบ NULL');
      }
      return { type: 'input', value: row.action_value };

    case 'continue':
      return { type: 'continue' };

    case 'confirm_safety':
      return { type: 'confirm_safety' };

    default: {
      // ENUM ในฐานข้อมูลกันไว้ชั้นหนึ่งแล้ว บรรทัดนี้คือด่านสุดท้าย
      // และทำให้ TypeScript ยืนยันว่าครอบคลุมครบทั้ง 4 แบบ
      const unreachable: never = row.action_type;
      throw new Error(`ประวัติเสีย: action_type ไม่รู้จัก '${String(unreachable)}'`);
    }
  }
}

/**
 * คอลัมน์ JSON ของ MySQL — mysql2 แปลงเป็น object ให้แล้ว
 * แต่บางการตั้งค่าอาจได้ string กลับมา จึงรับทั้งสองแบบ ไม่ให้ JSON.parse ซ้ำ
 */
function parseVariables(value: unknown): Record<string, string> {
  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, string>;
  }
  return (value ?? {}) as Record<string, string>;
}
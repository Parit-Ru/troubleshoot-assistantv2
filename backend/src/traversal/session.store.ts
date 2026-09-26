/**
 * session.store.ts — อ่านและเขียนตาราง sessions กับ session_history
 *
 * หน้าที่เดียวของไฟล์นี้: เก็บและอ่าน SessionState ที่กลไกควบคุมเครื่องสถานะสร้างขึ้น
 * ไม่มีตรรกะการเปลี่ยนสถานะอยู่ที่นี่เลย
 * ใครเป็นคนตัดสินว่าขั้นถัดไปคืออะไร คำตอบคือ submitAction() ของ engine เท่านั้น
 *
 * SQL เขียนเอง ไม่ใช้ ORM
 *
 * ข้อตกลงเรื่องเวลา (สำคัญ):
 *   ทุกการคำนวณเวลาทำใน SQL ด้วย NOW() ไม่ใช้ Date ของ JavaScript
 *   เพราะคอลัมน์ TIMESTAMP ของ MySQL ขึ้นกับ time zone ของ connection
 *   ถ้าเอาเวลาจากสองที่มาเทียบกัน อาจเห็น session หมดอายุเพี้ยนไปหลายชั่วโมง
 *
 * อายุ session (ตัดสินใจแล้วในข้อ B8):
 *   24 ชั่วโมง นับจากการใช้งานครั้งล่าสุด (ต่ออายุทั้งตอนสร้างและทุกครั้งที่ update)
 *   ยาวกว่ารอบรอที่ยาวที่สุดในข้อมูล คือสถานะ n_ventilate ที่ให้เปิดพัดลมทิ้งไว้ 3–4 ชั่วโมง
 *   ซึ่งเป็นช่วงที่ไม่มี action เกิดขึ้นเลย
 *   หมายเหตุ: คอมเมนต์ใน migration 002 เขียนว่า 2 ชั่วโมง ไม่ตรงกับค่านี้
 *   (ห้ามแก้ไฟล์ migration ที่รันไปแล้ว)
 *
 * ยังไม่มีตัวกวาด session หมดอายุ: แถวที่หมดอายุยังอยู่ในตารางแต่ find() มองไม่เห็น
 * ข้อมูลระดับนี้ไม่เป็นปัญหา และประวัติเหล่านี้ยังเอาไปใช้ทำหน้า Analytics ได้ในอนาคต
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

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
}

/** 1 แถวจากตาราง session_history */
interface HistoryRow extends RowDataPacket {
  node_id: string;
  action_type: TraversalAction['type'];
  action_value: string | null;
}

@Injectable()
export class SessionStore {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  /**
   * บันทึก session ใหม่ที่เพิ่งเริ่ม
   *
   * session ใหม่ยังไม่มีประวัติ (history เป็น []) จึงเขียนแค่ตาราง sessions
   */
  async create(session: SessionState): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions
         (session_id, graph_id, current_node_id, status, variables, expires_at)
       VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)`,
      [
        session.sessionId,
        session.graphId,
        session.currentNodeId,
        session.status,
        JSON.stringify(session.variables),
        SESSION_TTL_HOURS,
      ],
    );
  }

  /**
   * อ่าน session พร้อมประวัติทั้งหมด
   *
   * คืน undefined ถ้าไม่มี session นี้ หรือหมดอายุแล้ว
   * (session ที่หมดอายุถือว่าเสมือนไม่มีอยู่ service จะตอบ 404 เหมือนกัน)
   *
   * ต้องประกอบ history กลับมาจากตาราง session_history ให้ครบ
   * เพราะ engine ต้องการ SessionState ที่สมบูรณ์
   */
  async find(sessionId: string): Promise<SessionState | undefined> {
    const [sessionRows] = await this.pool.query<SessionRow[]>(
      `SELECT session_id, graph_id, current_node_id, status, variables
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
      history: historyRows.map(rowToHistoryEntry),
    };
  }

  /**
   * บันทึกผลของ action 1 ครั้ง: สถานะปัจจุบันใหม่ + ประวัติ 1 รายการ
   *
   * session  = session ใหม่ที่ engine คืนมา (history มีรายการของ step นี้ต่อท้ายแล้ว)
   * step     = สถานะที่ออกจาก กับ action ที่ทำ (สิ่งที่จะบันทึกลงประวัติ)
   *
   * ต้องอยู่ใน transaction เดียว: ถ้าเขียน sessions สำเร็จแต่บันทึกประวัติล้ม
   * สถานะกับประวัติจะไม่ตรงกัน การยกเลิกทั้งก้อนกันปัญหานี้
   *
   * step_order = จำนวนรายการในประวัติก่อนหน้า = history.length - 1
   * (เพราะ session ที่ส่งมามีรายการของ step นี้เพิ่มเข้าไปแล้ว)
   * ตารางมี UNIQUE KEY (session_id, step_order) กันบันทึกซ้ำอยู่แล้ว
   * request ซ้ำที่มาพร้อมกันจึงตกเป็น error ตรงนี้ (ตัดสินใจแล้วว่ารับสภาพ = 500)
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

    // ยืมการเชื่อมต่อ 1 เส้นมาใช้ตลอด transaction
    // (คำสั่งใน transaction เดียวกันต้องวิ่งผ่าน connection เดียวกัน)
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

  /**
   * ลบ session (ประวัติของ session นั้นถูกลบตามไปเองด้วย ON DELETE CASCADE)
   *
   * ไม่มี session นี้อยู่ก็ไม่ error ให้ service ตัดสินใจเองว่าต้องเช็คก่อนหรือไม่
   */
  async delete(sessionId: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
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
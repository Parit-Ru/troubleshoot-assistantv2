// backend/src/traversal/traversal.service.spec.ts

/**
 * เทสตรรกะของ TraversalService โดยใช้ repository/store ปลอมที่เก็บในหน่วยความจำ
 * เท่านั้น — รันได้โดยไม่ต้องต่อ MySQL เลย
 *
 * ตัวปลอมสร้างจากไฟล์ข้อมูลจริงชุดเดียวกับที่ mockServer.ts ใช้
 * (data/manuals/samsung_ac_ar70h.json, data/equipment/equipment.json)
 * แล้วลอกทั้ง 10 กรณีจาก frontend/src/mocks/mockServer.test.ts มาตรงๆ
 *
 * เหตุผลที่ต้องลอกให้ตรง: mock กับ service ตัวจริงต้อง "พฤติกรรมเดียวกันทุกกรณี"
 * เพราะ mock คือสิ่งที่หน้าจอใช้พัฒนามาตลอด ถ้าสองฝั่งเพี้ยนกัน หน้าจอจะโกหกผู้ใช้
 * เรื่องด่านความปลอดภัยระหว่างพัฒนา โดยไม่มีใครรู้จนกว่าจะต่อเซิร์ฟเวอร์จริง
 *
 * หมายเหตุ: เทสชุดนี้พิสูจน์แค่ตรรกะของ TraversalService เท่านั้น
 * ไม่ได้พิสูจน์ transaction ของ SessionStore กับ MySQL จริง (พิสูจน์แล้วแยกต่างหาก
 * ด้วยตารางตรวจ A.10 กับสคริปต์ A.12)
 *
 * ตรวจผ่านเมื่อ: npm test "ล้ม" ในตอนนี้ เพราะยังไม่มีไฟล์ traversal.service.ts
 * (เป็นขั้นตอนที่ตั้งใจ — เขียนเทสก่อนเขียนโค้ดจริงตามที่ตกลงกันไว้)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { GraphRepository, GraphSummary } from './graph.repository';
import type { EquipmentRepository } from './equipment.repository';
import type { SessionStore } from './session.store';
import type { EquipmentItemDto } from './traversal.dto';
import {
  GraphNotFoundError,
  SessionNotFoundError,
  TraversalService,
} from './traversal.service';
import {
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
} from '../traversal-engine/types';
import type {
  ManualFile,
  SessionState,
  TraversalAction,
  TroubleshootingGraph,
} from '../traversal-engine/types';

// ============================================================
// ข้อมูลจริง — ไฟล์เดียวกับที่ backend จริงและ mockServer.ts ใช้
//
// อ่านด้วย fs.readFileSync + JSON.parse (ไม่ใช่ import แบบ TS)
// เพราะ backend/tsconfig.json ไม่ได้เปิด resolveJsonModule และ rootDir
// ผูกไว้กับ backend/src เท่านั้น จึง import ข้ามไปที่ data/ (นอก backend/)
// ด้วยไวยากรณ์ import ตรงๆ แบบที่ mockServer.ts ทำไม่ได้
// (สคริปต์ seed-graphs.js / seed-equipment.js ของโปรเจกต์นี้ก็ใช้วิธีเดียวกันนี้)
// ============================================================

const manualPath = path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json');
const equipmentPath = path.resolve(__dirname, '../../../data/equipment/equipment.json');

const manual = JSON.parse(fs.readFileSync(manualPath, 'utf-8')) as ManualFile;

/** รูปร่างของ data/equipment/equipment.json เฉพาะ field ที่ใช้ (ลอกจาก mockServer.ts) */
interface EquipmentFile {
  equipment: { equipment_id: string; name_th: string }[];
  usage: {
    device_category: string;
    items: {
      equipment_id: string;
      purpose_th: string;
      source_page?: number;
      author_note?: string;
    }[];
  }[];
}

const equipmentFile = JSON.parse(fs.readFileSync(equipmentPath, 'utf-8')) as EquipmentFile;

// ============================================================
// ตัวปลอมของชั้นข้อมูล
//
// ไม่ extends GraphRepository/EquipmentRepository/SessionStore ของจริง เพราะทุกตัว
// มี field ส่วนตัว (private pool) ที่ต้องมี mysql2 Pool จริงตอนสร้าง — เทสนี้ไม่ต้อง
// แตะฐานข้อมูลเลย จึงสร้าง "หน้าตาเดียวกัน" ขึ้นมาใหม่ทั้งคลาส แล้ว cast ผ่าน unknown
// ตอนส่งให้ TraversalService (เทคนิคมาตรฐานสำหรับใส่ของปลอมแทนของจริงตอนเทส)
//
// TraversalService เองไม่รู้และไม่สนใจว่าได้รับของจริงหรือของปลอม — เห็นแค่ว่า
// มีเมธอด findById/listAll/findByCategory/create/find/update/delete ให้เรียก
// ============================================================

class FakeGraphRepository {
  private readonly graphs = new Map<string, TroubleshootingGraph>(
    manual.graphs.map((graph) => [graph.graph_id, graph]),
  );

  findById(graphId: string): TroubleshootingGraph | undefined {
    return this.graphs.get(graphId);
  }

  /** ลอกตรงจากเมธอด listAll() ของ graph.repository.ts จริง */
  listAll(): GraphSummary[] {
    return [...this.graphs.values()].map((g) => ({
      graphId: g.graph_id,
      entrySymptom: g.entry_symptom,
      entrySymptomTh: g.entry_symptom_th,
      deviceCategory: g.device_category,
      brand: g.brand,
      modelPattern: g.model_pattern,
      severity: g.severity,
      difficulty: g.difficulty,
    }));
  }
}

class FakeEquipmentRepository {
  private readonly names = new Map(
    equipmentFile.equipment.map((item) => [item.equipment_id, item.name_th]),
  );

  /** ลอกตรงจากฟังก์ชัน equipmentFor() ของ mockServer.ts */
  findByCategory(category: string): EquipmentItemDto[] {
    const usage = equipmentFile.usage.find((entry) => entry.device_category === category);
    if (!usage) return [];

    return usage.items.map((item) => ({
      equipmentId: item.equipment_id,
      nameTh: this.names.get(item.equipment_id) ?? item.equipment_id,
      purposeTh: item.purpose_th,
      sourcePage: item.source_page,
      authorNote: item.author_note,
    }));
  }
}

/** เก็บ session ไว้ใน Map ธรรมดา ไม่มีเรื่องหมดอายุหรือ transaction เพราะไม่ใช่สิ่งที่เทสชุดนี้ตรวจ */
class FakeSessionStore {
  private readonly sessions = new Map<string, SessionState>();

  async create(session: SessionState): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async find(sessionId: string): Promise<SessionState | undefined> {
    return this.sessions.get(sessionId);
  }

  async update(session: SessionState): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

function makeService(): TraversalService {
  return new TraversalService(
    new FakeGraphRepository() as unknown as GraphRepository,
    new FakeEquipmentRepository() as unknown as EquipmentRepository,
    new FakeSessionStore() as unknown as SessionStore,
  );
}

// ============================================================
// ค่าคงที่ใช้ร่วมกันในเทส (ตรงกับ mockServer.test.ts)
// ============================================================

const STOPS_WORKING = 'samsung_ac_ar70h_stops_working';
const ERROR_MESSAGE = 'samsung_ac_ar70h_error_message';
const WATER_DRIPS = 'samsung_ac_ar70h_water_drips_outdoor';

const YES: TraversalAction = { type: 'answer', value: 'yes' };

/** เดินตาม action ที่ให้มาทีละขั้น แล้วคืน session ที่หยุดอยู่ (ลอกจาก mockServer.test.ts) */
async function walk(service: TraversalService, graphId: string, actions: TraversalAction[]) {
  let session = await service.startSession(graphId);
  for (const action of actions) {
    session = await service.submitAction(session.sessionId, action);
  }
  return session;
}

// ============================================================
// เทส — ลอกทั้ง 10 ข้อจาก mockServer.test.ts
// ============================================================

describe('TraversalService', () => {
  it('listGraphs คืน 13 อาการ และทุกอาการมีชื่อไทย', () => {
    const service = makeService();
    const graphs = service.listGraphs();

    expect(graphs).toHaveLength(13);
    expect(graphs.every((g) => g.entrySymptomTh)).toBe(true);
  });

  it('เริ่ม session แล้วได้โหนดแรกของกราฟ พร้อมรายการอุปกรณ์', async () => {
    const service = makeService();
    const session = await service.startSession(STOPS_WORKING);

    expect(session.node.nodeId).toBe('n1');
    expect(session.status).toBe('in_progress');
    expect(session.graphId).toBe(STOPS_WORKING);
    expect(session.equipment).toHaveLength(7);
  });

  it('ส่ง continue ที่ด่านความปลอดภัยถูกปฏิเสธ และสถานะไม่ขยับ', async () => {
    // เทสที่สำคัญที่สุดของไฟล์นี้ — เป็นข้อสอบหลักของโครงงาน
    const service = makeService();
    const session = await walk(service, STOPS_WORKING, [YES, YES]);
    expect(session.node.nodeId).toBe('n_fix_breaker');
    expect(session.node.requiresSafetyConfirmation).toBe(true);

    // ต้องโยน error ชนิดเดิมของ engine ตรงๆ ไม่ใช่ error ที่ service ห่อเอง
    // เพราะ filter ใน A.6 จะจับด้วย instanceof ตัวนี้แล้วแปลงเป็น 400 SAFETY_CONFIRMATION_REQUIRED
    await expect(
      service.submitAction(session.sessionId, { type: 'continue' }),
    ).rejects.toBeInstanceOf(SafetyConfirmationRequiredError);

    // อ่านสถานะซ้ำ ต้องยังอยู่โหนดเดิม
    // ระบบที่ตอบ error แล้วแอบเดินต่อ จะแย่กว่าระบบที่ไม่มีด่านเลย
    const after = await service.getSession(session.sessionId);
    expect(after.node.nodeId).toBe('n_fix_breaker');
  });

  it('ยืนยันคำเตือนแล้วเดินต่อได้', async () => {
    // ด่านที่บล็อกทุกอย่างก็ผิดเหมือนกัน ต้องผ่านได้เมื่อยืนยันถูกวิธี
    const service = makeService();
    const session = await walk(service, STOPS_WORKING, [YES, YES, { type: 'confirm_safety' }]);

    expect(session.node.nodeId).toBe('n_recheck_breaker');
  });

  it('กรอกรหัสผิดรูปแบบ พาไปโหนดอธิบายรูปแบบ ไม่ใช่ error', async () => {
    // สำคัญ: การกรอกผิดไม่ใช่ข้อผิดพลาดของระบบ แต่เป็นเส้นทางหนึ่งในกราฟ
    // service จึงห้ามตรวจรูปแบบเอง ต้องปล่อยให้ engine ตัดสินเหมือนที่ mock ทำ
    const service = makeService();
    const session = await walk(service, ERROR_MESSAGE, [YES, { type: 'input', value: '12' }]);

    expect(session.node.nodeId).toBe('n_invalid_code');
    expect(session.status).toBe('in_progress');
  });

  it('กรอกรหัสถูกรูปแบบ พาไปหน้าจบที่แทนค่ารหัสในข้อความแล้ว', async () => {
    const service = makeService();
    const session = await walk(service, ERROR_MESSAGE, [YES, { type: 'input', value: 'E1' }]);

    expect(session.node.isTerminal).toBe(true);
    expect(session.node.outcomeKind).toBe('handoff_informed');
    expect(session.node.text).toContain('E1');
    // ถ้ายังมี {{ ค้างอยู่ แปลว่าการแทนค่าพัง และผู้ใช้จะเห็น {{error_code}} บนหน้าจอ
    expect(session.node.text).not.toContain('{{');
  });

  it('ส่ง action ต่อหลังจบแล้ว ถูกปฏิเสธ', async () => {
    const service = makeService();
    const session = await walk(service, WATER_DRIPS, [YES]);
    expect(session.status).toBe('completed');

    await expect(service.submitAction(session.sessionId, YES)).rejects.toBeInstanceOf(
      SessionAlreadyCompletedError,
    );
  });

  it('ใช้ sessionId ที่ไม่มีอยู่ ได้ SessionNotFoundError', async () => {
    const service = makeService();

    await expect(service.getSession('ไม่มี-session-นี้')).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('ยกเลิกการตรวจแล้ว session หายไปจริง', async () => {
    const service = makeService();
    const session = await service.startSession(STOPS_WORKING);

    await service.abandonSession(session.sessionId);

    await expect(service.getSession(session.sessionId)).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('ใช้ graphId ที่ไม่มีอยู่ ได้ GraphNotFoundError', async () => {
    const service = makeService();

    await expect(service.startSession('ไม่มีกราฟนี้')).rejects.toBeInstanceOf(GraphNotFoundError);
  });
});
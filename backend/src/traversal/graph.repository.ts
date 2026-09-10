// backend/src/traversal/graph.repository.ts

/**
 * graph.repository.ts — โหลดกราฟทั้งหมดจาก MySQL เข้าหน่วยความจำตอนบูต
 *
 * หน้าที่เดียวของไฟล์นี้: แปลงข้อมูลจาก "รูปแบบตาราง" กลับเป็น "รูปแบบ JSON"
 * ที่ traversal-engine คาดหวัง แล้วเก็บไว้ในหน่วยความจำ
 *
 * ทำไมโหลดตอนบูตไม่ query ทุก request:
 *   - กราฟเป็นข้อมูลอ่านอย่างเดียว เปลี่ยนเฉพาะตอนรัน seed script
 *   - ระดับร้อยกราฟ กินหน่วยความจำไม่กี่ร้อย KB
 *   - ทุก request จึงเดินกราฟได้โดยไม่แตะฐานข้อมูลเลย
 *
 * หลัก fail-fast: ถ้าข้อมูลในฐานข้อมูลไม่ครบตามที่ engine ต้องการ
 * ให้ล้มตอนบูตพร้อมบอก graph_id/node_id ที่ผิด
 * ห้ามปล่อยผ่านเป็น undefined แล้วไปพังตอนผู้ใช้เดินถึงโหนดนั้น
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import {
  CheckpointNode,
  DeviceCategory,
  Difficulty,
  EscalationNode,
  InputNode,
  InputType,
  InstructionNode,
  NodeType,
  OutcomeKind,
  ResolutionNode,
  Severity,
  TroubleshootingGraph,
  TroubleshootingNode,
  UnsupportedSchemaVersionError,
} from '../traversal-engine/types';

// ============================================================
// รูปร่างแถวดิบที่ได้จาก MySQL
// ============================================================

/** 1 แถว = 1 กราฟ (JOIN manuals มาแล้วเพื่อเอา device_category/brand/model_pattern) */
interface GraphRow extends RowDataPacket {
  graph_id: string;
  manual_id: string;
  entry_symptom: string;
  entry_symptom_th: string | null;
  entry_symptom_aliases: unknown;
  source: string;
  page_start: number;
  page_end: number;
  source_chunk_id: string;
  severity: Severity | null;
  difficulty: Difficulty | null;
  config: unknown;
  entry_node: string;
  schema_version: number;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
}

/** 1 แถว = 1 โหนด — คอลัมน์ใช้ร่วมกันทั้ง 5 ประเภท ที่ไม่เกี่ยวจึงเป็น NULL */
interface NodeRow extends RowDataPacket {
  graph_id: string;
  node_id: string;
  node_type: NodeType;
  text_content: string;
  on_yes: string | null;
  on_no: string | null;
  next_node: string | null;
  on_invalid: string | null;
  input_type: InputType | null;
  input_pattern: string | null;
  store_as: string | null;
  outcome_kind: OutcomeKind | null;
  safety_critical: number;
  safety_warning: string | null;
  has_image: number;
  image_url: string | null;
  author_note: string | null;
  external_reference: unknown;
}

/** ข้อมูลย่อของกราฟ สำหรับ endpoint GET /traversal/graphs */
export interface GraphSummary {
  graphId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  brand: string;
  modelPattern: string;
  severity?: Severity;
  difficulty?: Difficulty;
}

/** ข้อมูลในฐานข้อมูลไม่ครบ/ไม่ถูกต้องตามที่ engine ต้องการ */
export class GraphDataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphDataIntegrityError';
  }
}

@Injectable()
export class GraphRepository implements OnModuleInit {
  private readonly logger = new Logger(GraphRepository.name);

  /** key = graph_id — ว่างจนกว่า onModuleInit จะทำงานเสร็จ */
  private readonly graphs = new Map<string, TroubleshootingGraph>();

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  /**
   * NestJS เรียกให้อัตโนมัติหลังสร้าง module เสร็จ ก่อนเปิดรับ request
   * ถ้า throw ที่นี่ แอปจะไม่บูตขึ้นเลย — ตั้งใจให้เป็นแบบนั้น
   */
  async onModuleInit(): Promise<void> {
    await this.loadAll();
  }

  // ============================================================
  // API ที่ service จะเรียกใช้
  // ============================================================

  /** คืนกราฟตาม id — undefined ถ้าไม่มี ให้ service เป็นคนตัดสินใจว่าจะโยน 404 ยังไง */
  findById(graphId: string): TroubleshootingGraph | undefined {
    return this.graphs.get(graphId);
  }

  /** รายการอาการทั้งหมด สำหรับหน้าเลือกอาการ */
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

  /** จำนวนกราฟที่โหลดได้ — ใช้ตรวจสอบและใน /health */
  get count(): number {
    return this.graphs.size;
  }

  /** จำนวนโหนดรวมทุกกราฟ — ใช้ยืนยันว่าได้ครบ 95 โหนด */
  get nodeCount(): number {
    let total = 0;
    for (const graph of this.graphs.values()) total += graph.nodes.length;
    return total;
  }

  // ============================================================
  // การโหลด
  // ============================================================

  /**
   * 2 query แยกกัน ไม่ JOIN nodes เข้ามาด้วย
   * เพราะ JOIN สามชั้นจะทำให้ข้อมูลระดับกราฟซ้ำตามจำนวนโหนด (95 แถวแทน 13)
   * แล้วต้องมานั่ง dedupe ในโค้ดอยู่ดี — แยก query อ่านง่ายกว่าและเร็วกว่า
   */
  private async loadAll(): Promise<void> {
    const [graphRows] = await this.pool.query<GraphRow[]>(
      `SELECT g.graph_id, g.manual_id, g.entry_symptom, g.entry_symptom_th,
              g.entry_symptom_aliases, g.source, g.page_start, g.page_end,
              g.source_chunk_id, g.severity, g.difficulty, g.config,
              g.entry_node, g.schema_version,
              m.device_category, m.brand, m.model_pattern
         FROM graphs g
         JOIN manuals m ON m.manual_id = g.manual_id
        ORDER BY g.graph_id`,
    );

    const [nodeRows] = await this.pool.query<NodeRow[]>(
      `SELECT graph_id, node_id, node_type, text_content,
              on_yes, on_no, next_node, on_invalid,
              input_type, input_pattern, store_as, outcome_kind,
              safety_critical, safety_warning, has_image, image_url,
              author_note, external_reference
         FROM nodes
        ORDER BY graph_id, display_order`,
    );

    // จัดกลุ่มโหนดตาม graph_id
    // (node_id ซ้ำข้ามกราฟได้ เพราะ PRIMARY KEY เป็นคู่ (graph_id, node_id)
    //  จึงห้ามทำ Map แบนที่ key ด้วย node_id อย่างเดียว)
    const nodesByGraph = new Map<string, NodeRow[]>();
    for (const row of nodeRows) {
      const list = nodesByGraph.get(row.graph_id);
      if (list) list.push(row);
      else nodesByGraph.set(row.graph_id, [row]);
    }

    this.graphs.clear();
    for (const graphRow of graphRows) {
      const rows = nodesByGraph.get(graphRow.graph_id) ?? [];
      this.graphs.set(graphRow.graph_id, this.buildGraph(graphRow, rows));
    }

    this.logger.log(
      `โหลดกราฟสำเร็จ ${this.count} กราฟ ${this.nodeCount} โหนด`,
    );
  }

  private buildGraph(row: GraphRow, nodeRows: NodeRow[]): TroubleshootingGraph {
    // ตรวจ schema_version จากค่าจริงในฐานข้อมูล ไม่ใช่ยัดค่าคงที่ลงไป
    if (row.schema_version !== 2) {
      throw new UnsupportedSchemaVersionError(row.schema_version, row.graph_id);
    }

    if (nodeRows.length === 0) {
      throw new GraphDataIntegrityError(
        `กราฟ '${row.graph_id}' ไม่มีโหนดเลยในตาราง nodes`,
      );
    }

    const nodes = nodeRows.map((n) => this.buildNode(n, row.graph_id));

    // entry_node ต้องชี้ไปยังโหนดที่มีอยู่จริง มิฉะนั้น session แรกจะพังทันที
    if (!nodes.some((n) => n.node_id === row.entry_node)) {
      throw new GraphDataIntegrityError(
        `กราฟ '${row.graph_id}' มี entry_node='${row.entry_node}' ` +
          `แต่ไม่พบโหนดนี้ในกราฟ`,
      );
    }

    return {
      schema_version: 2,
      graph_id: row.graph_id,
      device_category: row.device_category,
      brand: row.brand,
      model_pattern: row.model_pattern,
      entry_symptom: row.entry_symptom,
      entry_symptom_th: row.entry_symptom_th ?? undefined,
      entry_symptom_aliases: parseJsonColumn<string[]>(row.entry_symptom_aliases),
      source: row.source,
      page_range: [row.page_start, row.page_end],
      source_chunk_id: row.source_chunk_id,
      severity: row.severity ?? undefined,
      difficulty: row.difficulty ?? undefined,
      config: parseJsonColumn<Record<string, unknown>>(row.config),
      entry_node: row.entry_node,
      nodes,
    };
  }

  /**
   * แปลง 1 แถวเป็น 1 โหนด
   *
   * จุดสำคัญ: คอลัมน์ในตารางใช้ร่วมกันทั้ง 5 ประเภท จึงยอมให้เป็น NULL ได้
   * แต่ฝั่ง TypeScript แต่ละประเภทบังคับ field ของตัวเองไว้แน่นหนา
   * required() จึงทำหน้าที่เป็นด่านแปลง "NULL ที่ยอมได้ในตาราง"
   * ให้เป็น "error ที่ล้มตอนบูต" สำหรับช่องที่ประเภทนั้นขาดไม่ได้
   */
  private buildNode(row: NodeRow, graphId: string): TroubleshootingNode {
    const base = {
      node_id: row.node_id,
      safety_critical: row.safety_critical === 1,
      safety_warning: row.safety_warning ?? undefined,
      has_image: row.has_image === 1,
      image_url: row.image_url ?? undefined,
      author_note: row.author_note ?? undefined,
      external_reference: parseJsonColumn<never>(row.external_reference),
    };

    const need = (value: string | null, column: string): string =>
      required(value, column, graphId, row.node_id, row.node_type);

    switch (row.node_type) {
      case 'checkpoint': {
        const node: CheckpointNode = {
          ...base,
          type: 'checkpoint',
          question: row.text_content,
          on_yes: need(row.on_yes, 'on_yes'),
          on_no: need(row.on_no, 'on_no'),
        };
        return node;
      }

      case 'instruction': {
        const node: InstructionNode = {
          ...base,
          type: 'instruction',
          content: row.text_content,
          next: need(row.next_node, 'next_node'),
        };
        return node;
      }

      case 'input': {
        // ⚠️ โหนด input ใช้ field ชื่อ 'prompt' ไม่ใช่ 'content'
        // ถ้าใส่ผิดจะได้ string ว่างโดยไม่มี error ใดๆ (จุดพลาดที่บันทึกไว้ใน HANDOFF)
        const node: InputNode = {
          ...base,
          type: 'input',
          prompt: row.text_content,
          input_type: requiredEnum(
            row.input_type,
            'input_type',
            graphId,
            row.node_id,
          ),
          // pattern กับ on_invalid เป็น optional โดยตั้งใจ:
          // ไม่มี pattern = รับทุกค่า, ไม่มี on_invalid = วนกลับโหนดเดิม
          pattern: row.input_pattern ?? undefined,
          store_as: need(row.store_as, 'store_as'),
          next: need(row.next_node, 'next_node'),
          on_invalid: row.on_invalid ?? undefined,
        };
        return node;
      }

      case 'resolution': {
        const node: ResolutionNode = {
          ...base,
          type: 'resolution',
          content: row.text_content,
          outcome_kind: requiredEnum(
            row.outcome_kind,
            'outcome_kind',
            graphId,
            row.node_id,
          ),
        };
        return node;
      }

      case 'escalation': {
        const node: EscalationNode = {
          ...base,
          type: 'escalation',
          content: row.text_content,
          outcome_kind: requiredEnum(
            row.outcome_kind,
            'outcome_kind',
            graphId,
            row.node_id,
          ),
        };
        return node;
      }

      default: {
        // ENUM ในฐานข้อมูลกันไว้ชั้นหนึ่งแล้ว บรรทัดนี้คือด่านสุดท้าย
        // และทำให้ TypeScript ยืนยันว่าเราครอบคลุมครบทั้ง 5 ประเภท
        const unreachable: never = row.node_type;
        throw new GraphDataIntegrityError(
          `โหนด '${row.node_id}' ในกราฟ '${graphId}' ` +
            `มี node_type ที่ไม่รู้จัก: ${String(unreachable)}`,
        );
      }
    }
  }
}

// ============================================================
// ตัวช่วย
// ============================================================

/** NULL ในช่องที่ประเภทโหนดนั้นขาดไม่ได้ = ข้อมูลเสีย ต้องล้มตอนบูต */
function required(
  value: string | null,
  column: string,
  graphId: string,
  nodeId: string,
  nodeType: NodeType,
): string {
  if (value === null || value === '') {
    throw new GraphDataIntegrityError(
      `โหนด '${nodeId}' ในกราฟ '${graphId}' เป็น type='${nodeType}' ` +
        `ซึ่งต้องมีคอลัมน์ '${column}' แต่ค่าเป็น NULL/ว่าง`,
    );
  }
  return value;
}

/** เหมือน required() แต่รักษา type ของ enum ไว้ (InputType / OutcomeKind) */
function requiredEnum<T extends string>(
  value: T | null,
  column: string,
  graphId: string,
  nodeId: string,
): T {
  if (value === null) {
    throw new GraphDataIntegrityError(
      `โหนด '${nodeId}' ในกราฟ '${graphId}' ต้องมีคอลัมน์ '${column}' ` +
        `แต่ค่าเป็น NULL`,
    );
  }
  return value;
}

/**
 * คอลัมน์ชนิด JSON ของ MySQL — mysql2 แปลงเป็น object ให้แล้ว
 * แต่บาง config (เช่นเปิด typeCast เอง) อาจได้ string กลับมา
 * ฟังก์ชันนี้จึงรับทั้งสองแบบ ไม่ให้ JSON.parse ซ้ำจนโยน error
 */
function parseJsonColumn<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return JSON.parse(trimmed) as T;
  }
  return value as T;
}
// backend/src/traversal-engine/types.ts

/**
 * types.ts — รูปร่างข้อมูลทั้งหมดของ Traversal Engine
 *
 * ไฟล์นี้ "บริสุทธิ์" ไม่ import NestJS หรือ library ภายนอกใดๆ เลย
 * (ตามหลักการที่ล็อกไว้: engine ต้องเทสได้เร็วโดยไม่ต้อง bootstrap server)
 *
 * โครงสร้าง node/graph อ้างอิงตรงจาก
 * data/schemas/troubleshooting-graph.v2.schema.json
 */

// ============================================================
// โหนด 5 แบบ
// ============================================================

export type NodeType = 'checkpoint' | 'instruction' | 'input' | 'resolution' | 'escalation';

export type InputType = 'error_code' | 'model_number' | 'number' | 'text';

/**
 * สิ่งที่เกิดขึ้นจริงเมื่อถึงโหนดจบ (resolution/escalation)
 * user_fixed        = ทำตามขั้นตอนแล้วแก้ปัญหาได้จริง
 * normal_behavior   = ไม่ได้เสีย เป็นการทำงานปกติของเครื่อง
 * handoff_informed  = ส่งต่อช่าง พร้อมข้อมูลเจาะจง (เช่น error code)
 * handoff_unknown   = ส่งต่อช่าง เพราะกราฟไม่มีคำตอบสำหรับกรณีนี้แล้ว
 */
export type OutcomeKind = 'user_fixed' | 'normal_behavior' | 'handoff_informed' | 'handoff_unknown';

interface ExternalReference {
  document: string;
  section: string;
  page?: number;
  in_knowledge_base: boolean;
}

/** field ที่ทุกโหนดมีร่วมกันได้ ไม่ว่าจะเป็นประเภทไหน */
interface BaseNode {
  node_id: string;
  /** ต้องกดยืนยัน (confirm_safety) ก่อนเดินต่อได้ — ใช้จริงแค่กับ type: 'instruction' */
  safety_critical?: boolean;
  safety_warning?: string;
  has_image?: boolean;
  image_url?: string;
  /** ระบุว่าข้อความนี้ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือต้นฉบับ */
  author_note?: string;
  external_reference?: ExternalReference;
}

/** คำถามใช่/ไม่ใช่ — เช่น "เบรกเกอร์ตกไหม?" */
export interface CheckpointNode extends BaseNode {
  type: 'checkpoint';
  question: string;
  on_yes: string;
  on_no: string;
}

/** บอกให้ผู้ใช้ทำอะไรสักอย่าง แล้วไปโหนดถัดไปโหนดเดียวเสมอ */
export interface InstructionNode extends BaseNode {
  type: 'instruction';
  content: string;
  next: string;
}

/** ขอให้ผู้ใช้พิมพ์ค่าเข้ามา (ไม่ใช่ใช่/ไม่ใช่) เช่น รหัส error */
export interface InputNode extends BaseNode {
  type: 'input';
  prompt: string;
  input_type: InputType;
  /** regex ที่คำตอบต้องผ่าน ถ้าไม่ระบุ = รับทุกค่า */
  pattern?: string;
  /** key ที่จะเอาค่าไปเก็บใน session.variables */
  store_as: string;
  next: string;
  /** ถ้าไม่ระบุ = วนกลับมาถามโหนดเดิมเมื่อคำตอบไม่ผ่าน pattern */
  on_invalid?: string;
}

/** จบแบบแก้ปัญหาได้แล้ว หรือเป็นเรื่องปกติ — ไม่มีเส้นออก */
export interface ResolutionNode extends BaseNode {
  type: 'resolution';
  content: string;
  outcome_kind: OutcomeKind;
}

/** จบแบบต้องส่งต่อช่าง/ศูนย์บริการ — ไม่มีเส้นออก */
export interface EscalationNode extends BaseNode {
  type: 'escalation';
  content: string;
  outcome_kind: OutcomeKind;
}

export type TroubleshootingNode =
  | CheckpointNode
  | InstructionNode
  | InputNode
  | ResolutionNode
  | EscalationNode;

// ============================================================
// กราฟ 1 อัน (1 อาการ เช่น "แอร์เปิดไม่ติด")
// ============================================================

export type DeviceCategory =
  | 'Air Conditioner'
  | 'Refrigerator'
  | 'Washing Machine'
  | 'Microwave'
  | 'Television';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TroubleshootingGraph {
  schema_version: 2;
  graph_id: string;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
  entry_symptom: string;
  entry_symptom_th?: string;
  entry_symptom_aliases?: string[];
  source: string;
  page_range: [number, number];
  source_chunk_id: string;
  severity?: Severity;
  difficulty?: Difficulty;
  /**
   * ค่าคงที่จากคู่มือ (เช่น "ระยะท่อขั้นต่ำ 3 เมตร") — เป็นแค่ provenance
   * engine ไม่ได้อ่านค่านี้ไปใช้ตัดสินใจ เพราะตัวเลขถูกฝังไว้ใน question/content
   * ของโหนดโดยตรงอยู่แล้ว (config มีไว้อธิบายที่มาของตัวเลขนั้นเฉยๆ)
   */
  config?: Record<string, unknown>;
  entry_node: string;
  nodes: TroubleshootingNode[];
}

/**
 * รูปร่างไฟล์ 1 คู่มือ (เช่น data/manuals/samsung_ac_ar70h.json)
 * — ไว้เผื่ออ้างอิง ตัว engine เองรับแค่ TroubleshootingGraph อันเดียวที่เลือกมาแล้ว
 * ส่วนจะหยิบกราฟไหนจากไฟล์นี้มาใช้ เป็นหน้าที่ของ retrieval (Phase 8) ไม่ใช่ engine
 */
export interface ManualFile {
  schema_version: 2;
  manual_id: string;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
  source_manual: string;
  count: number;
  graphs: TroubleshootingGraph[];
}

// ============================================================
// สถานะ session ที่ engine ต้องจำระหว่างคุย
// ============================================================

export type SessionStatus = 'in_progress' | 'completed';

export interface SessionHistoryEntry {
  nodeId: string;
  /** action ที่ทำให้ออกจากโหนดนี้ (ไม่มีค่าสำหรับโหนดแรกสุดที่ยังไม่มี action ใดๆ) */
  action?: TraversalAction;
}

export interface SessionState {
  sessionId: string;
  graphId: string;
  currentNodeId: string;
  status: SessionStatus;
  /** ค่าที่เก็บจากโหนด input เช่น { error_code: "E1" } */
  variables: Record<string, string>;
  history: SessionHistoryEntry[];
}

// ============================================================
// คำสั่งที่ผู้ใช้ส่งเข้ามา — 1 รูปแบบต่อโหนด 1 แบบ
// ============================================================

export type TraversalAction =
  | { type: 'answer'; value: 'yes' | 'no' } // ตอบ checkpoint
  | { type: 'continue' } // ผ่าน instruction ที่ไม่ safety_critical
  | { type: 'confirm_safety' } // ยืนยันคำเตือน แล้วผ่าน instruction ที่ safety_critical
  | { type: 'input'; value: string }; // กรอกค่าให้โหนด input

// ============================================================
// สิ่งที่ engine ส่งกลับไปให้ฝั่งแสดงผล
// ============================================================

export interface NodeReference {
  source: string;
  pageRange: [number, number];
}

export interface RenderedNode {
  nodeId: string;
  type: NodeType;
  /** ข้อความของโหนด (question/content/prompt) ที่แทน {{ตัวแปร}} แล้ว */
  text: string;
  safetyCritical: boolean;
  safetyWarning?: string;
  /** true = โหนดนี้เดินต่อไม่ได้จนกว่าจะส่ง action 'confirm_safety' มาก่อน */
  requiresSafetyConfirmation: boolean;
  /** มีค่าเฉพาะ type: 'input' — บอกฝั่งหน้าจอว่าควรใช้คีย์บอร์ดแบบไหน */
  inputType?: InputType;
  isTerminal: boolean;
  /** มีค่าเฉพาะโหนดจบ (resolution/escalation) */
  outcomeKind?: OutcomeKind;
  /** ที่มาของคำตอบ ดึงจากระดับกราฟเสมอ ไม่ใช่ให้ LLM สร้างขึ้นเอง */
  reference: NodeReference;
}

// ============================================================
// ข้อผิดพลาด
// ============================================================

/** base class ของ error ทั้งหมดที่ engine โยนออกมา */
export class TraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** กราฟที่ส่งเข้ามาไม่ใช่ schema_version 2 — engine ตัวนี้ถูกสร้างมาสำหรับ v2 เท่านั้น */
export class UnsupportedSchemaVersionError extends TraversalError {
  constructor(received: unknown, graphId: string) {
    super(`Graph '${graphId}' มี schema_version=${String(received)} แต่ engine รองรับเฉพาะ v2`);
  }
}

/** อ้างถึง node_id ที่ไม่มีอยู่จริงในกราฟ — ปกติไม่ควรเกิดถ้าผ่าน validate_graph.py แล้ว */
export class NodeNotFoundError extends TraversalError {
  constructor(nodeId: string, graphId: string) {
    super(`ไม่พบโหนด '${nodeId}' ใน graph '${graphId}' — กราฟอาจเสียหรือยังไม่ผ่าน validate_graph.py`);
  }
}

/** ส่ง action ที่ใช้กับโหนดปัจจุบันไม่ได้ เช่น ส่ง answer ไปให้โหนด input */
export class InvalidActionError extends TraversalError {
  constructor(actionType: string, nodeType: NodeType, nodeId: string) {
    super(`Action '${actionType}' ใช้กับโหนด '${nodeId}' (type=${nodeType}) ไม่ได้`);
  }
}

/** โหนดเป็น safety_critical แต่ส่ง 'continue' มาแทนที่จะเป็น 'confirm_safety' */
export class SafetyConfirmationRequiredError extends TraversalError {
  constructor(nodeId: string) {
    super(`โหนด '${nodeId}' เป็น safety_critical ต้องส่ง action 'confirm_safety' เท่านั้น จะใช้ 'continue' เฉยๆ ไม่ได้`);
  }
}

/** session ถึงโหนดจบไปแล้ว (resolution/escalation) แต่ยังมีคนพยายามส่ง action เพิ่ม */
export class SessionAlreadyCompletedError extends TraversalError {
  constructor(sessionId: string) {
    super(`Session '${sessionId}' จบไปแล้ว ส่ง action เพิ่มไม่ได้อีก`);
  }
}
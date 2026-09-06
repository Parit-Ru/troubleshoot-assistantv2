// backend/src/traversal-engine/traversal-engine.ts

/**
 * traversal-engine.ts — ตัวเดินกราฟจริง
 *
 * 3 ฟังก์ชันหลักที่ export ออกไปใช้ (pure — ไม่แก้ object เดิม คืนของใหม่เสมอ):
 *   - startSession   เริ่ม session ใหม่ที่ entry_node
 *   - getCurrentNode ขอดูโหนดปัจจุบันซ้ำ (เช่น ตอน refresh หน้าจอ)
 *   - submitAction   ส่งคำตอบ/คำสั่งเข้ามา แล้วได้โหนดถัดไปกลับมา
 *
 * ไฟล์นี้ไม่ import NestJS หรืออะไรที่ต้องมี server รันอยู่เลย
 */

import { randomUUID } from 'node:crypto';
import {
  TroubleshootingGraph,
  TroubleshootingNode,
  ResolutionNode,
  EscalationNode,
  SessionState,
  SessionStatus,
  TraversalAction,
  RenderedNode,
  NodeReference,
  NodeNotFoundError,
  InvalidActionError,
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
  UnsupportedSchemaVersionError,
} from './types';

// ============================================================
// ฟังก์ชันหลักที่ใช้จากภายนอก
// ============================================================

export function startSession(graph: TroubleshootingGraph): { session: SessionState; node: RenderedNode } {
  assertSupportedSchema(graph);

  const index = buildNodeIndex(graph);
  const entryNode = index.get(graph.entry_node);
  if (!entryNode) {
    throw new NodeNotFoundError(graph.entry_node, graph.graph_id);
  }

  const session: SessionState = {
    sessionId: randomUUID(),
    graphId: graph.graph_id,
    currentNodeId: graph.entry_node,
    status: 'in_progress',
    variables: {},
    history: [],
  };

  return { session, node: renderNode(entryNode, graph, session.variables) };
}

export function getCurrentNode(session: SessionState, graph: TroubleshootingGraph): RenderedNode {
  assertSupportedSchema(graph);

  const index = buildNodeIndex(graph);
  const node = index.get(session.currentNodeId);
  if (!node) {
    throw new NodeNotFoundError(session.currentNodeId, graph.graph_id);
  }

  return renderNode(node, graph, session.variables);
}

export function submitAction(
  session: SessionState,
  graph: TroubleshootingGraph,
  action: TraversalAction,
): { session: SessionState; node: RenderedNode } {
  assertSupportedSchema(graph);

  // ด่านแรก: จบไปแล้วห้ามเดินต่อ ไม่ว่า action จะเป็นอะไรก็ตาม
  if (session.status === 'completed') {
    throw new SessionAlreadyCompletedError(session.sessionId);
  }

  const index = buildNodeIndex(graph);
  const currentNode = index.get(session.currentNodeId);
  if (!currentNode) {
    throw new NodeNotFoundError(session.currentNodeId, graph.graph_id);
  }

  // ด่านที่สอง: หา node ถัดไป — ตรงนี้เป็นจุดเดียวที่เช็ค action ตรงกับชนิดโหนดไหม
  // และเป็นจุดที่บังคับ safety gate ด้วย
  const { nextNodeId, updatedVariables } = resolveNextNode(currentNode, action, session.variables);

  const nextNode = index.get(nextNodeId);
  if (!nextNode) {
    throw new NodeNotFoundError(nextNodeId, graph.graph_id);
  }

  const nextStatus: SessionStatus = isTerminalNode(nextNode) ? 'completed' : 'in_progress';

  const nextSession: SessionState = {
    ...session,
    currentNodeId: nextNodeId,
    status: nextStatus,
    variables: updatedVariables,
    history: [...session.history, { nodeId: session.currentNodeId, action }],
  };

  return { session: nextSession, node: renderNode(nextNode, graph, updatedVariables) };
}

// ============================================================
// การตัดสินใจว่า "action นี้ใช้กับโหนดนี้ได้ไหม แล้วจะไปโหนดไหนต่อ"
// นี่คือจุดที่ตรรกะของกราฟทั้งหมดอยู่ — ไม่มีที่ไหนอื่นตัดสินใจแทน
// ============================================================

function resolveNextNode(
  node: TroubleshootingNode,
  action: TraversalAction,
  variables: Record<string, string>,
): { nextNodeId: string; updatedVariables: Record<string, string> } {
  switch (node.type) {
    case 'checkpoint': {
      if (action.type !== 'answer') {
        throw new InvalidActionError(action.type, node.type, node.node_id);
      }
      return {
        nextNodeId: action.value === 'yes' ? node.on_yes : node.on_no,
        updatedVariables: variables,
      };
    }

    case 'instruction': {
      if (node.safety_critical) {
        // safety_critical=true: ต้องเป็น confirm_safety เท่านั้น
        // ส่ง continue มา = พยายามข้ามคำเตือน ต้องบล็อกตรงนี้
        if (action.type === 'continue') {
          throw new SafetyConfirmationRequiredError(node.node_id);
        }
        if (action.type !== 'confirm_safety') {
          throw new InvalidActionError(action.type, node.type, node.node_id);
        }
      } else if (action.type !== 'continue') {
        throw new InvalidActionError(action.type, node.type, node.node_id);
      }
      return { nextNodeId: node.next, updatedVariables: variables };
    }

    case 'input': {
      if (action.type !== 'input') {
        throw new InvalidActionError(action.type, node.type, node.node_id);
      }
      const isValid = !node.pattern || new RegExp(node.pattern).test(action.value);
      if (isValid) {
        // เก็บค่าไว้ใน session ก่อนเดินต่อ — ค่านี้อาจถูกเอาไปโชว์ซ้ำผ่าน {{store_as}}
        return {
          nextNodeId: node.next,
          updatedVariables: { ...variables, [node.store_as]: action.value },
        };
      }
      // ไม่ผ่าน pattern: ไม่เก็บค่า แล้ววนไป on_invalid (หรือกลับโหนดเดิมถ้าไม่ระบุ)
      return {
        nextNodeId: node.on_invalid ?? node.node_id,
        updatedVariables: variables,
      };
    }

    case 'resolution':
    case 'escalation':
      // ไม่ควรมาถึงบรรทัดนี้ได้จริง เพราะ submitAction เช็ค
      // session.status === 'completed' ไปก่อนแล้วตั้งแต่ต้นฟังก์ชัน
      // (โหนดจบไม่มีเส้นออก จึงไม่มี action ไหนที่ "ถูกต้อง" สำหรับมัน)
      throw new InvalidActionError(action.type, node.type, node.node_id);
  }
}

// ============================================================
// แปลงโหนดดิบให้พร้อมแสดงผล (RenderedNode)
// ============================================================

function renderNode(
  node: TroubleshootingNode,
  graph: TroubleshootingGraph,
  variables: Record<string, string>,
): RenderedNode {
  const reference: NodeReference = {
    source: graph.source,
    pageRange: graph.page_range,
  };

  return {
    nodeId: node.node_id,
    type: node.type,
    text: interpolate(getRawText(node), variables),
    safetyCritical: node.safety_critical === true,
    safetyWarning: node.safety_warning,
    requiresSafetyConfirmation: node.type === 'instruction' && node.safety_critical === true,
    inputType: node.type === 'input' ? node.input_type : undefined,
    isTerminal: isTerminalNode(node),
    outcomeKind: isTerminalNode(node) ? node.outcome_kind : undefined,
    reference,
  };
}

function getRawText(node: TroubleshootingNode): string {
  switch (node.type) {
    case 'checkpoint':
      return node.question;
    case 'instruction':
      return node.content;
    case 'input':
      return node.prompt;
    case 'resolution':
    case 'escalation':
      return node.content;
  }
}

/** type guard: ใช้เพื่อให้ TypeScript รู้ว่าเข้าถึง .outcome_kind ได้อย่างปลอดภัย */
function isTerminalNode(node: TroubleshootingNode): node is ResolutionNode | EscalationNode {
  return node.type === 'resolution' || node.type === 'escalation';
}

/**
 * แทน {{key}} ด้วยค่าจริงจาก variables
 * ถ้า key ไม่มีอยู่ใน variables (ไม่ควรเกิดถ้ากราฟผ่าน validate_graph.py rule #9 แล้ว)
 * จะปล่อย {{key}} ทิ้งไว้ตรงๆ แทนที่จะแทนด้วยค่าว่าง — เพื่อให้บั๊กเห็นชัด ไม่ซ่อนไว้
 */
function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

function buildNodeIndex(graph: TroubleshootingGraph): Map<string, TroubleshootingNode> {
  const index = new Map<string, TroubleshootingNode>();
  for (const node of graph.nodes) {
    index.set(node.node_id, node);
  }
  return index;
}

/**
 * เช็คตอนรันจริงว่า schema_version เป็น 2 จริง
 * TypeScript บอกว่า field นี้เป็น literal type 2 เสมอก็จริง แต่นั่นคือตอน compile-time
 * ข้อมูลจริงมาจาก JSON.parse (เป็น any) เผลอส่งกราฟ v1 เข้ามาได้เสมอ จึงต้องเช็คจริงตรงนี้
 */
function assertSupportedSchema(graph: TroubleshootingGraph): void {
  if (graph.schema_version !== 2) {
    throw new UnsupportedSchemaVersionError(graph.schema_version, graph.graph_id);
  }
}
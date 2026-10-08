/**
 * symptom-matcher.ts — ตรรกะจับคู่อาการ (ฟังก์ชันล้วน ไม่ import NestJS)
 *
 * หน้าที่: รับ "เวกเตอร์ของคำค้น" กับ "ดัชนีเวกเตอร์ของข้อความอาการ"
 * แล้วบอกว่าผังขั้นตอนไหนคล้ายที่สุด
 *
 * ไฟล์นี้ไม่รู้จักโมเดล ฐานข้อมูล หรือ NestJS เลย
 * (แปลงข้อความเป็นเวกเตอร์เป็นหน้าที่ของ EmbeddingService)
 * จึงเทสได้เร็วโดยใช้เวกเตอร์ปลอม
 *
 * หมายเหตุ: คะแนน cosine ไม่ใช่ความน่าจะเป็น
 * ต้องเรียกว่า "คะแนนความคล้าย" ห้ามแสดงเป็น "มั่นใจ x%"
 */

import type { TroubleshootingGraph } from '../traversal-engine/types';

/** ส่วนของผังขั้นตอนที่ใช้สร้างข้อความอาการ (ใช้ชื่อ field ตาม TroubleshootingGraph) */
export type SymptomSource = Pick<
  TroubleshootingGraph,
  'graph_id' | 'entry_symptom' | 'entry_symptom_th' | 'entry_symptom_aliases'
>;

/** ข้อความอาการ 1 ข้อความ พร้อมบอกว่าเป็นของผังไหน */
export interface SymptomText {
  graphId: string;
  text: string;
}

/** ข้อความอาการที่แปลงเป็นเวกเตอร์แล้ว (1 แถวของดัชนีในหน่วยความจำ) */
export interface IndexedSymptom extends SymptomText {
  vector: ArrayLike<number>;
}

/** ผลจัดอันดับ: 1 แถวต่อ 1 ผัง */
export interface RankedGraph {
  graphId: string;
  /** cosine สูงสุดในบรรดาข้อความอาการของผังนี้ (ค่าเต็ม ยังไม่ปัดเศษ) */
  score: number;
  /** ข้อความอาการที่ทำให้ได้คะแนนสูงสุด */
  matchedText: string;
}

/**
 * cosine similarity = (a·b) / (|a| × |b|)
 * - ความยาวเวกเตอร์ไม่เท่ากัน → โยน error (แปลว่าใช้โมเดลคนละตัวปนกัน)
 * - เวกเตอร์ใดเป็นศูนย์ทั้งหมด → คืน 0 (กันหารด้วยศูนย์)
 */
export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`,
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * สร้างรายการข้อความอาการของทุกผัง
 * ลำดับต่อผัง: ไทย → อังกฤษ → คำพ้อง
 * ข้อความว่าง (หรือมีแต่ช่องว่าง) ถูกข้าม
 * ใช้เฉพาะ field ที่มีอยู่ในข้อมูลแล้ว ไม่แต่งประโยคเพิ่ม
 */
export function buildSymptomTexts(graphs: SymptomSource[]): SymptomText[] {
  const result: SymptomText[] = [];

  for (const g of graphs) {
    const candidates: Array<string | undefined | null> = [
      g.entry_symptom_th,
      g.entry_symptom,
      ...(g.entry_symptom_aliases ?? []),
    ];

    for (const raw of candidates) {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length > 0) {
        result.push({ graphId: g.graph_id, text });
      }
    }
  }

  return result;
}

/**
 * จัดอันดับผังตามความคล้ายกับคำค้น
 * - คะแนนของผัง = cosine สูงสุดของข้อความอาการทุกข้อความในผังนั้น
 * - คืน 1 แถวต่อผัง เรียงคะแนนมากไปน้อย
 * - คะแนนเท่ากัน เรียงตาม graphId (ให้ผลซ้ำได้เสมอ)
 */
export function rankGraphs(
  queryVector: ArrayLike<number>,
  index: IndexedSymptom[],
): RankedGraph[] {
  const best = new Map<string, RankedGraph>();

  for (const item of index) {
    const score = cosineSimilarity(queryVector, item.vector);
    const current = best.get(item.graphId);
    if (current === undefined || score > current.score) {
      best.set(item.graphId, {
        graphId: item.graphId,
        score,
        matchedText: item.text,
      });
    }
  }

  return [...best.values()].sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.graphId < y.graphId) return -1;
    if (x.graphId > y.graphId) return 1;
    return 0;
  });
}

/**
 * เลือกผังที่ผ่านเกณฑ์ (score >= threshold) และไม่เกิน max รายการ
 * รับ ranked ที่เรียงแล้วจาก rankGraphs
 * ถ้าไม่มีผังผ่านเกณฑ์ → คืนรายการว่าง (ผู้เรียกต้องส่งต่อศูนย์บริการ ห้ามเดา)
 */
export function selectMatches(
  ranked: RankedGraph[],
  threshold: number,
  max: number,
): RankedGraph[] {
  return ranked.filter((r) => r.score >= threshold).slice(0, Math.max(0, max));
}
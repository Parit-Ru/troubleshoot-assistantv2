// backend/src/traversal/traversal.dto.spec.ts

/**
 * เทสตัวตรวจ body ของ POST /traversal/sessions (ส่วนที่เพิ่ม query ไม่บังคับ ในขั้น 1.8)
 * ฟังก์ชันบริสุทธิ์ เทสได้โดยไม่ต้องเปิดเซิร์ฟเวอร์
 */

import { MAX_QUERY_LENGTH } from '../symptom-search/symptom-search.dto';
import { InvalidRequestBodyError, parseStartSessionBody } from './traversal.dto';

describe('parseStartSessionBody', () => {
  it('มีแค่ graphId (เลือกจากรายการเอง) → คืน { graphId } ไม่มี field query', () => {
    const result = parseStartSessionBody({ graphId: 'g1' });
    expect(result).toEqual({ graphId: 'g1' });
    expect('query' in result).toBe(false);
  });

  it('มี query ที่ถูกต้อง → คืนทั้งสอง field และตัดช่องว่างหน้าหลังของ query', () => {
    expect(parseStartSessionBody({ graphId: 'g1', query: '  แอร์ดับ ' })).toEqual({
      graphId: 'g1',
      query: 'แอร์ดับ',
    });
  });

  it('ยังทิ้ง field แปลกปลอม (เช่น confidence ที่หน้าจอพยายามส่งมาเอง)', () => {
    const result = parseStartSessionBody({ graphId: 'g1', query: 'แอร์ดับ', confidence: 1 });
    expect(Object.keys(result).sort()).toEqual(['graphId', 'query']);
  });

  it('query ไม่ใช่ข้อความ / ว่าง / มีแต่ช่องว่าง → โยน InvalidRequestBodyError', () => {
    for (const bad of [123, null, true, ['แอร์'], '', '   ']) {
      expect(() => parseStartSessionBody({ graphId: 'g1', query: bad })).toThrow(
        InvalidRequestBodyError,
      );
    }
  });

  it('query ยาวเกิน MAX_QUERY_LENGTH → โยน error · ยาวพอดีผ่าน', () => {
    expect(() =>
      parseStartSessionBody({ graphId: 'g1', query: 'ก'.repeat(MAX_QUERY_LENGTH + 1) }),
    ).toThrow(InvalidRequestBodyError);
    expect(() =>
      parseStartSessionBody({ graphId: 'g1', query: 'ก'.repeat(MAX_QUERY_LENGTH) }),
    ).not.toThrow();
  });

  it('graphId ผิดรูปแบบยังถูกปฏิเสธเหมือนเดิม', () => {
    for (const bad of [{}, { graphId: '' }, { graphId: 5 }, null]) {
      expect(() => parseStartSessionBody(bad)).toThrow(InvalidRequestBodyError);
    }
  });
});
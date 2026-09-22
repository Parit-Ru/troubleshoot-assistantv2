import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  abandonSession,
  getHealth,
  getSession,
  listGraphs,
  startSession,
  submitAction,
} from './traversal'
import type { SessionResponse, TraversalAction } from './types'

/**
 * hook ของ React Query ที่หน้าจอเรียกใช้
 * หน้าจอทุกหน้าเรียกผ่านไฟล์นี้ ไม่เรียก traversal.ts ตรงๆ
 *
 * useQuery    = อ่านข้อมูล ทำงานเองเมื่อหน้าจอแสดง
 * useMutation = เปลี่ยนข้อมูล ทำงานเมื่อสั่ง .mutate() เท่านั้น
 */

/**
 * key ของแคช รวมไว้ที่เดียว
 * key ต้องตรงกันทุกตัวอักษรทั้งตอนอ่านและตอนเขียนแคช
 * ถ้าพิมพ์ต่างกัน แคชจะไม่เชื่อมกัน แล้วหน้าจอจะไม่อัปเดตโดยไม่มี error เตือน
 */
export const queryKeys = {
  health: ['health'] as const,
  graphs: ['graphs'] as const,
  session: (sessionId: string) => ['session', sessionId] as const,
}

// ============================================================
// อ่านข้อมูล
// ============================================================

/**
 * สถานะเซิร์ฟเวอร์จริง
 * ในโหมดจำลองไม่เรียกเลย (enabled: false) เพราะไม่มีเซิร์ฟเวอร์ให้เช็ค
 */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    enabled: import.meta.env.VITE_USE_MOCK !== 'true',
    staleTime: 30_000,
  })
}

/**
 * รายการอาการทั้งหมด
 * staleTime ไม่มีวันเก่า เพราะเปลี่ยนเฉพาะตอน seed ข้อมูลใหม่ ไม่เปลี่ยนระหว่างใช้งาน
 */
export function useGraphs() {
  return useQuery({
    queryKey: queryKeys.graphs,
    queryFn: listGraphs,
    staleTime: Infinity,
  })
}

/**
 * session ปัจจุบันและโหนดที่กำลังอยู่
 *
 * ปกติไม่ต้องเรียกเซิร์ฟเวอร์เลย เพราะ useStartSession ใส่ค่าในแคชไว้ให้แล้ว
 * จะเรียกจริงก็ต่อเมื่อเปิดลิงก์ตรงหรือกด F5 ซึ่งแคชว่างเปล่า
 */
export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => getSession(sessionId),
  })
}

// ============================================================
// เปลี่ยนข้อมูล
// ============================================================

/**
 * เริ่มการตรวจ
 * เอาผลใส่แคชทันที หน้าตรวจอาการจะเปิดขึ้นมาพร้อมข้อมูล ไม่ต้องรอโหลดซ้ำ
 */
export function useStartSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (graphId: string) => startSession(graphId),
    onSuccess: (session: SessionResponse) => {
      queryClient.setQueryData(queryKeys.session(session.sessionId), session)
    },
  })
}

/**
 * ส่งคำตอบหรือคำสั่งหนึ่งครั้ง
 *
 * เซิร์ฟเวอร์ตอบ session ใหม่พร้อมโหนดถัดไปกลับมา เอาใส่แคชเลย
 * หน้าจอจึงเปลี่ยนเป็นขั้นถัดไปทันที ไม่ต้องยิงไปขอซ้ำ
 *
 * ถ้าเซิร์ฟเวอร์ปฏิเสธ เช่นด่านความปลอดภัย onSuccess จะไม่ทำงาน
 * แคชจึงยังเป็นโหนดเดิม หน้าจอไม่ขยับ — ตรงกับสถานะจริงบนเซิร์ฟเวอร์
 */
export function useSubmitAction(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: TraversalAction) => submitAction(sessionId, action),
    onSuccess: (session: SessionResponse) => {
      queryClient.setQueryData(queryKeys.session(sessionId), session)
    },
  })
}

/**
 * ยกเลิกการตรวจ
 * ลบออกจากแคชด้วย ไม่งั้นถ้ากดย้อนกลับมาจะเห็นขั้นตอนเก่าที่เซิร์ฟเวอร์ลบไปแล้ว
 */
export function useAbandonSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => abandonSession(sessionId),
    onSuccess: (_result: void, sessionId: string) => {
      queryClient.removeQueries({ queryKey: queryKeys.session(sessionId) })
    },
  })
}
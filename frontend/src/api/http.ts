import type { ApiErrorBody } from './types'

/**
 * ความล้มเหลวทุกแบบถูกแปลงเป็น error ตัวนี้ตัวเดียว
 * หน้าจอจะได้ไม่ต้องแยกแยะเองว่าเน็ตไม่ติด หรือเซิร์ฟเวอร์ตอบไม่สำเร็จ
 *
 * เขียน field แยกบรรทัดแทนการย่อไว้ใน constructor
 * เพราะ tsconfig ตั้ง erasableSyntaxOnly ซึ่งห้ามไวยากรณ์แบบย่อนั้น
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * อ่านค่าในฟังก์ชัน ไม่ใช่บนสุดของไฟล์ ด้วย 2 เหตุผล
 *   1. ถ้าอ่านตอน import แล้วค่าหาย แอปจะพังเป็นหน้าขาวก่อน React ได้วาดอะไร
 *      ทำให้ไม่มีที่แสดงข้อความบอกสาเหตุ
 *   2. เทสใช้ vi.stubEnv ซึ่งสั่งหลัง import จะไม่ทันถ้าอ่านตอน import
 *
 * ตั้งใจไม่มีค่าสำรองเป็น localhost — นั่นคือบั๊กเดิมของ lib/api.ts
 * ที่ทำให้เว็บซึ่ง deploy แล้วไปเรียกเซิร์ฟเวอร์ในเครื่องของผู้ใช้เอง
 */
function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL
  if (!baseUrl) {
    throw new Error('ไม่ได้ตั้งค่า VITE_API_URL — ตรวจไฟล์ .env.development หรือ .env.production')
  }
  return baseUrl
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
}

/**
 * เรียกเซิร์ฟเวอร์หนึ่งครั้ง
 *
 * @param path ต้องขึ้นต้นด้วย / เช่น '/traversal/graphs'
 *             ส่วน VITE_API_URL ต้องไม่มี / ท้าย จะได้ไม่กลายเป็น //
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options
  const url = `${getBaseUrl()}${path}`

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch โยน error เฉพาะตอนเรียกไม่ติดจริงๆ เช่น เน็ตหลุด เซิร์ฟเวอร์ดับ หรือ CORS
    // ส่วนกรณีเซิร์ฟเวอร์ตอบ 400 หรือ 500 จะไม่เข้ามาตรงนี้ ต้องเช็ค response.ok เอง
    throw new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
  }

  if (!response.ok) {
    // body อาจไม่ใช่ JSON ได้ เช่น Render ส่งหน้า error เป็น HTML กลับมา
    // จึงต้องดักไว้ ไม่งั้นจะพังด้วย error คนละเรื่องแล้วหาสาเหตุยาก
    let parsed: ApiErrorBody | undefined
    try {
      parsed = (await response.json()) as ApiErrorBody
    } catch {
      parsed = undefined
    }

    throw new ApiError(
      response.status,
      parsed?.code ?? 'UNKNOWN_ERROR',
      parsed?.message ?? `เซิร์ฟเวอร์ตอบรหัส ${response.status}`,
    )
  }

  // DELETE session ตอบ 204 ซึ่งไม่มี body เรียก .json() จะพัง
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
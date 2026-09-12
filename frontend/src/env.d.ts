/// <reference types="vite/client" />

/**
 * ชนิดของตัวแปรจากไฟล์ .env
 *
 * ไฟล์นี้ไม่มีโค้ดทำงาน มีหน้าที่เดียวคือบอก TypeScript ว่าตัวแปรชื่ออะไรบ้าง
 * เพื่อดักสองกรณี: พิมพ์ชื่อตัวแปรผิด และเอาไปใช้ผิดประเภท
 *
 * เพิ่มตัวแปรใหม่ใน .env เมื่อไหร่ ต้องมาเพิ่มชื่อที่นี่ด้วยทุกครั้ง
 */
interface ImportMetaEnv {
  /** ที่อยู่ของ backend ไม่มี / ท้าย เช่น http://localhost:3000 */
  readonly VITE_API_URL: string

  /**
   * เป็น string ไม่ใช่ boolean เพราะค่าจากไฟล์ .env เป็นข้อความเสมอ
   * เวลาใช้ต้องเทียบว่า === 'true' ห้ามเอาไปใช้เป็นเงื่อนไขตรงๆ
   * เพราะข้อความว่า 'false' ก็ถือเป็นจริงในภาษา JavaScript
   */
  readonly VITE_USE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
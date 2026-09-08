// backend/src/database/database.constants.ts

/**
 * ชื่อเรียก (token) ของ connection pool ในระบบ Dependency Injection ของ NestJS
 *
 * ทำไมต้องมีไฟล์นี้:
 * ปกติ NestJS ใช้ "ชื่อคลาส" เป็นตัวระบุว่าจะฉีดอะไรเข้าไป เช่น
 *
 *     constructor(private graphRepo: GraphRepository) {}
 *
 * แต่ Pool ของ mysql2 ไม่ใช่คลาสที่เราเขียนเอง เป็น object ที่ได้จากฟังก์ชัน
 * createPool() จึงต้องตั้งชื่อเรียกเองเป็น string แล้วใช้ @Inject() ระบุ
 *
 *     constructor(@Inject(MYSQL_POOL) private pool: Pool) {}
 *
 * เก็บไว้ในไฟล์แยกเพื่อไม่ให้พิมพ์ string ผิดกันคนละที่
 * (พิมพ์ 'MYSQL_POOL' ผิดเป็น 'MYSQL_POOOL' จะพังตอนรัน ไม่ใช่ตอน compile)
 */
export const MYSQL_POOL = 'MYSQL_POOL';
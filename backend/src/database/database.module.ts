// backend/src/database/database.module.ts

import { Global, Module, Logger, OnApplicationShutdown, Inject } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

import { MYSQL_POOL } from './database.constants';

/**
 * สร้างค่าตั้งต้นสำหรับเชื่อมต่อ MySQL จากตัวแปรใน .env
 *
 * แยกออกมาเป็นฟังก์ชันเพื่อให้ตรวจค่าที่ขาดได้ก่อน แล้วแจ้งชื่อตัวแปรที่ขาดตรงๆ
 * ดีกว่าปล่อยให้ mysql2 พังด้วยข้อความที่อ่านไม่รู้เรื่อง
 */
function buildPoolOptions(): mysql.PoolOptions {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `ไม่พบค่าใน .env: ${missing.join(', ')} — คัดลอก backend/.env.example เป็น backend/.env ก่อน`,
    );
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,

    // 🔴 ต้องตั้ง ไม่งั้นภาษาไทยที่อ่านออกมาจะเป็น ????
    charset: 'utf8mb4',

    // ให้ mysql2 รอคิวแทนที่จะโยน error ทันทีเมื่อ connection เต็ม
    waitForConnections: true,

    // 5 พอสำหรับงานขนาดนี้ และปลอดภัยกับ MySQL cloud แบบฟรี
    // ที่มักจำกัด max_connections ไว้ราว 70-80
    connectionLimit: 5,
    queueLimit: 0,

    // ❗ ไม่เปิด multipleStatements โดยตั้งใจ
    // การยิงหลายคำสั่งใน query เดียวทำให้ช่องโหว่ SQL injection รุนแรงขึ้นมาก
    // (สคริปต์ migration เปิดได้ เพราะไม่ได้รับข้อมูลจากผู้ใช้)

    // ผู้ให้บริการ cloud ส่วนใหญ่บังคับ TLS
    // ตอนใช้ MySQL ในเครื่องปล่อย DB_SSL_CA ว่างไว้ ค่านี้จะเป็น undefined
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}

/**
 * DatabaseModule — แจก connection pool ให้ทั้งแอป
 *
 * @Global() หมายถึงโมดูลอื่นไม่ต้อง import ซ้ำ
 * ใส่ใน app.module.ts ครั้งเดียวแล้วทุกที่ขอ MYSQL_POOL ได้เลย
 *
 * ปกติ @Global() ควรใช้เท่าที่จำเป็น เพราะทำให้มองไม่เห็นว่าใครใช้อะไร
 * แต่การเชื่อมต่อฐานข้อมูลเป็นข้อยกเว้นที่ยอมรับกันทั่วไป เพราะเกือบทุกส่วนต้องใช้
 */
@Global()
@Module({
  providers: [
    {
      // ชื่อที่คนอื่นใช้ขอยืม
      provide: MYSQL_POOL,

      // ฟังก์ชันที่ NestJS เรียกครั้งเดียวตอนเปิดเซิร์ฟเวอร์
      // ค่าที่คืนออกมาถูกเก็บไว้แจกทุกคน (singleton)
      useFactory: async (): Promise<mysql.Pool> => {
        const logger = new Logger('DatabaseModule');
        const options = buildPoolOptions();
        const pool = mysql.createPool(options);

        // ทดสอบต่อจริงตั้งแต่ตอนบูต
        // ถ้าต่อไม่ได้ ให้เซิร์ฟเวอร์ตายตั้งแต่ตอนเปิด ดีกว่าเปิดขึ้นมาแล้ว
        // ไปพังตอนผู้ใช้กดปุ่มแรก
        try {
          const conn = await pool.getConnection();
          await conn.ping();
          conn.release();

          logger.log(`เชื่อมต่อ MySQL สำเร็จ: ${options.database} ที่ ${options.host}:${options.port}`);
        } catch (err) {
          logger.error(`เชื่อมต่อ MySQL ไม่สำเร็จ: ${(err as Error).message}`);
          throw err;
        }

        return pool;
      },
    },
  ],

  // ต้องประกาศตรงนี้ด้วย ไม่งั้นโมดูลอื่นขอไม่ได้
  // (providers = มีอะไรข้างใน, exports = แบ่งอะไรให้คนอื่น)
  exports: [MYSQL_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(MYSQL_POOL) private readonly pool: mysql.Pool) {}

  /**
   * ปิด pool ตอนเซิร์ฟเวอร์ดับ
   *
   * ถ้าไม่ปิด process จะค้างไม่ยอมจบ เพราะยังมี socket เปิดค้างอยู่
   * — อาการนี้จะเจอชัดตอนรันเทส e2e ในขั้นที่ 7.6
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    new Logger('DatabaseModule').log('ปิดการเชื่อมต่อ MySQL แล้ว');
  }
}
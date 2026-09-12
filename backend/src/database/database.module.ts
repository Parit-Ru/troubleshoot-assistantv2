import { Global, Module, Logger, OnApplicationShutdown, Inject } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

import { MYSQL_POOL } from './database.constants';

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

    charset: 'utf8mb4',
    waitForConnections: true,

    // 5 พอสำหรับงานขนาดนี้ และปลอดภัยกับ MySQL cloud แบบฟรี
    connectionLimit: 5,
    queueLimit: 0,
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}
@Global()
@Module({
  providers: [
    {
      // ชื่อที่คนอื่นใช้ขอยืม
      provide: MYSQL_POOL,

      // ฟังก์ชันที่ NestJS เรียกครั้งเดียวตอนเปิดเซิร์ฟเวอร์
      // ค่าที่คืนออกมาถูกเก็บไว้แจกทุกคน 
      useFactory: async (): Promise<mysql.Pool> => {
        const logger = new Logger('DatabaseModule');
        const options = buildPoolOptions();
        const pool = mysql.createPool(options);
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
  exports: [MYSQL_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(MYSQL_POOL) private readonly pool: mysql.Pool) {}
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    new Logger('DatabaseModule').log('ปิดการเชื่อมต่อ MySQL แล้ว');
  }
}
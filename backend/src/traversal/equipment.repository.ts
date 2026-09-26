/**
 * equipment.repository.ts — โหลดรายการอุปกรณ์ที่ควรเตรียมก่อนทำตามขั้นตอน
 *                           จาก MySQL เข้าหน่วยความจำตอนบูต
 *
 * หน้าที่เดียวของไฟล์นี้: แปลงข้อมูลจากตาราง equipment + equipment_usage
 * เป็น EquipmentItemDto แล้วแจกตามประเภทเครื่อง
 *
 * ทำไมโหลดตอนบูตไม่ query ทุก request (เหตุผลเดียวกับ GraphRepository):
 *   - เป็นข้อมูลอ่านอย่างเดียว เปลี่ยนเฉพาะตอนรัน npm run seed:equipment
 *   - มีแค่หลักสิบรายการ
 *   - ทุก request จึงได้รายการอุปกรณ์โดยไม่แตะฐานข้อมูลเลย
 *
 * ข้อควรจำ: ถ้ารัน seed:equipment ตอนเซิร์ฟเวอร์เปิดอยู่ ต้องเริ่มเซิร์ฟเวอร์ใหม่
 * รายการในหน่วยความจำจึงจะเปลี่ยนตาม
 *
 * อุปกรณ์ผูกกับ "ประเภทเครื่อง" ไม่ได้ผูกกับอาการ
 * ทุกอาการของเครื่องปรับอากาศจึงได้รายการเดียวกัน
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import type { DeviceCategory } from '../traversal-engine/types';
import type { EquipmentItemDto } from './traversal.dto';

/**
 * 1 แถว = อุปกรณ์ 1 ชิ้นของประเภทเครื่อง 1 ประเภท
 * (JOIN equipment มาแล้วเพื่อเอาชื่อภาษาไทย)
 */
interface EquipmentRow extends RowDataPacket {
  device_category: DeviceCategory;
  equipment_id: string;
  name_th: string;
  purpose_th: string;
  /** เลขหน้าคู่มือ — NULL ถ้าผู้พัฒนาเพิ่มเอง */
  source_page: number | null;
  /** หมายเหตุว่าผู้พัฒนาเพิ่มเอง — NULL ถ้าอ้างคู่มือได้ */
  author_note: string | null;
}

@Injectable()
export class EquipmentRepository implements OnModuleInit {
  private readonly logger = new Logger(EquipmentRepository.name);

  /** key = ประเภทเครื่อง — ว่างจนกว่า onModuleInit จะทำงานเสร็จ */
  private readonly byCategory = new Map<DeviceCategory, EquipmentItemDto[]>();

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  /**
   * NestJS เรียกให้อัตโนมัติหลังสร้าง module เสร็จ ก่อนเปิดรับ request
   * ถ้า throw ที่นี่ แอปจะไม่บูตขึ้นเลย — ตั้งใจให้เป็นแบบนั้น
   */
  async onModuleInit(): Promise<void> {
    await this.loadAll();
  }

  // ============================================================
  // API ที่ service จะเรียกใช้
  // ============================================================

  /**
   * รายการอุปกรณ์ของประเภทเครื่องนั้น เรียงตาม display_order
   *
   * ประเภทที่ยังไม่มีข้อมูลได้ array ว่าง (ไม่ใช่ error)
   * แล้วหน้าจอจะซ่อนแผงอุปกรณ์เอง
   *
   * คืนสำเนา เพื่อไม่ให้ผู้เรียกเผลอแก้ข้อมูลกลางในหน่วยความจำ
   */
  findByCategory(category: DeviceCategory): EquipmentItemDto[] {
    return [...(this.byCategory.get(category) ?? [])];
  }

  // ============================================================
  // การโหลด
  // ============================================================

  private async loadAll(): Promise<void> {
    // ORDER BY ที่ระดับฐานข้อมูล จะได้แต่ละประเภทเรียงตาม display_order อยู่แล้ว
    // equipment_id เป็นตัวตัดสินลำดับสุดท้าย เพื่อให้ลำดับเหมือนเดิมทุกครั้งที่บูต
    // แม้ display_order ซ้ำกัน
    const [rows] = await this.pool.query<EquipmentRow[]>(
      `SELECT u.device_category, u.equipment_id, e.name_th,
              u.purpose_th, u.source_page, u.author_note
         FROM equipment_usage u
         JOIN equipment e ON e.equipment_id = u.equipment_id
        ORDER BY u.device_category, u.display_order, u.equipment_id`,
    );

    this.byCategory.clear();

    for (const row of rows) {
      const item: EquipmentItemDto = {
        equipmentId: row.equipment_id,
        nameTh: row.name_th,
        purposeTh: row.purpose_th,
        // NULL ในฐานข้อมูล → undefined เพื่อให้ field หายไปจาก JSON
        // (ตรงกับที่ mockServer ทำ หน้าจอจึงเห็นรูปร่างเดียวกัน)
        sourcePage: row.source_page ?? undefined,
        authorNote: row.author_note ?? undefined,
      };

      const list = this.byCategory.get(row.device_category);
      if (list) list.push(item);
      else this.byCategory.set(row.device_category, [item]);
    }

    this.logger.log(
      `โหลดอุปกรณ์สำเร็จ ${rows.length} รายการ ใน ${this.byCategory.size} ประเภทเครื่อง`,
    );
  }
}
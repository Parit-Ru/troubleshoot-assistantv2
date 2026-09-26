/**
 * traversal.module.ts — ประกอบทุกชิ้นของขั้น A เข้าเป็นโมดูลเดียว
 *
 * ไม่ต้อง import DatabaseModule ที่นี่ แม้ว่า GraphRepository, EquipmentRepository
 * และ SessionStore ทุกตัวต้องใช้ MYSQL_POOL ก็ตาม เพราะ DatabaseModule ประกาศตัวเอง
 * เป็น @Global() ไว้แล้ว (เห็นได้จากคอมเมนต์ใน app.module.ts) พอลงทะเบียนที่นั่น
 * ครั้งเดียว ทุกโมดูลในแอปขอยืม MYSQL_POOL ได้เลยโดยไม่ต้อง import ซ้ำ
 *
 * ไม่มี exports เพราะยังไม่มีโมดูลอื่นในระบบต้องการใช้ของจากที่นี่
 */

import { Module } from '@nestjs/common';

import { GraphRepository } from './graph.repository';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { TraversalService } from './traversal.service';
import { TraversalController } from './traversal.controller';

@Module({
  controllers: [TraversalController],
  providers: [GraphRepository, EquipmentRepository, SessionStore, TraversalService],
})
export class TraversalModule {}
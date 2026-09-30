/**
 * symptom-search.module.ts — ประกอบงานค้นหาอาการเป็นโมดูลเดียว
 *
 * imports GraphModule เพื่อขอยืม GraphRepository ตัวเดียวกัน
 * ไม่สร้าง repository ซ้ำ เพราะจะโหลดผังจาก MySQL สองรอบ และอาจได้ข้อมูลไม่ตรงกัน
 *
 * exports เฉพาะ SymptomSearchService ให้ TraversalModule ใช้ (ขั้น 1.8)
 */

import { Module } from '@nestjs/common';

import { GraphModule } from '../traversal/graph.module';
import { EmbeddingService } from './embedding.service';
import { SymptomSearchController } from './symptom-search.controller';
import { SymptomSearchService } from './symptom-search.service';

@Module({
  imports: [GraphModule],
  // export ให้ TraversalModule ยืม SymptomSearchService ไปคิดคะแนนความมั่นใจของ session
  exports: [SymptomSearchService],
  controllers: [SymptomSearchController],
  providers: [EmbeddingService, SymptomSearchService],
})
export class SymptomSearchModule {}
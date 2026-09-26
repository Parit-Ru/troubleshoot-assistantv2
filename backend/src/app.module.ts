import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { TraversalModule } from './traversal/traversal.module';

@Module({
  imports: [
    // DatabaseModule เป็น @Global() จึงต้องอยู่ก่อนโมดูลที่ใช้ฐานข้อมูล
    DatabaseModule,
    HealthModule,
    TraversalModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
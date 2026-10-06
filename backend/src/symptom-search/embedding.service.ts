// backend/src/symptom-search/embedding.service.ts

/**
 * EmbeddingService — แปลงข้อความเป็นเวกเตอร์ 384 มิติด้วยโมเดล MiniLM
 *
 * หน้าที่เดียว: ข้อความเข้า → เวกเตอร์ออก
 * ไม่รู้เรื่องผังขั้นตอน ไม่รู้เรื่องคะแนน (ส่วนนั้นอยู่ใน symptom-matcher.ts)
 *
 * โมเดลเป็นแบบสำเร็จรูป (ไม่ได้เทรนเอง) และเป็นรุ่นที่ตัดตารางคำศัพท์แล้ว
 * ไฟล์อยู่ใน repo ที่ backend/model-slim/ จึง "ห้ามดาวน์โหลด" ตอนรันจริง
 *
 * ไฟล์นี้ไม่มีเทสของตัวเอง เพราะต้องโหลดโมเดลจริง (~250 MB RAM)
 * พิสูจน์ด้วยสคริปต์วัด (backend/scripts/) และ GET /symptom-search/status
 */

import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';

export const EMBEDDING_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** q8 = โมเดลบีบอัด 8 บิต (ไฟล์ onnx/model_quantized.onnx) */
export const EMBEDDING_DTYPE = 'q8';

/**
 * โฟลเดอร์โมเดลที่ตัดคำศัพท์แล้ว (อยู่ใน git)
 * นับจากไฟล์นี้ขึ้นไป 2 ระดับคือ backend/ ทั้งตอนรันจาก src/ (เทส)
 * และจาก dist/ (เซิร์ฟเวอร์จริง)
 */
const MODEL_CACHE_DIR =path.resolve(__dirname, '../../model-slim');

/** ฟังก์ชันสกัดเวกเตอร์ของ transformers.js (เฉพาะส่วนที่เราใช้) */
type FeatureExtractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: FeatureExtractor | null = null;

  /** true = พบไฟล์โมเดลในเครื่องก่อนโหลด (ไม่ได้พึ่งการดาวน์โหลด) */
  modelFilesFoundLocally = false;

  get isLoaded(): boolean {
    return this.extractor !== null;
  }

  /**
   * โหลดโมเดลเข้าหน่วยความจำ เรียกครั้งเดียวตอนเปิดเซิร์ฟเวอร์
   * ใช้ import() แบบ lazy เพื่อให้เซิร์ฟเวอร์ที่ปิดฟีเจอร์ค้นหา
   * ไม่ต้องโหลดไลบรารีนี้เลย (ประหยัด RAM)
   */
  async load(): Promise<void> {
    if (this.extractor) return;

    this.modelFilesFoundLocally = fs.existsSync(
      path.join(
        MODEL_CACHE_DIR,
        EMBEDDING_MODEL_ID,
        'onnx',
        'model_quantized.onnx',
      ),
    );

    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = MODEL_CACHE_DIR;
    env.allowRemoteModels = false; // ห้ามดาวน์โหลด ใช้เฉพาะไฟล์ในเครื่อง

    const started = Date.now();
    this.extractor = (await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
      dtype: EMBEDDING_DTYPE,
      session_options: { intraOpNumThreads: 1 }, // 1 เธรด เพราะ Render free มี 0.1 CPU
    })) as unknown as FeatureExtractor;

    this.logger.log(`โหลดโมเดลเสร็จใน ${Date.now() - started} ms`);
  }

  /** แปลงข้อความเป็นเวกเตอร์ 384 มิติ (mean pooling + normalize) */
  async embed(text: string): Promise<Float32Array> {
    if (!this.extractor) {
      throw new Error('EmbeddingService: ยังไม่ได้เรียก load()');
    }
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Float32Array.from(output.data);
  }
}
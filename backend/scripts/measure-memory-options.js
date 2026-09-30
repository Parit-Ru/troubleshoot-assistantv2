// backend/scripts/measure-memory-options.js
//
// ขั้น 1.1ข — ลองค่าตั้งของ ONNX Runtime ที่อาจลดหน่วยความจำ แล้ววัด peak RSS ของแต่ละแบบ
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/):
//   node scripts/measure-memory-options.js
//
// ต้องรัน measure-embedding.js สำเร็จมาก่อน (ใช้ไฟล์โมเดลใน model-cache/ ที่ดาวน์โหลดไว้แล้ว)
//
// แต่ละแบบต้องรันแยกโปรเซส เพราะ peak RSS นับตลอดอายุโปรเซส
// ถ้ารันต่อกันในโปรเซสเดียว แบบหลังจะติดค่าสูงสุดของแบบก่อนไปด้วย
// สคริปต์จึงเรียกตัวเองซ้ำเป็นโปรเซสลูก 1 ตัวต่อ 1 แบบ

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DTYPE = 'q8';
const CACHE_DIR = path.resolve(__dirname, '../model-cache');

// ค่าตั้งที่จะลอง — ทุกแบบใช้ 1 เธรดเหมือนเดิม ต่างกันแค่ส่วนที่เกี่ยวกับหน่วยความจำ
const VARIANTS = {
  // ค่าเดิมจากขั้น 1.1 (ONNX Runtime ปรับกราฟเต็มที่ = 'all')
  baseline: { intraOpNumThreads: 1 },

  // ปิดการจองหน่วยความจำล่วงหน้า (arena) ที่จองแล้วไม่คืน
  'arena-off': { intraOpNumThreads: 1, enableCpuMemArena: false, enableMemPattern: false },

  // ปรับกราฟแค่ขั้นพื้นฐาน / ไม่ปรับเลย — ถ้าการปรับกราฟแปลงตาราง int8 เป็น float32
  // ตอนโหลด สองแบบนี้อาจเลี่ยงได้ (ยังไม่แน่ใจ จึงต้องวัด)
  'opt-basic': { intraOpNumThreads: 1, graphOptimizationLevel: 'basic' },
  'opt-disabled': { intraOpNumThreads: 1, graphOptimizationLevel: 'disabled' },
};

/** cos(a, b) = (a · b) / (|a| × |b|) */
function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** วัด 1 แบบ — ทำงานในโปรเซสลูก */
async function measureOne(name) {
  const { pipeline, env } = require('@huggingface/transformers');
  env.cacheDir = CACHE_DIR;
  env.allowRemoteModels = false; // ห้ามดาวน์โหลด ต้องใช้ไฟล์ที่มีอยู่แล้วเท่านั้น

  const loadStart = performance.now();
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: DTYPE,
    session_options: VARIANTS[name],
  });
  const loadSec = ((performance.now() - loadStart) / 1000).toFixed(1);

  const embed = async (text) =>
    (await extractor(text, { pooling: 'mean', normalize: true })).data;

  // ค้นหา 3 ครั้ง ให้รวมหน่วยความจำตอนคำนวณจริงเข้าไปใน peak ด้วย
  const queryStart = performance.now();
  const thai = await embed('แอร์ไม่เย็นเลย');
  const english = await embed('the AC is not cooling');
  await embed('กดรีโมทแล้วแอร์ไม่ตอบสนอง');
  const queryMs = Math.round((performance.now() - queryStart) / 3);

  // ค่าตั้งเหล่านี้ไม่ควรเปลี่ยนผลลัพธ์ — ตัวเลขนี้ต้องเท่ากัน (หรือต่างแค่หลักที่ 4) ทุกแบบ
  const check = cosine(thai, english).toFixed(4);

  const peak = Math.round(process.resourceUsage().maxRSS / 1024);
  console.log(
    `${name.padEnd(13)} peak ${String(peak).padStart(4)} MB · ` +
      `โหลด ${loadSec} วินาที · ค้นหา ${queryMs} ms · ตรวจผล ${check}`,
  );
}

/** โปรเซสหลัก — เรียกตัวเองซ้ำ 1 ครั้งต่อ 1 แบบ แล้วรอจนจบทีละตัว */
function runAll() {
  console.log(`ลองค่าตั้ง ${Object.keys(VARIANTS).length} แบบ (แบบละโปรเซส)`);
  console.log('-'.repeat(72));
  for (const name of Object.keys(VARIANTS)) {
    const result = spawnSync(process.execPath, [__filename, name], { stdio: 'inherit' });
    if (result.status !== 0) console.log(`${name.padEnd(13)} ล้ม (exit ${result.status})`);
  }
  console.log('-'.repeat(72));
  console.log('ส่งทั้งตารางนี้กลับมา · เกณฑ์เดิม: peak <= 350 MB ผ่าน');
}

const variantName = process.argv[2];
if (variantName === undefined) {
  runAll();
} else {
  measureOne(variantName).catch((err) => {
    console.error(`${variantName}: ${err.message}`);
    process.exit(1);
  });
}
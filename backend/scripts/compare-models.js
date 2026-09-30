// backend/scripts/compare-models.js
//
// ขั้น 1.2.3 — เทียบโมเดลเดิมกับโมเดลที่ตัดคำศัพท์แล้ว ด้วย transformers.js ตัวจริง
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/):
//   node scripts/compare-models.js
//
// ต้องมี backend/model-cache/ (จากขั้น 1.1) และ backend/model-slim/ (จากขั้น 1.2.2)
//
// สิ่งที่ทำ:
//   1. รันโมเดลแต่ละตัวในโปรเซสแยกกัน (เหตุผลเดียวกับ measure-memory-options.js:
//      peak RSS นับตลอดอายุโปรเซส ถ้ารันรวมกันจะวัดปนกัน)
//   2. ทั้งสองโปรเซสแปลงข้อความชุดเดียวกันเป็นเวกเตอร์ แล้วเขียนผลลง ไฟล์ชั่วคราว
//   3. โปรเซสหลักเทียบเวกเตอร์ทีละข้อความ: cosine, ความต่างสูงสุดรายมิติ, ตรงกันทุกบิตหรือไม่
//
// ข้อความที่ใช้: ข้อความตัวแทนของ 13 ผัง + ข้อความในสถานะทุกตัว + คำค้นตัวอย่าง
// (ข้อความในสถานะไม่ได้ใช้ค้นหา แต่เป็นตัวอย่างภาษาไทยจริงจำนวนมาก ใช้ขยายการทดสอบ)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DTYPE = 'q8';

// โฟลเดอร์ของโมเดลแต่ละตัว — โครงสร้างข้างใน (Xenova/...) เหมือนกัน
const MODELS = {
  original: path.resolve(__dirname, '../model-cache'),
  slim: path.resolve(__dirname, '../model-slim'),
};

const MANUAL_FILE = path.resolve(__dirname, '../../data/manuals/samsung_ac_ar70h.json');

// คำค้นตัวอย่างชุดเดียวกับ measure-embedding.js
const SAMPLE_QUERIES = [
  'แอร์ไม่เย็นเลย',
  'เปิดแอร์ไม่ติด',
  'กดรีโมทแล้วแอร์ไม่ตอบสนอง',
  'มีน้ำหยดจากเครื่องที่อยู่นอกบ้าน',
  'the AC is not cooling',
  'เครื่องซักผ้าน้ำไม่ไหลออก',
  'ทีวีไม่มีเสียง',
];

// เกณฑ์ผ่าน: ทฤษฎีคือเหมือนกันทุกบิต แต่เผื่อความคลาดเคลื่อนของทศนิยมไว้เล็กน้อย
const MIN_COSINE = 0.99999;

// เกณฑ์หน่วยความจำ (MB) เดียวกับขั้น 1.1
const OK_LIMIT_MB = 350;
const RISKY_LIMIT_MB = 450;

// ------------------------------------------------------------
// ข้อความที่ใช้เทียบ
// ------------------------------------------------------------

function collectTexts() {
  const manual = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf-8'));
  const symptomTexts = [];
  const stepTexts = [];

  for (const g of manual.graphs) {
    const candidates = [g.entry_symptom_th, g.entry_symptom, ...(g.entry_symptom_aliases ?? [])];
    for (const text of candidates) {
      if (text && text.trim()) symptomTexts.push(text.trim());
    }
    for (const node of g.nodes) {
      for (const key of ['question', 'content', 'prompt', 'safety_warning']) {
        if (typeof node[key] === 'string' && node[key].trim()) stepTexts.push(node[key].trim());
      }
    }
  }

  return { symptomTexts, stepTexts, all: [...symptomTexts, ...stepTexts, ...SAMPLE_QUERIES] };
}

// ------------------------------------------------------------
// โปรเซสลูก: รันโมเดล 1 ตัว แล้วเขียนเวกเตอร์ลงไฟล์
// ------------------------------------------------------------

async function runChild(name, outFile) {
  const { pipeline, env } = require('@huggingface/transformers');
  env.cacheDir = MODELS[name];
  env.allowRemoteModels = false; // ห้ามดาวน์โหลด ต้องใช้ไฟล์ในเครื่องเท่านั้น

  const loadStart = performance.now();
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: DTYPE,
    session_options: { intraOpNumThreads: 1 }, // ค่าเดียวกับที่ใช้บน Render
  });
  const loadSec = (performance.now() - loadStart) / 1000;

  const vectors = [];
  for (const text of collectTexts().all) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    vectors.push(Array.from(output.data));
  }

  const peakMb = Math.round(process.resourceUsage().maxRSS / 1024); // maxRSS หน่วย KB
  fs.writeFileSync(outFile, JSON.stringify({ name, loadSec, peakMb, vectors }));
}

// ------------------------------------------------------------
// โปรเซสหลัก: เรียกลูก 2 ตัว แล้วเทียบผล
// ------------------------------------------------------------

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

function runAll() {
  for (const [name, dir] of Object.entries(MODELS)) {
    if (!fs.existsSync(dir)) {
      console.error(`ไม่พบโฟลเดอร์ ${dir} (${name})`);
      process.exit(1);
    }
  }

  const { symptomTexts, stepTexts, all } = collectTexts();
  console.log(
    `ข้อความที่ใช้เทียบ ${all.length} ข้อความ ` +
      `(ตัวแทนอาการ ${symptomTexts.length} + ในสถานะ ${stepTexts.length} + คำค้นตัวอย่าง ${SAMPLE_QUERIES.length})\n`,
  );

  const results = {};
  for (const name of Object.keys(MODELS)) {
    console.log(`กำลังรันโมเดล "${name}" (โปรเซสแยก)...`);
    const outFile = path.join(os.tmpdir(), `compare-models-${name}-${process.pid}.json`);
    const child = spawnSync(process.execPath, [__filename, name, outFile], { stdio: 'inherit' });
    if (child.status !== 0) {
      console.error(`โมเดล "${name}" ล้ม (exit ${child.status})`);
      process.exit(1);
    }
    results[name] = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
    fs.unlinkSync(outFile);
  }

  // เทียบเวกเตอร์ทีละข้อความ
  const a = results.original.vectors;
  const b = results.slim.vectors;
  let minCosine = 1;
  let maxAbsDiff = 0;
  let identical = 0;
  let worstText = '';

  for (let i = 0; i < all.length; i++) {
    const cos = cosine(a[i], b[i]);
    let diff = 0;
    for (let k = 0; k < a[i].length; k++) diff = Math.max(diff, Math.abs(a[i][k] - b[i][k]));

    if (diff === 0) identical++;
    maxAbsDiff = Math.max(maxAbsDiff, diff);
    if (cos < minCosine) {
      minCosine = cos;
      worstText = all[i];
    }
  }

  console.log('\n' + '='.repeat(64));
  console.log('ผลเทียบเวกเตอร์ (ส่งส่วนนี้กลับมา)');
  console.log('='.repeat(64));
  console.log(`จำนวนมิติ                    : ${a[0].length} (ต้องเป็น 384)`);
  console.log(`เหมือนกันทุกบิต              : ${identical} จาก ${all.length} ข้อความ`);
  console.log(`cosine ต่ำสุด                : ${minCosine.toFixed(8)}`);
  console.log(`ความต่างสูงสุดรายมิติ        : ${maxAbsDiff}`);
  if (identical !== all.length) console.log(`ข้อความที่ cosine ต่ำสุด      : ${worstText.slice(0, 60)}`);

  console.log('\nหน่วยความจำ (แต่ละโมเดลในโปรเซสของตัวเอง โหลดโมเดล + แปลงข้อความทั้งหมด)');
  console.log('-'.repeat(64));
  for (const name of Object.keys(MODELS)) {
    const r = results[name];
    console.log(`${name.padEnd(9)} peak RSS ${String(r.peakMb).padStart(4)} MB · โหลดโมเดล ${r.loadSec.toFixed(1)} วินาที`);
  }

  const passed = a[0].length === 384 && minCosine >= MIN_COSINE;
  console.log('\n' + (passed ? 'ผล: ผ่าน — โมเดลที่ตัดแล้วให้เวกเตอร์เท่าเดิม' : 'ผล: ไม่ผ่าน — ห้ามใช้ model-slim/'));

  const peak = results.slim.peakMb;
  console.log(
    peak <= OK_LIMIT_MB
      ? `หน่วยความจำ: ผ่านเกณฑ์ (<= ${OK_LIMIT_MB} MB)`
      : peak <= RISKY_LIMIT_MB
        ? `หน่วยความจำ: เสี่ยง (${OK_LIMIT_MB}-${RISKY_LIMIT_MB} MB)`
        : `หน่วยความจำ: ยังไม่ผ่าน (> ${RISKY_LIMIT_MB} MB)`,
  );
  console.log('หมายเหตุ: ตัวเลขนี้วัดบน Windows ยังไม่รวมส่วนของ NestJS/MySQL และ Render เป็น Linux');

  process.exit(passed ? 0 : 1);
}

const modelName = process.argv[2];
if (modelName === undefined) {
  runAll();
} else {
  runChild(modelName, process.argv[3]).catch((err) => {
    console.error(`${modelName}: ${err.message}`);
    process.exit(1);
  });
}
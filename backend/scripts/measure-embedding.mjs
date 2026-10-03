// backend/scripts/measure-embedding.js
//
// ขั้น 1.1 — วัดว่าโมเดลค้นหาอาการรันบน Render free (RAM 512 MB) ได้หรือไม่
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/):
//   node scripts/measure-embedding.js
//
// ครั้งแรกต้องต่ออินเทอร์เน็ต ไลบรารีจะดาวน์โหลดโมเดล ~118 MB ลง backend/model-cache/
// ให้รัน 2 รอบ เพราะเวลาโหลดของรอบแรกรวมเวลาดาวน์โหลดไว้ด้วย
//
// สคริปต์นี้เป็นเครื่องมือวัดครั้งเดียว ไม่ใช่ส่วนของเซิร์ฟเวอร์
// แต่ใช้ค่าตั้งชุดเดียวกับที่เซิร์ฟเวอร์จะใช้ในขั้นถัดไป (โมเดล, q8, 1 เธรด, โฟลเดอร์)
// และข้อความจริงของ 13 ผังแอร์ ผลที่วัดได้จึงใช้ตัดสินแผน A ได้
//
// เขียนเป็น JavaScript ธรรมดาแบบเดียวกับ run-migrations.js และ seed-graphs.js
// เพราะเป็นเครื่องมือของนักพัฒนา ไม่ต้องผ่านขั้นตอน compile

const fs = require('node:fs');
const path = require('node:path');

// ------------------------------------------------------------
// ค่าตั้ง — ชุดเดียวกับที่ EmbeddingService จะใช้ในขั้น 1.4
// ------------------------------------------------------------

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// q8 = รุ่น quantized 8 บิต (ไฟล์ onnx/model_quantized.onnx ~118 MB)
// แทนรุ่นเต็ม fp32 (~470 MB) ที่เกือบเต็ม RAM ของ Render free
const DTYPE = 'q8';

// เก็บไฟล์โมเดลที่ backend/model-cache/ (ไม่ใช่ค่าเริ่มต้นที่อยู่ลึกใน node_modules)
// โฟลเดอร์นี้ต้องอยู่ใน .gitignore เพราะไฟล์ใหญ่เกินกว่า GitHub จะรับ
const CACHE_DIR = path.resolve(__dirname, '../model-cache');

// ผังขั้นตอนของแอร์ — ไฟล์เดียวกับที่ npm run seed ใช้
const MANUAL_FILE = path.resolve(__dirname, '../../data/manuals/samsung_ac_ar70h.json');

// เกณฑ์ตัดสิน (MB) — ต้องเหลือที่ให้ NestJS และ MySQL driver ด้วย
const OK_LIMIT_MB = 350;
const RISKY_LIMIT_MB = 450;

// คำค้นตัวอย่างสำหรับดูภาพรวมเท่านั้น ไม่ใช่ชุดวัดผล (ชุดวัดผลทำในขั้นหลัง)
// expect = graph_id ที่ควรได้อันดับ 1 · null = นอกขอบเขต ไม่ควรตรงกับผังไหนดี
const SAMPLE_QUERIES = [
  { text: 'แอร์ไม่เย็นเลย', expect: 'samsung_ac_ar70h_improper_airflow_temperature' },
  { text: 'เปิดแอร์ไม่ติด', expect: 'samsung_ac_ar70h_stops_working' },
  { text: 'กดรีโมทแล้วแอร์ไม่ตอบสนอง', expect: 'samsung_ac_ar70h_remote_not_working' },
  { text: 'มีน้ำหยดจากเครื่องที่อยู่นอกบ้าน', expect: 'samsung_ac_ar70h_water_drips_outdoor' },
  { text: 'the AC is not cooling', expect: 'samsung_ac_ar70h_improper_airflow_temperature' },
  { text: 'เครื่องซักผ้าน้ำไม่ไหลออก', expect: null },
  { text: 'ทีวีไม่มีเสียง', expect: null },
];

// ------------------------------------------------------------
// ตัวช่วย
// ------------------------------------------------------------

const toMb = (bytes) => Math.round(bytes / 1024 / 1024);
const rssMb = () => toMb(process.memoryUsage().rss);

// maxRSS = หน่วยความจำสูงสุดตั้งแต่เริ่มโปรเซส หน่วยเป็น KB
// ค่านี้สำคัญที่สุด เพราะ Render ปิดโปรเซสทันทีที่ใช้เกิน 512 MB แม้เพียงชั่วขณะ
const peakRssMb = () => Math.round(process.resourceUsage().maxRSS / 1024);

const seconds = (ms) => (ms / 1000).toFixed(1);

/**
 * cos(a, b) = (a · b) / (|a| × |b|)
 * ผลอยู่ระหว่าง -1 ถึง 1 ยิ่งใกล้ 1 ยิ่งความหมายใกล้กัน
 */
function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * ข้อความตัวแทนของแต่ละผัง: อาการไทย + อาการอังกฤษจากคู่มือ + คำพ้อง
 * ใช้เฉพาะ field ที่มีอยู่แล้วในไฟล์ข้อมูล ไม่แต่งประโยคเพิ่ม
 */
function symptomTexts(graphs) {
  const texts = [];
  for (const g of graphs) {
    const candidates = [g.entry_symptom_th, g.entry_symptom, ...(g.entry_symptom_aliases ?? [])];
    for (const text of candidates) {
      if (text && text.trim()) texts.push({ graphId: g.graph_id, text: text.trim() });
    }
  }
  return texts;
}

/** คะแนนของผัง = cosine สูงสุดในบรรดาข้อความตัวแทนของผังนั้น เรียงมากไปน้อย */
function rankGraphs(queryVector, index) {
  const best = new Map();
  for (const entry of index) {
    const score = cosine(queryVector, entry.vector);
    const current = best.get(entry.graphId);
    if (!current || score > current.score) {
      best.set(entry.graphId, { graphId: entry.graphId, score, matchedText: entry.text });
    }
  }
  return [...best.values()].sort((x, y) => y.score - x.score);
}

// ------------------------------------------------------------
// ส่วนหลัก
// ------------------------------------------------------------

async function main() {
  console.log(`Node ${process.version} บน ${process.platform}`);
  console.log(`โมเดล: ${MODEL_ID} (${DTYPE})`);
  console.log(`โฟลเดอร์โมเดล: ${CACHE_DIR}`);
  console.log(`RSS ตอนเริ่ม: ${rssMb()} MB\n`);

  // 1) โหลดไลบรารี (ONNX Runtime เป็น native code กินหน่วยความจำเองส่วนหนึ่ง)
  const { pipeline, env } = require('@huggingface/transformers');
  env.cacheDir = CACHE_DIR;
  console.log(`RSS หลังโหลดไลบรารี: ${rssMb()} MB`);

  // 2) โหลดโมเดล
  console.log('กำลังโหลดโมเดล...');
  const loadStart = performance.now();
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: DTYPE,
    // Render free ได้ CPU 0.1 เธรดคำนวณหลายตัวไม่ช่วยให้เร็วขึ้น
    session_options: { intraOpNumThreads: 1 },
  });
  const loadMs = performance.now() - loadStart;
  console.log(`โหลดเสร็จใน ${seconds(loadMs)} วินาที · RSS ${rssMb()} MB`);

  // mean pooling + normalize = วิธีที่โมเดล paraphrase-MiniLM ถูกเทรนมา
  const embed = async (text) => {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return output.data; // Float32Array 384 ตัว
  };

  // 3) สร้างดัชนีจากข้อความจริงของ 13 ผัง (สิ่งที่เซิร์ฟเวอร์จะทำตอนเปิด)
  const manual = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf-8'));
  const texts = symptomTexts(manual.graphs);
  const graphNameTh = new Map(manual.graphs.map((g) => [g.graph_id, g.entry_symptom_th]));

  const indexStart = performance.now();
  const index = [];
  for (const t of texts) {
    index.push({ ...t, vector: await embed(t.text) });
  }
  const indexMs = performance.now() - indexStart;
  console.log(
    `สร้างดัชนี ${index.length} ข้อความ จาก ${manual.graphs.length} ผัง ` +
      `ใช้ ${seconds(indexMs)} วินาที · มิติ ${index[0].vector.length} (ควรเป็น 384)`,
  );

  // 4) ค้นหาตัวอย่าง — แสดง 3 อันดับแรก ยังไม่ใช้เกณฑ์ใดๆ
  console.log('\nผลค้นหา (3 อันดับแรก พร้อมคะแนน cosine)');
  console.log('-'.repeat(64));
  const queryTimes = [];
  let correctTop1 = 0;
  let bestOutOfScope = -1;
  for (const q of SAMPLE_QUERIES) {
    const start = performance.now();
    const ranked = rankGraphs(await embed(q.text), index);
    queryTimes.push(performance.now() - start);

    const top = ranked[0];
    if (q.expect === null) bestOutOfScope = Math.max(bestOutOfScope, top.score);
    else if (top.graphId === q.expect) correctTop1++;

    const verdict =
      q.expect === null
        ? 'นอกขอบเขต — จดคะแนนอันดับ 1 ไว้ใช้ตั้งเกณฑ์ส่งต่อ'
        : top.graphId === q.expect
          ? 'อันดับ 1 ตรงตามคาด'
          : 'อันดับ 1 ไม่ตรงตามคาด';

    console.log(`"${q.text}"  → ${verdict}`);
    for (const r of ranked.slice(0, 3)) {
      console.log(
        `  ${r.score.toFixed(3)}  ${graphNameTh.get(r.graphId)}  (ตรงกับ "${r.matchedText}")`,
      );
    }
  }

  // 5) สรุปตัวเลขที่ใช้ตัดสินใจ
  const otherQueries = queryTimes.slice(1);
  const avgQueryMs = Math.round(otherQueries.reduce((a, b) => a + b, 0) / otherQueries.length);
  const peak = peakRssMb();

  console.log('\n' + '='.repeat(64));
  console.log('สรุป (ส่งส่วนนี้กลับมา)');
  console.log('='.repeat(64));
  console.log(`โหลดโมเดล                 : ${seconds(loadMs)} วินาที`);
  console.log(`สร้างดัชนี                 : ${seconds(indexMs)} วินาที (${index.length} ข้อความ)`);
  console.log(`ค้นหา 1 ครั้ง (เฉลี่ย)      : ${avgQueryMs} ms (ครั้งแรก ${Math.round(queryTimes[0])} ms)`);
  const inScopeCount = SAMPLE_QUERIES.filter((q) => q.expect !== null).length;
  console.log(`อันดับ 1 ตรงตามคาด          : ${correctTop1} จาก ${inScopeCount} คำค้นในขอบเขต`);
  console.log(`คะแนนสูงสุดของคำค้นนอกขอบเขต : ${bestOutOfScope.toFixed(3)}`);
  console.log(`RSS หลังทำงานเสร็จ         : ${rssMb()} MB`);
  console.log(`RSS สูงสุด (peak)          : ${peak} MB`);

  if (peak <= OK_LIMIT_MB) {
    console.log(`\nผล: ผ่าน (<= ${OK_LIMIT_MB} MB)`);
  } else if (peak <= RISKY_LIMIT_MB) {
    console.log(`\nผล: เสี่ยง (${OK_LIMIT_MB}-${RISKY_LIMIT_MB} MB) — ต้องคุยกันก่อนไปต่อ`);
  } else {
    console.log(`\nผล: ไม่ผ่าน (> ${RISKY_LIMIT_MB} MB) — แผน A บน Render free ไม่พอ`);
  }
  console.log('หมายเหตุ: Render เป็น Linux CPU 0.1 เวลาจริงจะนานกว่านี้มาก');
  console.log('และตัวเลข RSS นี้ยังไม่รวมส่วนของ NestJS ที่เซิร์ฟเวอร์จริงใช้เพิ่ม');
}

main().catch((err) => {
  console.error('\nวัดไม่สำเร็จ:', err.message);
  process.exit(1);
});
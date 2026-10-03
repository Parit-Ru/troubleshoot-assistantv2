// backend/scripts/check-deployed-search.js
//
// ขั้น 1.11 — ตรวจระบบค้นหาอาการบนเซิร์ฟเวอร์ที่ deploy แล้ว (หรือในเครื่อง) และวัดหน่วยความจำ
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/):
//   node scripts/check-deployed-search.js https://troubleshoot-assistantv2.onrender.com
//   node scripts/check-deployed-search.js http://localhost:3000 --queries 30
//   node scripts/check-deployed-search.js <url> --wait 300     รอโมเดลโหลดนานสุด 300 วินาที (ค่าเริ่มต้น 240)
//
// ทำอะไร (ใช้เฉพาะ GET /health, GET /symptom-search/status และ POST /symptom-search):
//   1. GET /health         เซิร์ฟเวอร์ Render ฟรีหลับอยู่ได้ จึงรอได้นานสุด 120 วินาที แล้วบอกว่ารอนานแค่ไหน
//   2. GET /symptom-search/status
//        disabled  ปิดสวิตช์อยู่ (ปกติหลัง deploy จังหวะ ก) → จด memoryRssMb แล้วจบ
//        loading   รอจนเป็น ready หรือ failed
//        ready     ยิงคำค้น N ข้อความ (ค่าเริ่มต้น 10) วัดเวลาตอบ แล้วอ่าน memoryRssMb ซ้ำ
//        failed    แสดง error ที่เซิร์ฟเวอร์รายงาน
//
// ⚠️ ไม่สร้าง session และไม่เขียนอะไรลงฐานข้อมูล (POST /symptom-search เป็นการอ่านอย่างเดียว)
// ⚠️ เกณฑ์เตือนหน่วยความจำ (WARN_RSS_MB) เป็นข้อเสนอของผู้พัฒนา ไม่ใช่ค่าที่วัดมาจาก Render
//    เพดานจริงของ Render ฟรีคือ 512 MB
//
// รหัสออก: 0 = ปกติ (รวมกรณีปิดสวิตช์) · 1 = พบปัญหา

const argv = process.argv.slice(2);
const BASE = (argv.find((a) => /^https?:\/\//.test(a)) ?? '').replace(/\/+$/, '');
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? Number(argv[i + 1]) : fallback;
};
const N_QUERIES = opt('queries', 10);
const WAIT_S = opt('wait', 240);

/** เกิน (MB) แล้วเตือน ข้อเสนอ: เพดาน Render ฟรี 512 MB เหลือที่ว่างให้ช่วงพุ่งชั่วคราวและกระบวนการอื่น */
const WARN_RSS_MB = 450;
const HEALTH_TIMEOUT_MS = 120_000;

if (!BASE) {
  console.error('ใช้: node scripts/check-deployed-search.js <url> [--queries N] [--wait วินาที]');
  process.exit(1);
}

const QUERIES = [
  'แอร์ไม่เย็น',
  'รีโมทกดไม่ติด',
  'มีน้ำหยดจากเครื่องนอก',
  'ไฟกระพริบที่หน้าจอ',
  'เสียงดังผิดปกติ',
  'ตั้งเวลาไม่ทำงาน',
  'มีกลิ่นอับ',
  'วันนี้ฝนจะตกไหม',
  'ปรับทิศทางลมไม่ได้',
  'error code on display',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtS = (ms) => `${(ms / 1000).toFixed(1)} วินาที`;
let problems = 0;
const fail = (msg) => {
  problems += 1;
  console.log(`  ❌ ${msg}`);
};

async function getJson(path, timeoutMs) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log(`เซิร์ฟเวอร์: ${BASE}\n`);

  // 1) /health
  console.log('1) GET /health');
  const t0 = Date.now();
  // ลองซ้ำจนครบเวลา: เซิร์ฟเวอร์ที่เพิ่งตื่น/เพิ่ง deploy ยังไม่รับการเชื่อมต่อ หรือ proxy ของ Render ตอบ 502/503
  // ระหว่างนั้น ไม่ใช่ความล้มเหลวจริง จนกว่าจะหมดเวลา
  let h = null;
  let lastIssue = '';
  while (Date.now() - t0 < HEALTH_TIMEOUT_MS) {
    try {
      const r = await getJson('/health', 30_000);
      if (r.status === 200) {
        h = r;
        break;
      }
      lastIssue = `status ${r.status}`;
    } catch (e) {
      lastIssue = e.name === 'TimeoutError' ? 'ไม่ตอบภายใน 30 วินาที' : 'ต่อไม่ติด';
    }
    await sleep(3000);
  }
  if (h === null) {
    fail(`/health ไม่เป็น 200 ภายใน ${HEALTH_TIMEOUT_MS / 1000} วินาที (ล่าสุด: ${lastIssue})`);
    return;
  }
  const took = Date.now() - t0;
  console.log(`  status ${h.status} · ${fmtS(took)}${took > 8000 ? ' (ช้า: เซิร์ฟเวอร์น่าจะเพิ่งตื่นจากหลับหรือเพิ่งบูต)' : ''}`);
  console.log(`  ${JSON.stringify(h.body)}`);
  if (h.body?.status !== 'ok') fail('/health ไม่ใช่ ok (ฐานข้อมูลอาจต่อไม่ได้)');

  // 2) /symptom-search/status
  console.log('\n2) GET /symptom-search/status');
  let s;
  try {
    const r = await getJson('/symptom-search/status', 30_000);
    if (r.status === 404) {
      fail('ไม่พบ endpoint นี้ (เซิร์ฟเวอร์ยังรันโค้ดเก่าที่ไม่มีระบบค้นหา)');
      return;
    }
    s = r.body;
  } catch (e) {
    fail(`อ่านสถานะไม่ได้ (${e.name})`);
    return;
  }
  console.log(`  state=${s.state} memoryRssMb=${s.memoryRssMb} indexedGraphs=${s.indexedGraphs} loadMs=${s.loadMs}`);

  if (s.state === 'disabled') {
    console.log('\n✅ ระบบค้นหาปิดอยู่ (SYMPTOM_SEARCH_ENABLED ไม่ได้ตั้งเป็น true)');
    console.log(`   จดไว้: หน่วยความจำก่อนโหลดโมเดล = ${s.memoryRssMb} MB`);
    return;
  }

  if (s.state === 'loading') {
    const tw = Date.now();
    process.stdout.write(`  กำลังโหลดโมเดล รอได้นานสุด ${WAIT_S} วินาที `);
    while (s.state === 'loading' && Date.now() - tw < WAIT_S * 1000) {
      await sleep(3000);
      process.stdout.write('.');
      try { s = (await getJson('/symptom-search/status', 30_000)).body; } catch { /* ลองใหม่รอบหน้า */ }
    }
    console.log(`\n  โหลดใช้เวลา (ที่วัดจากฝั่งนี้) ${fmtS(Date.now() - tw)} · state=${s.state} loadMs=${s.loadMs}`);
  }

  if (s.state === 'failed') {
    fail(`โหลดไม่สำเร็จ: ${s.error}`);
    return;
  }
  if (s.state !== 'ready') {
    fail(`ยังเป็น ${s.state} หลังรอ ${WAIT_S} วินาที (เพิ่ม --wait หรือดูล็อกบน Render)`);
    return;
  }

  console.log(`  ready · modelFilesFoundLocally=${s.modelFilesFoundLocally} · memoryRssMb=${s.memoryRssMb}`);
  if (!s.modelFilesFoundLocally) fail('ไม่พบไฟล์โมเดลในเครื่องเซิร์ฟเวอร์ (model-slim ไม่ถูกนำขึ้น?)');
  const before = s.memoryRssMb;

  // 3) ยิงคำค้น
  console.log(`\n3) POST /symptom-search × ${N_QUERIES}`);
  const times = [];
  let bad = 0;
  for (let i = 0; i < N_QUERIES; i++) {
    const q = QUERIES[i % QUERIES.length];
    const t = Date.now();
    try {
      const res = await fetch(`${BASE}/symptom-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: AbortSignal.timeout(60_000),
      });
      const body = await res.json().catch(() => null);
      times.push(Date.now() - t);
      if (res.status !== 200) {
        bad += 1;
        console.log(`  ✗ "${q}" → ${res.status} ${body?.code ?? ''}`);
      } else if (i < QUERIES.length) {
        const top = body.matches[0];
        console.log(`  ✓ "${q}" → ${top ? `${top.graphId.replace('samsung_ac_ar70h_', '')} ${top.score}` : '(ไม่มีผังผ่านเกณฑ์)'} · ${Date.now() - t} ms`);
      }
    } catch (e) {
      bad += 1;
      console.log(`  ✗ "${q}" → ${e.name}`);
    }
  }
  if (bad > 0) fail(`คำค้นล้มเหลว ${bad} จาก ${N_QUERIES} ครั้ง`);
  if (times.length > 0) {
    times.sort((a, b) => a - b);
    console.log(`  เวลาตอบ (รวมเครือข่าย): median=${times[Math.floor(times.length / 2)]} ms · max=${times[times.length - 1]} ms`);
  }

  // 4) หน่วยความจำหลังใช้งาน
  const after = (await getJson('/symptom-search/status', 30_000)).body.memoryRssMb;
  console.log(`\n4) หน่วยความจำ: ก่อนยิง ${before} MB → หลังยิง ${after} MB (เพิ่ม ${after - before} MB)`);
  console.log('   หมายเหตุ: ในเครื่องผู้พัฒนา ค่านี้ขึ้นช่วงแรกราว 750 ข้อความแล้วนิ่ง (~290-320 MB) บน Render ยังไม่เคยวัด');
  if (after >= WARN_RSS_MB) {
    fail(`หน่วยความจำ ${after} MB สูงกว่า ${WARN_RSS_MB} MB (เพดาน Render ฟรี 512 MB) ควรปิดสวิตช์ SYMPTOM_SEARCH_ENABLED`);
  }
}

main()
  .catch((e) => fail(`สคริปต์ผิดพลาด: ${e.message}`))
  .finally(() => {
    console.log(problems === 0 ? '\n✅ ไม่พบปัญหา' : `\n❌ พบปัญหา ${problems} รายการ`);
    process.exit(problems === 0 ? 0 : 1);
  });

require('dotenv').config();
const tls = require('tls');
const crypto = require('crypto');

const ca = process.env.DB_SSL_CA;
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_SSL_CA length:', ca ? ca.length : '(ไม่มีค่าเลย!)');

if (!ca) {
  console.log('ไม่พบ DB_SSL_CA ใน .env — ตรวจว่าบันทึกไฟล์แล้วหรือยัง');
  process.exit(1);
}

console.log('มี \\r (Windows carriage return) ปนอยู่หรือไม่:', ca.includes('\r'));
console.log('มีตัวอักษร \\ กับ n แยกกัน (ยังไม่ถูกแปลงเป็นขึ้นบรรทัดใหม่) หรือไม่:', ca.includes('\\n'));
console.log('ขึ้นต้นด้วย -----BEGIN CERTIFICATE----- ถูกต้อง:', ca.startsWith('-----BEGIN CERTIFICATE-----'));
console.log('ลงท้ายด้วย -----END CERTIFICATE----- ถูกต้อง:', ca.trim().endsWith('-----END CERTIFICATE-----'));

try {
  const cert = new crypto.X509Certificate(ca);
  console.log('พาร์สใบรับรองด้วย Node สำเร็จ, subject:', cert.subject);
} catch (e) {
  console.log('พาร์สใบรับรองล้มเหลว:', e.message);
  process.exit(1);
}

console.log('--- ลองเชื่อมต่อ TLS ตรงๆ ไปที่ DB_HOST:DB_PORT (ไม่ผ่าน mysql2 เลย) ---');
const socket = tls.connect(
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    ca,
    servername: process.env.DB_HOST,
    timeout: 10000,
  },
  () => {
    console.log('เชื่อมต่อ TLS สำเร็จ, authorized:', socket.authorized);
    if (!socket.authorized) console.log('authorizationError:', socket.authorizationError);
    socket.end();
    process.exit(socket.authorized ? 0 : 1);
  },
);
socket.on('timeout', () => { console.log('หมดเวลาเชื่อมต่อ (timeout)'); socket.destroy(); process.exit(1); });
socket.on('error', (err) => { console.log('เชื่อมต่อ TLS ล้มเหลว:', err.message); process.exit(1); });
// backend/jest.config.js

/**
 * ตั้งค่า Jest ให้อ่านไฟล์ TypeScript ได้โดยตรง
 *
 * ทำไมต้องมีไฟล์นี้:
 *   package.json มีคำสั่ง "test": "jest" อยู่แล้ว แต่ไม่เคยมี config
 *   Jest จึงไม่รู้ว่าต้องแปลง .ts ก่อนรัน และไม่รู้ว่าไฟล์เทสอยู่ที่ไหน
 *   → สั่ง npm test แล้วขึ้น "No tests found"
 */

/** @type {import('jest').Config} */
module.exports = {
  // ให้ ts-jest แปลง .ts เป็น JavaScript ในหน่วยความจำก่อนรัน
  // (ไม่ได้เขียนไฟล์ .js ลงดิสก์ จึงไม่ทิ้งขยะไว้)
  preset: 'ts-jest',

  // โค้ดนี้รันบน Node ไม่ใช่บนเบราว์เซอร์ จึงไม่ต้องจำลอง DOM
  testEnvironment: 'node',

  // นับ src/ เป็นรากของโปรเจกต์ ไม่ต้องมองออกไปนอกโฟลเดอร์
  rootDir: 'src',

  // ไฟล์ไหนถือเป็นไฟล์เทส: ลงท้ายด้วย .spec.ts
  testRegex: '.*\\.spec\\.ts$',

  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // วัด coverage เฉพาะโค้ดจริง ไม่นับไฟล์เทสเอง
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',

  // path-coverage.spec.ts เดินกราฟ 13 กราฟ อาจใช้เวลานานกว่า 5 วินาทีเริ่มต้น
  testTimeout: 30000,
};
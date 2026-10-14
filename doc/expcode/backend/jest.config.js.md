# backend/jest.config.js

## 1. หน้าที่ของไฟล์

ไฟล์ตั้งค่า Jest ของ backend ให้รันไฟล์ทดสอบ TypeScript (`*.spec.ts`) ได้โดยตรง เหตุผลที่ต้องมี (คอมเมนต์ 6–9): `package.json` มีคำสั่ง `"test": "jest"` อยู่แล้วแต่ไม่เคยมี config ทำให้ Jest ไม่รู้ว่าต้องแปลง `.ts` และไม่รู้ว่าไฟล์เทสอยู่ที่ไหน จึงขึ้น "No tests found"

- **ใครเรียกใช้**: Jest (ผ่านสคริปต์ `npm test` ใน `package.json`) — ไม่มีไฟล์โค้ดไหน import
- **เรียกใช้**: `ts-jest` (preset) และ `tsconfig.json` ของ backend (ts-jest อ่านเองโดยอัตโนมัติ)

## 2. อธิบายทีละบล็อก

เป็น `module.exports = { ... }` ที่มี type hint `@type {import('jest').Config}` (บรรทัด 12–13)

| บรรทัด | key | ค่า | ความหมาย / เหตุผล |
|---|---|---|---|
| 16 | `preset` | `'ts-jest'` | แปลง `.ts` เป็น JS ในหน่วยความจำก่อนรัน ไม่เขียนไฟล์ `.js` ลงดิสก์ จึงไม่ทิ้งขยะ |
| 19 | `testEnvironment` | `'node'` | โค้ดรันบน Node ไม่ต้องจำลอง DOM |
| 22 | `rootDir` | `'src'` | นับ `src/` เป็นรากของโปรเจกต์ |
| 25 | `testRegex` | `'.*\\.spec\\.ts$'` | ไฟล์ที่ลงท้ายด้วย `.spec.ts` ถือเป็นเทส |
| 27–29 | `transform` | `'^.+\\.ts$': 'ts-jest'` | ระบุตัวแปลงของไฟล์ `.ts` |
| 32 | `collectCoverageFrom` | `['**/*.ts', '!**/*.spec.ts']` | วัด coverage เฉพาะโค้ดจริง ไม่นับไฟล์เทส |
| 33 | `coverageDirectory` | `'../coverage'` | เขียนรายงานที่ `backend/coverage` (นับจาก `rootDir`) |
| 36 | `testTimeout` | `30000` | 30 วินาที เพราะ `path-coverage.spec.ts` เดินกราฟ 13 กราฟ อาจเกินค่าเริ่มต้น 5 วินาที |

- **รับอะไร/คืนอะไร**: ไม่รับค่า export object ให้ Jest อ่าน

## 3. การส่งข้อมูล

`npm test` → `jest` อ่าน `jest.config.js` → หาไฟล์ `src/**/*.spec.ts` → `ts-jest` แปลงด้วยตัวเลือกจาก `tsconfig.json` → รันเทส (ผ่าน function call ไม่มี HTTP)

## 4. จุดที่ควรระวัง

- **`rootDir: 'src'` ทำให้ `__dirname` ของไฟล์เทสอยู่ใต้ `backend/src/...`** เทสที่อ่านข้อมูลใช้ path แบบ `'../../../data/…'` (เช่น `path-coverage.spec.ts`) ซึ่งพึ่งตำแหน่งนี้
- ไม่มี `moduleNameMapper` หรือการตั้งค่า ESM: ใช้ได้เพราะ `tsconfig.json` ตั้ง `module: "commonjs"`
- `coverageDirectory: '../coverage'` อยู่นอก `src` — โฟลเดอร์ `coverage` ไม่อยู่ใน `.gitignore` ของ backend (ดูสรุป `backend/.gitignore`) จึงต้องระวังไม่ให้ถูก commit (อนุมานจากโค้ด)
- คำอธิบายในคอมเมนต์ (บรรทัด 7–9) เป็นประวัติปัญหาเดิมที่แก้แล้ว ไม่ได้บอกพฤติกรรมปัจจุบัน

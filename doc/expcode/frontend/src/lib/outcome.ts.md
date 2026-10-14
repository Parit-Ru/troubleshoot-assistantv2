# frontend/src/lib/outcome.ts

## 1. หน้าที่ของไฟล์

ตรรกะเล็กๆ ของช่องกรอก "ผลลัพธ์" ตอนการตรวจจบ (ฟังก์ชันล้วน ไม่แตะ React ไม่เรียก API) ตรวจฝั่งหน้าจอเพื่อกันกดบันทึกเปล่าประโยชน์ (ช่องว่างล้วน/ยาวเกิน) — **เซิร์ฟเวอร์ตรวจซ้ำเสมอและเป็นผู้ตัดสิน** (`INVALID_OUTCOME`) หน้าจอไม่ได้ป้องกันแทนเซิร์ฟเวอร์ ไม่ตรวจเนื้อหา

- **ใครเรียกใช้**: `components/OutcomeForm.tsx`, `lib/errors.ts` (ใช้ `MAX_OUTCOME_LENGTH` ในข้อความ), `outcome.test.ts`
- **เรียกใช้**: ไม่มี

## 2. อธิบายทีละบล็อก

- `MAX_OUTCOME_LENGTH = 1000` (18): ต้องตรงกับ `MAX_OUTCOME_LENGTH` ใน `backend/src/traversal/traversal.dto.ts` (ลอกมาด้วยมือ) นับหน่วย JavaScript `.length` เหมือนเซิร์ฟเวอร์ ; ตรงกับ `maxLength` ของช่องกรอก (อีโมจินับ 2)
- `normalizeOutcome(raw)` (21–23): `raw.trim()` เหมือนที่เซิร์ฟเวอร์ทำ
- `type OutcomeCheck = 'ok' | 'empty' | 'too-long'` และ `checkOutcome(raw)` (31–38): trim แล้ว ว่าง → `'empty'`, เกิน 1000 → `'too-long'`, ไม่เช่นนั้น `'ok'`
- `formatOutcomeCounter(raw)` (45–47): `` `${raw.length}/${MAX_OUTCOME_LENGTH}` `` เช่น "12/1000" — นับตามที่พิมพ์จริง (ไม่ตัดช่องว่าง) เพื่อเทียบกับ `maxLength` ของช่อง จึงไม่ทำให้ข้อความที่ตัดช่องว่างแล้วยาวเกิน

## 3. การส่งข้อมูล

ข้อความจาก `<textarea>` → `checkOutcome` ตัดสินว่าให้กดบันทึกได้ไหม → `useSubmitOutcome().mutate(text)` → `POST /traversal/sessions/:id/outcome` → เซิร์ฟเวอร์ตรวจ `parseOutcomeBody` อีกครั้ง

## 4. จุดที่ควรระวัง

- **ค่า 1000 ซ้ำกับ backend** ไม่มีกลไกอัตโนมัติรับรอง (เทสใน `outcome.test.ts` ล็อกค่าไว้เป็นเครื่องเตือน)
- การไม่ตรวจเนื้อหา (HTML/สคริปต์) หมายความว่าความปลอดภัยพึ่งการที่หน้าจอแสดงเป็นข้อความธรรมดา ไม่ใช่ HTML (ตามที่ `outcome.test.ts` ระบุ)

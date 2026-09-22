/**
 * หน้าเลือกอาการ — ฉบับชั่วคราวของขั้น 4
 *
 * มีไว้ให้ route "/symptoms" มีอะไรแสดง และให้ทดสอบเมนูใน AppShell ได้
 * ตัวจริงจะดึงรายการอาการจาก useGraphs() แล้วแสดงเป็นแถว ตามที่ตกลงไว้
 */
export function SymptomsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">เลือกอาการ</h1>
      <p className="text-ink-soft">หน้าชั่วคราว — รายการอาการจะมาในขั้นถัดไป</p>
    </div>
  )
}
/**
 * หน้ารวมตัวอย่างสถานะ (gallery) — ฉบับชั่วคราวของขั้น 4
 *
 * route คือ "/gallery" ไม่อยู่ในเมนู เข้าได้จากการพิมพ์ URL เท่านั้น
 * ตัวจริงจะแสดงสถานะตัวอย่าง 8 แบบจาก mocks/fixtures.ts ทีละแบบ ไว้ถ่ายภาพหน้าจอลงรายงาน
 *
 * ชื่อไฟล์ยังใช้คำว่า Node ตามชื่อในโค้ด (node = สถานะ) แต่ข้อความบนหน้าจอใช้คำว่า "สถานะ"
 */
export function NodeGalleryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">ตัวอย่างสถานะ</h1>
      <p className="text-ink-soft">หน้าชั่วคราว — ตัวอย่างสถานะทั้ง 8 แบบจะมาในขั้นถัดไป</p>
    </div>
  )
}
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { NodeGalleryPage } from './pages/NodeGalleryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SessionPage } from './pages/SessionPage'
import { SymptomsPage } from './pages/SymptomsPage'

/**
 * จุดเริ่มของแอป ต่อ 3 ชั้นเข้าด้วยกัน: แคชข้อมูล → router → โครงหน้า
 *
 * สร้าง QueryClient นอก component เพราะถ้าสร้างข้างใน
 * ทุกครั้งที่ App วาดใหม่จะได้แคชใหม่ และข้อมูลที่โหลดไว้จะหายหมด
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ไม่ลองใหม่เองเมื่อพัง ให้ error ขึ้นทันที
      // ค่าปกติลองใหม่ 3 ครั้ง ถ้าเซิร์ฟเวอร์ดับ ผู้ใช้จะเห็นแต่ตัวหมุนนานหลายวินาทีโดยไม่รู้ว่าเกิดอะไร
      retry: false,
      // ไม่โหลดใหม่ทุกครั้งที่สลับแท็บกลับมา ข้อมูลของแอปนี้ไม่ได้เปลี่ยนเองระหว่างที่ผู้ใช้ไปทำอย่างอื่น
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * ใช้ HashRouter (URL แบบ /#/symptoms) ไม่ใช้ BrowserRouter
 * เพราะ GitHub Pages ไม่มีเซิร์ฟเวอร์ที่ตั้งค่าได้ ถ้าเปิด /symptoms ตรงๆ หรือกด F5 จะได้ 404 ของ GitHub
 * ส่วนหลัง # ไม่ถูกส่งไปเซิร์ฟเวอร์ GitHub จึงส่ง index.html ให้เสมอ แล้วแอปอ่านส่วนหลัง # เอง
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/symptoms" element={<SymptomsPage />} />
            <Route path="/session/:sessionId" element={<SessionPage />} />
            <Route path="/gallery" element={<NodeGalleryPage />} />
            {/* * = ทุก URL ที่ไม่ตรงกับเส้นข้างบน */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </QueryClientProvider>
  )
}
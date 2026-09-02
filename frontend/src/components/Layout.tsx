import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'หน้าแรก' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-48 bg-gray-800 flex flex-col gap-1 p-4 shrink-0">
        <p className="text-yellow-400 font-bold text-lg mb-4">FixBot</p>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? 'bg-yellow-400 text-gray-900 font-semibold' : 'hover:bg-gray-700'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '../lib/api'

export default function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    retry: false,
  })

  return (
    <div>
      <h1 className="text-3xl font-bold text-yellow-400 mb-6">FixBot</h1>

      <div className="bg-gray-800 rounded-lg p-6 max-w-sm">
        <p className="text-sm text-gray-400 mb-2">Backend status</p>
        {isLoading && <p className="text-gray-400">กำลังเชื่อมต่อ...</p>}
        {isError  && <p className="text-red-400">เชื่อมต่อ backend ไม่ได้</p>}
        {data     && (
          <p className="text-green-400 font-semibold">
            ✓ {data.status} — {data.service}
          </p>
        )}
      </div>
    </div>
  )
}
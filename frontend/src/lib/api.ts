const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/health`)
  if (!res.ok) throw new Error('Backend unreachable')
  return res.json()
}
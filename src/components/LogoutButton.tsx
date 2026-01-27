'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    // Full page reload to ensure session is cleared
    window.location.href = '/wallets'
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-black hover:bg-gray-200"
    >
      Logout
    </button>
  )
}

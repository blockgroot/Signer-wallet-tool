'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Signer {
  id: string
  name: string
  department: string | null
  addresses: Array<{
    id: string
    address: string
  }>
}

export default function SignersPage() {
  const router = useRouter()
  const [signers, setSigners] = useState<Signer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadSigners()
    loadSession()
  }, [search])

  const loadSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const session = await response.json()
        setIsAdmin(session.isAdmin || false)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  const loadSigners = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/signers?${params.toString()}`)
      // Public access - no auth required for viewing
      if (!response.ok) {
        console.error('Failed to fetch signers:', response.statusText)
        return
      }

      const data = await response.json()
      setSigners(data)
    } catch (error) {
      console.error('Failed to load signers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = () => {
    // TODO: Open add user modal
    alert('Add user functionality coming soon')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Signers</h1>
        {isAdmin && (
          <button
            onClick={handleAddUser}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add User
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading...</div>
      ) : signers.length === 0 ? (
        <div className="py-8 text-center text-gray-500">No signers found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 bg-white shadow">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Department
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {signers.map((signer) =>
                signer.addresses.map((address, idx) => (
                  <tr key={`${signer.id}-${address.id}`} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/signers/${signer.id}`}
                        className="font-mono text-sm text-indigo-600 hover:text-indigo-900"
                      >
                        {address.address}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {idx === 0 ? signer.name : ''}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {idx === 0 ? signer.department || '-' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

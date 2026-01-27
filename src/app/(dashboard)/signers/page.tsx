'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AddressDisplay from '@/components/AddressDisplay'
import LoginModal from '@/components/LoginModal'
import AddUserModal from '@/components/AddUserModal'

interface SignerRow {
  id: string
  address: string
  signerId: string
  signerName: string
  department: string | null
  walletCount: number
}

export default function SignersPage() {
  const router = useRouter()
  const [signers, setSigners] = useState<SignerRow[]>([])
  const [filteredSigners, setFilteredSigners] = useState<SignerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)

  useEffect(() => {
    loadSigners()
    loadSession()
  }, [])

  useEffect(() => {
    filterSigners()
  }, [search, signers])

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
      const response = await fetch('/api/signers')
      if (!response.ok) {
        console.error('Failed to fetch signers:', response.statusText)
        return
      }

      const data = await response.json()
      setSigners(data)
      setFilteredSigners(data)
    } catch (error) {
      console.error('Failed to load signers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSigners = () => {
    if (!search.trim()) {
      setFilteredSigners(signers)
      return
    }

    const searchLower = search.toLowerCase().trim()
    const filtered = signers.filter((row) => {
      // Search by address (primary)
      if (row.address.toLowerCase().includes(searchLower)) return true
      
      // Search by name
      if (row.signerName.toLowerCase().includes(searchLower)) return true
      
      // Search by department
      if (row.department?.toLowerCase().includes(searchLower)) return true
      
      return false
    })
    
    setFilteredSigners(filtered)
  }

  const handleAddUser = () => {
    if (!isAdmin) {
      setShowLoginModal(true)
      return
    }
    setShowAddUserModal(true)
  }

  const handleLoginSuccess = () => {
    loadSession()
  }

  const handleAddUserSuccess = () => {
    loadSigners() // Refresh the signer list
  }

  return (
    <div>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        message="You need to login to add a new user mapping."
      />

      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={handleAddUserSuccess}
      />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-black">Signers Directory</h1>
        <button
          onClick={handleAddUser}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add User
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, department, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-black">Loading...</div>
      ) : filteredSigners.length === 0 ? (
        <div className="py-8 text-center text-black">
          {search ? 'No signers match your search' : 'No signers found'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Wallets
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredSigners.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <AddressDisplay
                      address={row.address}
                      name={null}
                      signerId={row.signerId}
                      linkToSigner={true}
                      showFull={false}
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/signers/${row.signerId}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {row.signerName || 'Unknown'}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                    {row.department || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                    {row.walletCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NetworkToggle from '@/components/NetworkToggle'
import ChainBadge from '@/components/ChainBadge'

interface Wallet {
  id: string
  address: string
  name: string | null
  chainId: number
  tag: string | null
  createdAt: Date
  updatedAt: Date
}

export default function WalletsPage() {
  const router = useRouter()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadWallets()
    loadSession()
  }, [selectedChainId, search])

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

  const loadWallets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedChainId) {
        params.append('chainId', selectedChainId.toString())
      }
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/wallets?${params.toString()}`)
      // Public access - no auth required for viewing
      if (!response.ok) {
        console.error('Failed to fetch wallets:', response.statusText)
        return
      }

      const data = await response.json()
      setWallets(data)
    } catch (error) {
      console.error('Failed to load wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddWallet = () => {
    // TODO: Open add wallet modal
    alert('Add wallet functionality coming soon')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Multisig Wallets</h1>
        {isAdmin && (
          <button
            onClick={handleAddWallet}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Wallet
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by address or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>

      <NetworkToggle selectedChainId={selectedChainId} onChainChange={setSelectedChainId} />

      {loading ? (
        <div className="py-8 text-center">Loading...</div>
      ) : wallets.length === 0 ? (
        <div className="py-8 text-center text-gray-500">No wallets found</div>
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
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {wallets.map((wallet) => (
                <tr key={wallet.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/wallets/${wallet.id}`}
                      className="font-mono text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      {wallet.address}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {wallet.name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <ChainBadge chainId={wallet.chainId} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {wallet.tag || '-'}
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

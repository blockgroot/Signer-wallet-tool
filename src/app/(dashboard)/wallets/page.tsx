'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NetworkToggle from '@/components/NetworkToggle'
import ChainBadge from '@/components/ChainBadge'
import WalletTag from '@/components/WalletTag'
import LoginModal from '@/components/LoginModal'
import AddWalletModal from '@/components/AddWalletModal'
import { parseTags, getExplorerUrl } from '@/lib/utils'

interface WalletSigner {
  address: string
  name: string | null
  signerId: string | null
}

interface Wallet {
  id: string
  address: string
  name: string | null
  chainId: number
  tag: string | null
  threshold: number
  totalSigners: number
  signers: WalletSigner[]
  createdAt: Date
  updatedAt: Date
}

export default function WalletsPage() {
  const router = useRouter()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [filteredWallets, setFilteredWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showAddWalletModal, setShowAddWalletModal] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')

  useEffect(() => {
    loadWallets()
    loadSession()
  }, [selectedChainId])

  useEffect(() => {
    filterWallets()
  }, [search, wallets])

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

      const response = await fetch(`/api/wallets?${params.toString()}`)
      if (!response.ok) {
        console.error('Failed to fetch wallets:', response.statusText)
        return
      }

      const data = await response.json()
      setWallets(data)
      setFilteredWallets(data)
    } catch (error) {
      console.error('Failed to load wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterWallets = () => {
    if (!search.trim()) {
      setFilteredWallets(wallets)
      return
    }

    const searchLower = search.toLowerCase().trim()
    const filtered = wallets.filter((wallet) => {
      // Search by address
      if (wallet.address.toLowerCase().includes(searchLower)) return true
      
      // Search by name
      if (wallet.name?.toLowerCase().includes(searchLower)) return true
      
      // Search by tag
      if (wallet.tag?.toLowerCase().includes(searchLower)) return true
      
      // Search by signer name
      if (wallet.signers.some(s => s.name?.toLowerCase().includes(searchLower))) return true
      
      // Search by signer address
      if (wallet.signers.some(s => s.address.toLowerCase().includes(searchLower))) return true
      
      return false
    })
    
    setFilteredWallets(filtered)
  }

  const handleAddWallet = () => {
    if (!isAdmin) {
      setLoginMessage('You need to login to add a new multisig wallet.')
      setShowLoginModal(true)
      return
    }
    setShowAddWalletModal(true)
  }

  const handleLoginSuccess = () => {
    loadSession()
  }

  const handleAddWalletSuccess = () => {
    loadWallets() // Refresh the wallet list
  }

  return (
    <div>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        message={loginMessage}
      />

      <AddWalletModal
        isOpen={showAddWalletModal}
        onClose={() => setShowAddWalletModal(false)}
        onSuccess={handleAddWalletSuccess}
      />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-black">Multisig Wallets</h1>
        <button
          onClick={handleAddWallet}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Multi-sig
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by address, name, tag, or signer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>

      <NetworkToggle selectedChainId={selectedChainId} onChainChange={setSelectedChainId} />

      {loading ? (
        <div className="py-8 text-center text-black">Loading...</div>
      ) : filteredWallets.length === 0 ? (
        <div className="py-8 text-center text-black">
          {search ? 'No wallets match your search' : 'No wallets found'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Wallet Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Signers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Tags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredWallets.map((wallet) => {
                const explorerUrl = getExplorerUrl(wallet.address, wallet.chainId)
                const tags = parseTags(wallet.tag)
                
                return (
                  <tr key={wallet.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/wallets/${wallet.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {wallet.name || wallet.address.slice(0, 10) + '...'}
                        </Link>
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-black hover:text-gray-600"
                            title="View on block explorer"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ChainBadge chainId={wallet.chainId} />
                    </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                          {wallet.threshold === 0 && wallet.totalSigners === 0 ? (
                            <span className="text-black italic">View details</span>
                          ) : (
                            `${wallet.threshold} / ${wallet.totalSigners}`
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-black">
                          {wallet.signers.length === 0 ? (
                            <span className="text-black italic">View details</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {wallet.signers.slice(0, 3).map((signer, idx) => (
                                <div key={idx} className="flex items-center">
                                  <span className="font-mono text-xs text-black">
                                    {signer.address.slice(0, 6)}...{signer.address.slice(-4)}
                                  </span>
                                  {signer.name && (
                                    <span className="ml-1 text-xs text-black">— {signer.name}</span>
                                  )}
                                </div>
                              ))}
                              {wallet.signers.length > 3 && (
                                <span className="text-xs text-black">+{wallet.signers.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {tags.length > 0 ? (
                          tags.map((tag, idx) => (
                            <WalletTag key={idx} tag={tag} />
                          ))
                        ) : (
                          <span className="text-sm text-black">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

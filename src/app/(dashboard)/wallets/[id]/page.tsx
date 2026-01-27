'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChainBadge from '@/components/ChainBadge'
import WalletTag from '@/components/WalletTag'
import AddressDisplay from '@/components/AddressDisplay'
import LoginModal from '@/components/LoginModal'
import EditWalletModal from '@/components/EditWalletModal'
import { parseTags, getExplorerUrl } from '@/lib/utils'
import type { WalletWithDetails } from '@/types'

export default function WalletDetailPage() {
  const router = useRouter()
  const params = useParams()
  const walletId = params.id as string
  const [wallet, setWallet] = useState<WalletWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    loadWallet()
    loadSession()
  }, [walletId])

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

  const loadWallet = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/wallets/${walletId}`)
      if (response.status === 404) {
        router.push('/wallets')
        return
      }
      if (!response.ok) {
        console.error('Failed to fetch wallet:', response.statusText)
        return
      }
      const data = await response.json()
      setWallet(data)
    } catch (error) {
      console.error('Failed to load wallet:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (!isAdmin) {
      setShowLoginModal(true)
      return
    }
    setShowEditModal(true)
  }

  const handleDelete = async () => {
    if (!isAdmin) {
      setShowLoginModal(true)
      return
    }

    if (!confirm(`Are you sure you want to delete wallet ${wallet?.name || wallet?.address}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/wallets/${walletId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete wallet')
        return
      }

      // Redirect to wallets dashboard
      router.push('/wallets')
    } catch (error) {
      console.error('Failed to delete wallet:', error)
      alert('An error occurred while deleting the wallet')
    }
  }

  const copyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address)
      // TODO: Show toast notification
    }
  }

  const handleLoginSuccess = () => {
    loadSession()
  }

  const handleEditSuccess = () => {
    loadWallet() // Refresh wallet data
  }

  if (loading) {
    return <div className="py-8 text-center text-black">Loading...</div>
  }

  if (!wallet) {
    return <div className="py-8 text-center text-black">Wallet not found</div>
  }

  const tags = parseTags(wallet.tag)
  const explorerUrl = getExplorerUrl(wallet.address, wallet.chainId)

  return (
    <div>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        message="You need to login to edit wallet details."
      />

      {wallet && (
        <EditWalletModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          wallet={wallet}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-black">Wallet Details</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Edit Details
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Header Section */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-black">Wallet Name</label>
            <p className="mt-1 text-lg font-semibold text-black">
              {wallet.name || 'Unnamed Wallet'}
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-black">Address</label>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-sm text-black">{wallet.address}</p>
              <button
                onClick={copyAddress}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs text-black hover:bg-gray-200"
                title="Copy address"
              >
                Copy
              </button>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black hover:text-gray-600"
                  title="View on block explorer"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-black">Network</label>
              <div className="mt-1">
                <ChainBadge chainId={wallet.chainId} />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-black">Threshold</label>
              <div className="mt-1">
                {wallet.threshold === 0 && wallet.totalSigners === 0 ? (
                  <div>
                    <p className="text-lg font-semibold text-black">Live data unavailable</p>
                    <p className="text-xs text-black mt-1">
                      {wallet._apiError 
                        ? `Error: ${wallet._apiError}` 
                        : 'Unable to fetch threshold from Safe API. Check server logs for details.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-black">
                    {wallet.threshold} / {wallet.totalSigners}
                  </p>
                )}
              </div>
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-black">Tags</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <WalletTag key={idx} tag={tag} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signers Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-black">Signers</h2>
        {wallet.signers.length === 0 ? (
          <p className="text-black">No signers found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                    Signer Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                    Mapped Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {wallet.signers.map((signer, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <AddressDisplay
                        address={signer.address}
                        name={signer.signerName}
                        signerId={signer.signerId}
                        linkToSigner={!!signer.signerId}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                      {signer.signerName || (
                        <span className="text-black italic">Unmapped</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                      {signer.department || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChainBadge from '@/components/ChainBadge'
import type { WalletWithDetails } from '@/types'

export default function WalletDetailPage() {
  const router = useRouter()
  const params = useParams()
  const walletId = params.id as string
  const [wallet, setWallet] = useState<WalletWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

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
      // Public access - no auth required for viewing
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
      // Check if user is admin (we'll get this from session in a better way)
      setIsAdmin(false) // Will be set properly later
    } catch (error) {
      console.error('Failed to load wallet:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setShowEditModal(true)
  }

  const copyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address)
      alert('Address copied to clipboard')
    }
  }

  if (loading) {
    return <div className="py-8 text-center">Loading...</div>
  }

  if (!wallet) {
    return <div className="py-8 text-center text-gray-500">Wallet not found</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Wallet Details</h1>
        {isAdmin && (
          <button
            onClick={handleEdit}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Edit Details
          </button>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Wallet Name</label>
            <p className="mt-1 text-lg text-gray-900">{wallet.name || 'Unnamed'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Address</label>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-sm text-gray-900">{wallet.address}</p>
              <button
                onClick={copyAddress}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
              >
                Copy
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Network</label>
            <div className="mt-1">
              <ChainBadge chainId={wallet.chainId} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Threshold</label>
            <p className="mt-1 text-lg text-gray-900">
              {wallet.threshold} / {wallet.totalSigners}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Total Signers</label>
            <p className="mt-1 text-lg text-gray-900">{wallet.totalSigners}</p>
          </div>
          {wallet.tag && (
            <div>
              <label className="text-sm font-medium text-gray-500">Tag</label>
              <p className="mt-1 text-sm text-gray-900">{wallet.tag}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Signers</h2>
        {wallet.signers.length === 0 ? (
          <p className="text-gray-500">No signers found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Mapped Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {wallet.signers.map((signer, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      {signer.signerId ? (
                        <Link
                          href={`/signers/${signer.signerId}`}
                          className="font-mono text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          {signer.address}
                        </Link>
                      ) : (
                        <span className="font-mono text-sm text-gray-900">{signer.address}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {signer.signerName || (
                        <span className="text-gray-400 italic">Unmapped</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
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

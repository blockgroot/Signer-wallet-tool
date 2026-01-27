'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChainBadge from '@/components/ChainBadge'
import AddressDisplay from '@/components/AddressDisplay'
import LoginModal from '@/components/LoginModal'
import { getExplorerUrl } from '@/lib/utils'
import type { SignerWithWallets } from '@/types'

export default function SignerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const signerId = params.id as string
  const [signer, setSigner] = useState<SignerWithWallets | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    loadSigner()
    loadSession()
  }, [signerId])

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

  const loadSigner = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/signers/${signerId}`)
      if (response.status === 404) {
        router.push('/signers')
        return
      }
      if (!response.ok) {
        console.error('Failed to fetch signer:', response.statusText)
        return
      }
      const data = await response.json()
      setSigner(data)
    } catch (error) {
      console.error('Failed to load signer:', error)
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

  const handleAddAddress = () => {
    if (!isAdmin) {
      setShowLoginModal(true)
      return
    }
    // TODO: Open add address modal
    alert('Add address functionality coming soon')
  }

  const handleLoginSuccess = () => {
    loadSession()
  }

  if (loading) {
    return <div className="py-8 text-center">Loading...</div>
  }

  if (!signer) {
    return <div className="py-8 text-center text-gray-500">Signer not found</div>
  }

  return (
    <div>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        message="You need to login to edit signer details."
      />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Signer Details</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Edit Details
            </button>
            <button
              onClick={handleAddAddress}
              className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Add Address
            </button>
          </div>
        )}
      </div>

      {/* Header Section */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Name</label>
            <p className="mt-1 text-lg font-semibold text-gray-900">{signer.name}</p>
          </div>
          {signer.department && (
            <div>
              <label className="text-sm font-medium text-gray-500">Department</label>
              <p className="mt-1 text-sm text-gray-900">{signer.department}</p>
            </div>
          )}
        </div>
      </div>

      {/* Associated Addresses Section */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Associated Addresses</h2>
        {signer.addresses.length === 0 ? (
          <p className="text-gray-500">No addresses found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {signer.addresses.map((address) => (
                  <tr key={address.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <AddressDisplay
                        address={address.address}
                        name={signer.name}
                        signerId={signer.id}
                        showFull={true}
                        linkToSigner={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multisig Access Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Multisig Wallets</h2>
        {signer.wallets.length === 0 ? (
          <p className="text-gray-500">This signer is not an owner of any wallets</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Wallet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Network
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Threshold
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {signer.wallets.map((wallet) => {
                  const explorerUrl = getExplorerUrl(wallet.address, wallet.chainId)
                  return (
                    <tr key={wallet.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/wallets/${wallet.id}`}
                            className="font-medium text-indigo-600 hover:text-indigo-900"
                          >
                            {wallet.name || wallet.address.slice(0, 10) + '...'}
                          </Link>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600"
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
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {wallet.threshold} / {wallet.totalSigners}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

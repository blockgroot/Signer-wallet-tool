'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChainBadge from '@/components/ChainBadge'
import type { SignerWithWallets } from '@/types'

export default function SignerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const signerId = params.id as string
  const [signer, setSigner] = useState<SignerWithWallets | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

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
      // Public access - no auth required for viewing
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
    setShowEditModal(true)
  }

  const handleAddAddress = () => {
    // TODO: Open add address modal
    alert('Add address functionality coming soon')
  }

  if (loading) {
    return <div className="py-8 text-center">Loading...</div>
  }

  if (!signer) {
    return <div className="py-8 text-center text-gray-500">Signer not found</div>
  }

  return (
    <div>
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

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Name</label>
            <p className="mt-1 text-lg text-gray-900">{signer.name}</p>
          </div>
          {signer.department && (
            <div>
              <label className="text-sm font-medium text-gray-500">Department</label>
              <p className="mt-1 text-sm text-gray-900">{signer.department}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Associated Addresses</h2>
        {signer.addresses.length === 0 ? (
          <p className="text-gray-500">No addresses found</p>
        ) : (
          <div className="space-y-2">
            {signer.addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-md border border-gray-200 p-3 font-mono text-sm"
              >
                {address.address}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow">
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {signer.wallets.map((wallet) => (
                  <tr key={wallet.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/wallets/${wallet.id}`}
                        className="font-mono text-sm text-indigo-600 hover:text-indigo-900"
                      >
                        {wallet.name || wallet.address}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ChainBadge chainId={wallet.chainId} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {wallet.threshold} / {wallet.totalSigners}
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
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChainBadge from '@/components/ChainBadge'
import AddressDisplay from '@/components/AddressDisplay'
import LoginModal from '@/components/LoginModal'
import EditSignerModal from '@/components/EditSignerModal'
import { getExplorerUrl, generateAddressLabels } from '@/lib/utils'
import type { SignerWithWallets } from '@/types'

export default function SignerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const signerId = params.id as string
  const liveCacheKey = `signerLiveWallets:${signerId}`
  const LIVE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  const [signer, setSigner] = useState<SignerWithWallets | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveLoaded, setLiveLoaded] = useState(false)

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
      // Load DB-first signer data immediately
      setSigner(data)

      // If we previously fetched live wallets, restore from sessionStorage (5 min TTL)
      try {
        const raw = sessionStorage.getItem(liveCacheKey)
        if (raw) {
          const cached = JSON.parse(raw) as { ts: number; wallets: SignerWithWallets['wallets'] }
          if (
            typeof cached?.ts === 'number' &&
            Date.now() - cached.ts < LIVE_CACHE_TTL_MS &&
            Array.isArray(cached.wallets)
          ) {
            setSigner({ ...data, wallets: cached.wallets })
            setLiveLoaded(true)
          }
        }
      } catch {
        // Ignore cache parse/availability errors
      }
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

  const handleDelete = async () => {
    if (!isAdmin) {
      setShowLoginModal(true)
      return
    }

    if (!confirm(`Are you sure you want to delete signer ${signer?.name}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/signers/${signerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete signer')
        return
      }

      // Redirect to signers dashboard
      router.push('/signers')
    } catch (error) {
      console.error('Failed to delete signer:', error)
      alert('An error occurred while deleting the signer')
    }
  }


  const fetchLiveWallets = async () => {
    if (!signer) return
    setLiveLoading(true)
    setLiveError(null)
    try {
      const response = await fetch(`/api/signers/${signerId}/live-wallets`, {
        // Allow browser caching (API sets Cache-Control: private...)
        cache: 'default',
      })
      const data = await response.json()
      if (!response.ok) {
        setLiveError(data?.error || 'Failed to fetch live wallets')
        return
      }
      const wallets = data.wallets || []
      setSigner({ ...signer, wallets })
      setLiveLoaded(true)

      // Persist live wallets for a short time so back/forward navigation feels smooth.
      try {
        sessionStorage.setItem(liveCacheKey, JSON.stringify({ ts: Date.now(), wallets }))
      } catch {
        // Ignore storage errors (private browsing, quota, etc.)
      }
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Failed to fetch live wallets')
    } finally {
      setLiveLoading(false)
    }
  }

  const handleLoginSuccess = () => {
    loadSession()
  }

  const handleEditSuccess = () => {
    loadSigner() // Refresh signer data
  }

  if (loading) {
    return <div className="py-8 text-center text-black">Loading...</div>
  }

  if (!signer) {
    return <div className="py-8 text-center text-black">Signer not found</div>
  }

  return (
    <div>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        message="You need to login to edit signer details."
      />

      {signer && (
        <EditSignerModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          signer={signer}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-black">Signer Details</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchLiveWallets}
            disabled={liveLoading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            title="Fetch fresh signer→wallet ownership data from Safe API (can take a few seconds)"
          >
            {liveLoading ? 'Fetching…' : liveLoaded ? 'Refresh live wallets' : 'Fetch live wallets (Safe)'}
          </button>

          {isAdmin && (
            <>
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
            </>
          )}
        </div>
      </div>

      {liveError && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-black">
          <div className="font-semibold">Live lookup failed</div>
          <div className="mt-1">{liveError}</div>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-black">Name</label>
            <p className="mt-1 text-lg font-semibold text-black">{signer.name}</p>
          </div>
          {signer.department && (
            <div>
              <label className="text-sm font-medium text-black">Department</label>
              <p className="mt-1 text-sm text-black">{signer.department}</p>
            </div>
          )}
        </div>
      </div>

      {/* Associated Addresses Section */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-black">Associated Addresses</h2>
        {signer.addresses.length === 0 ? (
          <p className="text-black">No addresses found</p>
        ) : (
          <div className="overflow-x-auto">
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
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {generateAddressLabels(signer.name, signer.addresses).map((addr) => (
                  <tr key={addr.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <AddressDisplay
                        address={addr.address}
                        name={null}
                        signerId={signer.id}
                        showFull={true}
                        linkToSigner={false}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                      {addr.displayName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                      {addr.displayType}
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

      {/* Multisig Access Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-black">Multisig Wallets</h2>
        {signer.wallets.length === 0 ? (
          <p className="text-black">
            {liveLoaded
              ? 'This signer is not an owner of any wallets (based on live Safe lookup).'
              : 'No wallets linked in DB yet. Click “Fetch live wallets (Safe)” to check ownership.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                    Wallet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                    Network
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
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
                        {wallet.threshold === 0 && wallet.totalSigners === 0
                          ? '—'
                          : `${wallet.threshold} / ${wallet.totalSigners}`}
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

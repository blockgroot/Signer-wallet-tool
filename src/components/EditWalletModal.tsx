'use client'

import { useState, useEffect } from 'react'
import { SUPPORTED_CHAINS } from '@/lib/chains'

interface EditWalletModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  wallet: {
    id: string
    address: string
    name: string | null
    chainId: number
    tag: string | null
  }
}

export default function EditWalletModal({ isOpen, onClose, onSuccess, wallet }: EditWalletModalProps) {
  const [name, setName] = useState('')
  const [chainId, setChainId] = useState<number>(1)
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && wallet) {
      setName(wallet.name || '')
      setChainId(wallet.chainId)
      setTag(wallet.tag || '')
    }
  }, [isOpen, wallet])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/wallets/${wallet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          chainId,
          tag: tag.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update wallet')
        return
      }

      // Success
      onSuccess()
      onClose()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-black">Edit Wallet</h2>
          <p className="mt-2 text-sm text-black">
            Update wallet metadata. Address cannot be changed.
          </p>
          <p className="mt-1 text-xs font-mono text-black">{wallet.address}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-black">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Treasury Wallet, Ops Wallet, etc."
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="chainId" className="block text-sm font-medium text-black">
                Network
              </label>
              <select
                id="chainId"
                value={chainId}
                onChange={(e) => setChainId(parseInt(e.target.value, 10))}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tag" className="block text-sm font-medium text-black">
                Tags (comma-separated)
              </label>
              <input
                id="tag"
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Treasury, Ops, Emergency"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-black">
                Separate multiple tags with commas
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Wallet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

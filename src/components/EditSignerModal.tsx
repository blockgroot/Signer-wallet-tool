'use client'

import { useState, useEffect } from 'react'

interface Address {
  id: string
  address: string
  name: string | null
  type: string | null
}

interface EditSignerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  signer: {
    id: string
    name: string
    department: string | null
    addresses?: Address[]
  }
}

export default function EditSignerModal({ isOpen, onClose, onSuccess, signer }: EditSignerModalProps) {
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [addresses, setAddresses] = useState<Array<{ id: string; address: string; name: string; type: string }>>([])
  const [newAddress, setNewAddress] = useState('')
  const [newAddressType, setNewAddressType] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [removingAddressId, setRemovingAddressId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && signer) {
      setName(signer.name || '')
      setDepartment(signer.department || '')
      // Initialize addresses from signer prop
      if (signer.addresses && signer.addresses.length > 0) {
        setAddresses(
          signer.addresses.map((addr) => ({
            id: addr.id,
            address: addr.address,
            name: addr.name || '',
            type: addr.type || '',
          }))
        )
      } else {
        setAddresses([])
      }
      // Reset new address form
      setNewAddress('')
      setNewAddressType('')
      setError('')
    }
  }, [isOpen, signer])

  if (!isOpen) return null

  // Calculate the next Account number
  const getNextAccountNumber = (): number => {
    const accountTypes = addresses
      .map((addr) => addr.type)
      .filter((type) => type && /^Account\s+(\d+)$/i.test(type.trim()))
    
    if (accountTypes.length === 0) return 1

    const numbers = accountTypes
      .map((type) => {
        const match = type?.match(/^Account\s+(\d+)$/i)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((n) => n > 0)

    if (numbers.length === 0) return 1

    const maxNumber = Math.max(...numbers)
    return maxNumber + 1
  }

  const handleAddressChange = (index: number, field: 'name' | 'type', value: string) => {
    const updated = [...addresses]
    updated[index] = { ...updated[index], [field]: value }
    setAddresses(updated)
  }

  const handleRemoveAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to remove this address?')) {
      return
    }

    setRemovingAddressId(addressId)
    setError('')

    try {
      const response = await fetch(`/api/signers/${signer.id}/addresses/${addressId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove address')
        return
      }

      // Remove from local state
      setAddresses(addresses.filter((addr) => addr.id !== addressId))
    } catch (err) {
      setError('An error occurred while removing the address')
    } finally {
      setRemovingAddressId(null)
    }
  }

  const handleAddAddress = async () => {
    if (!newAddress.trim()) {
      setError('Address is required')
      return
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress.trim())) {
      setError('Invalid address format. Must be a valid Ethereum address (0x followed by 40 hex characters)')
      return
    }

    // Check if address already exists in the list
    const normalizedNewAddress = newAddress.trim().toLowerCase()
    if (addresses.some((addr) => addr.address.toLowerCase() === normalizedNewAddress)) {
      setError('This address is already in the list')
      return
    }

    setError('')
    setLoading(true)

    try {
      // Auto-assign Account Type if not provided
      let finalType = newAddressType.trim()
      if (!finalType) {
        const nextAccountNum = getNextAccountNumber()
        finalType = `Account ${nextAccountNum}`
      }

      const response = await fetch(`/api/signers/${signer.id}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: normalizedNewAddress,
          type: finalType || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to add address')
        return
      }

      // Add to local state
      setAddresses([
        ...addresses,
        {
          id: data.id,
          address: data.address,
          name: data.name || '',
          type: data.type || finalType,
        },
      ])

      // Reset form
      setNewAddress('')
      setNewAddressType('')
    } catch (err) {
      setError('An error occurred while adding the address')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)

    try {
      // Update signer info
      const signerResponse = await fetch(`/api/signers/${signer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          department: department.trim() || undefined,
        }),
      })

      const signerData = await signerResponse.json()

      if (!signerResponse.ok) {
        setError(signerData.error || 'Failed to update signer')
        return
      }

      // Update existing addresses
      const addressUpdates = addresses.map((addr) =>
        fetch(`/api/signers/${signer.id}/addresses/${addr.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: addr.name.trim() || undefined,
            type: addr.type.trim() || undefined,
          }),
        })
      )

      const addressResults = await Promise.all(addressUpdates)
      const addressErrors = addressResults.filter((r) => !r.ok)

      if (addressErrors.length > 0) {
        const errorData = await addressErrors[0].json()
        setError(errorData.error || 'Failed to update some addresses')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl my-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black">Edit Signer</h2>
          <p className="mt-2 text-sm text-black">
            Manage signer information and associated wallet addresses.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Section 1: Signer Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-black mb-4">🔹 Signer Information</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-black">
                    Signer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-black">
                    Role / Department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Co-Founder, Engineering, Operations, etc."
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Associated Wallet Addresses */}
            <div>
              <h3 className="text-lg font-semibold text-black mb-4">🔹 Associated Wallet Addresses</h3>
              
              {/* Existing Addresses Table */}
              {addresses.length > 0 ? (
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                          Wallet Address
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {addresses.map((addr, index) => (
                        <tr key={addr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-mono text-sm text-black">{addr.address}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              value={addr.type}
                              onChange={(e) => handleAddressChange(index, 'type', e.target.value)}
                              placeholder="Account 1, Ledger, Hot Wallet, etc."
                              className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRemoveAddress(addr.id)}
                              disabled={removingAddressId === addr.id}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              title="Remove address"
                            >
                              {removingAddressId === addr.id ? 'Removing...' : '❌ Remove'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-sm text-gray-600">No addresses associated with this signer yet.</p>
                </div>
              )}

              {/* Add New Address Form */}
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <h4 className="text-sm font-semibold text-black mb-3">➕ Add New Associated Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor="newAddress" className="block text-xs font-medium text-black mb-1">
                      Wallet Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="newAddress"
                      type="text"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="0x..."
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="newAddressType" className="block text-xs font-medium text-black mb-1">
                      Type / Label <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <input
                      id="newAddressType"
                      type="text"
                      value={newAddressType}
                      onChange={(e) => setNewAddressType(e.target.value)}
                      placeholder="Ledger, Hot Wallet, etc."
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty to auto-assign: Account {getNextAccountNumber()}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleAddAddress}
                    disabled={loading || !newAddress.trim()}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Address'}
                  </button>
                </div>
              </div>
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
              {loading ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AddressDisplay from '@/components/AddressDisplay'
import LoginModal from '@/components/LoginModal'
import AddUserModal from '@/components/AddUserModal'
import { extractNameAndType } from '@/lib/utils'

interface SignerRow {
  id: string
  address: string
  signerId: string
  signerName: string
  department: string | null
  walletCount: number
  addressName: string | null
  addressType: string | null
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
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

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
      } else if (response.status === 401) {
        // 401 is expected for unauthenticated users - not an error
        setIsAdmin(false)
      }
    } catch (error) {
      // Only log unexpected errors
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load session:', error)
      }
      setIsAdmin(false)
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

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  // Memoize processed rows to avoid recalculating on every render
  const processedRows = useMemo(() => {
    // Group addresses by signer to assign Account1, Account2, etc.
    const signerGroups = new Map<string, SignerRow[]>()
    filteredSigners.forEach(row => {
      if (!signerGroups.has(row.signerId)) {
        signerGroups.set(row.signerId, [])
      }
      signerGroups.get(row.signerId)!.push(row)
    })
    
    // Process each group to assign Account numbers
    // Track used name+type combinations to ensure uniqueness
    const usedCombinations = new Set<string>()
    const processed: Array<SignerRow & { displayName: string; displayType: string }> = []
    
    signerGroups.forEach((rows, signerId) => {
      // Sort rows by address for consistent ordering
      const sortedRows = [...rows].sort((a, b) => a.address.localeCompare(b.address))
      
      // Separate rows into two groups:
      // 1. Rows that need Account numbering (no explicit type)
      // 2. Rows with explicit types
      const rowsNeedingAccountNumbers: SignerRow[] = []
      const rowsWithTypes: Array<{ row: SignerRow; displayName: string; displayType: string }> = []
      
      // First pass: categorize rows
      sortedRows.forEach((row) => {
        // First, check if signer name itself contains type indicators (e.g., "Dheeraj account 1")
        const signerNameExtracted = extractNameAndType(row.signerName)
        const baseSignerName = signerNameExtracted.name || row.signerName
        
        let displayName = baseSignerName
        let displayType: string | null = null
        
        // If address has explicit name, extract name and type from it
        if (row.addressName) {
          const { name, type } = extractNameAndType(row.addressName)
          displayName = name && name.length > 0 ? name : baseSignerName
          displayType = type || row.addressType
        } else if (row.addressType) {
          // Only explicit type, no address name - use base signer name
          displayName = baseSignerName
          displayType = row.addressType
        } else if (signerNameExtracted.type && !signerNameExtracted.type.startsWith('Account ')) {
          // Signer name contains type (but NOT Account number), use base name and extracted type
          // If signer name has "Account 1", ignore it - we'll assign Account numbers sequentially
          displayName = baseSignerName
          displayType = signerNameExtracted.type
        }
        
        // Only use the type if it's not an Account number (Account numbers should be assigned sequentially)
        if (displayType && !displayType.startsWith('Account ')) {
          rowsWithTypes.push({ row, displayName, displayType })
        } else {
          rowsNeedingAccountNumbers.push(row)
        }
      })
      
      // Second pass: assign Account numbers sequentially (1, 2, 3, 4...)
      let accountCounter = 0
      
      // Process rows with explicit types first
      rowsWithTypes.forEach(({ row, displayName, displayType }) => {
        const combinationKey = `${displayName.toLowerCase()}|${displayType.toLowerCase()}`
        let finalDisplayType = displayType
        
        // Check for uniqueness conflict
        if (usedCombinations.has(combinationKey)) {
          // Conflict detected - append Account number to make it unique
          accountCounter++
          finalDisplayType = `${displayType} Account ${accountCounter}`
        }
        
        const finalKey = `${displayName.toLowerCase()}|${finalDisplayType.toLowerCase()}`
        usedCombinations.add(finalKey)
        
        processed.push({
          ...row,
          displayName: displayName || '-',
          displayType: finalDisplayType || '-',
        })
      })
      
      // Process rows needing Account numbers - assign sequentially
      rowsNeedingAccountNumbers.forEach((row) => {
        const signerNameExtracted = extractNameAndType(row.signerName)
        const baseSignerName = signerNameExtracted.name || row.signerName
        
        accountCounter++
        const displayName = baseSignerName
        const displayType = `Account ${accountCounter}`
        
        const combinationKey = `${displayName.toLowerCase()}|${displayType.toLowerCase()}`
        
        // If somehow there's still a conflict (shouldn't happen for sequential), increment
        let finalDisplayType = displayType
        let conflictCounter = 0
        while (usedCombinations.has(combinationKey)) {
          conflictCounter++
          finalDisplayType = `Account ${accountCounter + conflictCounter}`
          const newKey = `${displayName.toLowerCase()}|${finalDisplayType.toLowerCase()}`
          if (!usedCombinations.has(newKey)) {
            break
          }
        }
        
        const finalKey = `${displayName.toLowerCase()}|${finalDisplayType.toLowerCase()}`
        usedCombinations.add(finalKey)
        
        processed.push({
          ...row,
          displayName: displayName || '-',
          displayType: finalDisplayType || '-',
        })
      })
    })
    
    // Sort by Name column lexicographically
    processed.sort((a, b) => {
      const nameA = a.displayName.toLowerCase()
      const nameB = b.displayName.toLowerCase()
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB)
      }
      // If names are equal, sort by type
      return (a.displayType || '').localeCompare(b.displayType || '')
    })
    
    return processed
  }, [filteredSigners])

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
        {isAdmin && (
          <button
            onClick={handleAddUser}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add User
          </button>
        )}
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
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-black">
                  Department
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {processedRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      <AddressDisplay
                        address={row.address}
                        name={null}
                        signerId={row.signerId}
                        linkToSigner={true}
                        showFull={false}
                      />
                      <button
                        onClick={() => copyAddress(row.address)}
                        className="rounded-md bg-gray-100 px-2 py-1 text-xs text-black hover:bg-gray-200"
                        title="Copy address"
                      >
                        {copiedAddress === row.address ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/signers/${row.signerId}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {row.displayName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                    {row.displayType}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-black">
                    {row.department || '-'}
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

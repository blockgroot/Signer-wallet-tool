'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  return (
    <div className="flex space-x-8">
      <Link
        href="/wallets"
        className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
          pathname?.startsWith('/wallets')
            ? 'border-indigo-500 text-gray-900'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        Multisig Wallets
      </Link>
      <Link
        href="/signers"
        className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
          pathname?.startsWith('/signers')
            ? 'border-indigo-500 text-gray-900'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        Signers
      </Link>
    </div>
  )
}

'use client'

import Link from 'next/link'

interface AddressDisplayProps {
  address: string
  name?: string | null
  signerId?: string | null
  showFull?: boolean
  linkToSigner?: boolean
  className?: string
}

export default function AddressDisplay({
  address,
  name,
  signerId,
  showFull = false,
  linkToSigner = true,
  className = '',
}: AddressDisplayProps) {
  const displayAddress = showFull
    ? address
    : `${address.slice(0, 6)}...${address.slice(-4)}`

  const addressElement = (
    <span className={`font-mono text-sm text-black ${className}`}>{displayAddress}</span>
  )

  const nameElement = name ? (
    <span className="ml-2 text-sm text-black">— {name}</span>
  ) : null

  if (linkToSigner && signerId) {
    return (
      <div className="flex items-center">
        <Link
          href={`/signers/${signerId}`}
          className="font-mono text-sm text-blue-600 hover:text-blue-800"
        >
          {displayAddress}
        </Link>
        {nameElement}
      </div>
    )
  }

  return (
    <div className="flex items-center">
      {addressElement}
      {nameElement}
    </div>
  )
}

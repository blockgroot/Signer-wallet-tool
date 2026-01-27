'use client'

import { SUPPORTED_CHAINS } from '@/lib/chains'

interface NetworkToggleProps {
  selectedChainId: number | null
  onChainChange: (chainId: number | null) => void
}

export default function NetworkToggle({ selectedChainId, onChainChange }: NetworkToggleProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        onClick={() => onChainChange(null)}
        className={`rounded-md px-4 py-2 text-sm font-medium ${
          selectedChainId === null
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-black hover:bg-gray-50'
        }`}
      >
        All Networks
      </button>
      {SUPPORTED_CHAINS.map((chain) => (
        <button
          key={chain.id}
          onClick={() => onChainChange(chain.id)}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            selectedChainId === chain.id
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-black hover:bg-gray-50'
          }`}
        >
          {chain.name}
        </button>
      ))}
    </div>
  )
}

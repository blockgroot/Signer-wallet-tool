import { getChainName } from '@/lib/chains'

interface ChainBadgeProps {
  chainId: number
}

export default function ChainBadge({ chainId }: ChainBadgeProps) {
  const chainName = getChainName(chainId)
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
      {chainName}
    </span>
  )
}

'use client'

interface WalletTagProps {
  tag: string
  onRemove?: () => void
  className?: string
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Treasury: { bg: 'bg-blue-100', text: 'text-blue-800' },
  Ops: { bg: 'bg-green-100', text: 'text-green-800' },
  'High Security': { bg: 'bg-red-100', text: 'text-red-800' },
  Deprecated: { bg: 'bg-gray-100', text: 'text-gray-800' },
  Payroll: { bg: 'bg-purple-100', text: 'text-purple-800' },
  Investments: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
}

export default function WalletTag({ tag, onRemove, className = '' }: WalletTagProps) {
  const colors = TAG_COLORS[tag] || { bg: 'bg-gray-100', text: 'text-gray-800' }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      {tag}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black hover:bg-opacity-20"
          aria-label={`Remove ${tag} tag`}
        >
          ×
        </button>
      )}
    </span>
  )
}

'use client'

import { useState } from 'react'
import { HelpCircle, Loader2 } from 'lucide-react'

interface HintButtonProps {
  onClick: () => void
  disabled?: boolean
  isLoading?: boolean
}

export default function HintButton({ onClick, disabled, isLoading }: HintButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          flex items-center justify-center
          w-12 h-12 rounded-full
          bg-amber-500 hover:bg-amber-600
          disabled:bg-slate-300 disabled:cursor-not-allowed
          dark:disabled:bg-slate-600
          transition-colors duration-200
          shadow-lg hover:shadow-xl
          text-white font-bold text-2xl
        `}
        aria-label="Wskazówka"
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <HelpCircle className="w-7 h-7" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !isLoading && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-sm rounded-lg whitespace-nowrap z-50 shadow-lg">
          wskazówka
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'
import { GuessResult } from '@/lib/types'
import { generateShareText } from '@/lib/game-logic'

interface ShareButtonProps {
  guesses: GuessResult[]
  date: string
  won: boolean
}

export default function ShareButton({ guesses, date, won }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareText = generateShareText(guesses, date, won)

    // Próba użycia Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        })
        return
      } catch (error) {
        // Użytkownik anulował lub API niedostępne
        console.log('Share cancelled or not available')
      }
    }

    // Fallback: kopiuj do schowka
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback dla starszych przeglądarek
      const textarea = document.createElement('textarea')
      textarea.value = shareText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
        copied
          ? 'bg-correct text-white'
          : 'bg-ekstra-green hover:bg-ekstra-green/90 text-white'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-5 h-5" />
          Skopiowano!
        </>
      ) : (
        <>
          <Share2 className="w-5 h-5" />
          Udostępnij wynik
        </>
      )}
    </button>
  )
}

// Przycisk do kopiowania tekstu (mniejszy wariant)
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      title={copied ? 'Skopiowano!' : 'Kopiuj'}
    >
      {copied ? (
        <Check className="w-4 h-4 text-correct" />
      ) : (
        <Copy className="w-4 h-4 text-slate-400" />
      )}
    </button>
  )
}

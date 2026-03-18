'use client'

import { useState } from 'react'
import { GuessResult as GuessResultType } from '@/lib/types'
import { getFlagEmoji } from '@/lib/utils'
import { ChevronDown, ChevronUp, HelpCircle, Check, X, Info } from 'lucide-react'
import Image from 'next/image'

interface GuessResultProps {
  result: GuessResultType
  isLast: boolean
}

const ATTRIBUTE_DEFS = [
  {
    key: 'nationality' as const,
    label: 'Obywatelstwo',
    tooltip: 'Kraj/kraje, których paszport posiada zawodnik',
  },
  {
    key: 'career_status' as const,
    label: 'Status kariery',
    tooltip: 'Aktywny – gra zawodowo; Zakończona – zakończył karierę',
  },
  {
    key: 'position' as const,
    label: 'Pozycja',
    tooltip: 'Bramkarz / Obrońca / Pomocnik / Napastnik',
  },
  {
    key: 'position_detailed' as const,
    label: 'Dokładna rola',
    tooltip: 'Np. Lewy obrońca, Środkowy pomocnik, Napastnik środkowy',
  },
  {
    key: 'club_history' as const,
    label: 'Historia klubów',
    tooltip: 'Czy szukany zawodnik grał w którymkolwiek z klubów typowanego gracza',
  },
  {
    key: 'league_history' as const,
    label: 'Historia lig',
    tooltip: 'Czy szukany zawodnik grał w którychkolwiek z lig typowanego gracza',
  },
  {
    key: 'age' as const,
    label: 'Wiek',
    tooltip: 'Zielony = trafiony, żółty = różnica ≤3 lata, czerwony = dalej. Strzałka ↑↓ wskazuje kierunek.',
  },
]

export default function GuessResult({ result, isLast }: GuessResultProps) {
  const [expanded, setExpanded] = useState(isLast)
  const { guessedPlayer, hints, matchPercentage } = result

  const pctColor =
    matchPercentage >= 100
      ? 'bg-correct text-white'
      : matchPercentage >= 61
      ? 'bg-correct text-white'
      : matchPercentage >= 31
      ? 'bg-close text-black'
      : 'bg-wrong text-white'

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {/* Procent */}
        <div className={`w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-lg ${pctColor}`}>
          {matchPercentage}%
        </div>

        {/* Zdjęcie */}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-600 flex-shrink-0">
          {guessedPlayer.photo_url ? (
            <Image
              src={guessedPlayer.photo_url}
              alt={guessedPlayer.name}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
              {guessedPlayer.name.slice(0, 1)}
            </div>
          )}
        </div>

        {/* Imię i flaga */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {guessedPlayer.name}
            </span>
            <span className="text-base">{getFlagEmoji(guessedPlayer.nationality_code)}</span>
            {result.isHint && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                Podpowiedź
              </span>
            )}
          </div>
          {result.correct && (
            <span className="text-xs text-correct font-medium">Poprawna odpowiedź!</span>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Rozwinięte atrybuty */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
          {ATTRIBUTE_DEFS.map(attr => {
            const hint = hints[attr.key]
            return (
              <AttributeCell
                key={attr.key}
                label={attr.label}
                tooltip={attr.tooltip}
                hint={hint}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

interface AttributeCellProps {
  label: string
  tooltip: string
  hint: { status: string; value: string | number; direction?: 'higher' | 'lower' }
}

function AttributeCell({ label, tooltip, hint }: AttributeCellProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const isCorrect = hint.status === 'correct'
  const isClose = hint.status === 'close'

  const borderBg = isCorrect
    ? 'border-correct/30 bg-correct/10'
    : isClose
    ? 'border-close/30 bg-close/10'
    : 'border-wrong/30 bg-wrong/10'

  const directionArrow = hint.direction === 'higher' ? '↑' : hint.direction === 'lower' ? '↓' : null

  return (
    <div className={`relative rounded-lg p-2.5 border ${borderBg}`}>
      {/* Nagłówek atrybutu */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <button
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={e => e.stopPropagation()}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {isCorrect ? (
            <Check className="w-4 h-4 text-correct flex-shrink-0" />
          ) : isClose ? (
            <span className="text-close font-bold text-sm flex-shrink-0">~</span>
          ) : (
            <X className="w-4 h-4 text-wrong flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Wartość + strzałka kierunku */}
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
        {String(hint.value) || '–'}
        {directionArrow && (
          <span className={`font-bold ${isClose ? 'text-close' : 'text-wrong'}`}>
            {directionArrow}
          </span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg text-center">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
        </div>
      )}
    </div>
  )
}

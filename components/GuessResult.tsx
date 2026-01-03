'use client'

import { GuessResult as GuessResultType, HintStatus } from '@/lib/types'
import { getFlagEmoji } from '@/lib/utils'
import { ArrowUp, ArrowDown, HelpCircle } from 'lucide-react'
import Image from 'next/image'

interface GuessResultProps {
  result: GuessResultType
  index: number
}

export default function GuessResult({ result, index }: GuessResultProps) {
  const { guessedPlayer, hints } = result

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        {/* Zdjęcie i imię */}
        <div className="flex items-center gap-2 min-w-[140px] sm:min-w-[180px]">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-600 flex-shrink-0">
            {guessedPlayer.photo_url ? (
              <Image
                src={guessedPlayer.photo_url}
                alt={guessedPlayer.name}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                ?
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
            {guessedPlayer.name}
            {result.isHint && (
              <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
          </span>
        </div>

        {/* Podpowiedzi */}
        <div className="flex gap-1 sm:gap-1.5 flex-1 justify-end">
          {/* Narodowość */}
          <HintCell status={hints.nationality.status} title="Narodowość">
            <span className="text-base sm:text-lg">
              {getFlagEmoji(guessedPlayer.nationality_code)}
            </span>
          </HintCell>

          {/* Pozycja */}
          <HintCell status={hints.position.status} title="Pozycja">
            <span className="text-xs font-medium">
              {getPositionShort(guessedPlayer.position)}
            </span>
          </HintCell>

          {/* Klub */}
          <HintCell status={hints.club.status} title="Klub">
            <span className="text-xs font-medium truncate max-w-[40px] sm:max-w-[60px]">
              {guessedPlayer.club_short || guessedPlayer.club_name?.slice(0, 3) || '?'}
            </span>
          </HintCell>

          {/* Liga */}
          <HintCell status={hints.league.status} title="Liga">
            <span className="text-xs font-medium">
              {guessedPlayer.club_league === 'Ekstraklasa' ? 'EKL' : 'INN'}
            </span>
          </HintCell>

          {/* Wiek */}
          <HintCell status={hints.age.status} title="Wiek">
            <div className="flex items-center gap-0.5">
              <span className="text-xs font-medium">{hints.age.value}</span>
              {hints.age.direction && (
                hints.age.direction === 'higher' ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )
              )}
            </div>
          </HintCell>
        </div>
      </div>

      {/* Wspólne kluby */}
      {hints.commonClubs.length > 0 && (
        <div className="mt-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">Wspólne kluby:</span>{' '}
          {hints.commonClubs.join(', ')}
        </div>
      )}
    </div>
  )
}

// Komponent pojedynczej komórki podpowiedzi
interface HintCellProps {
  status: HintStatus
  title: string
  children: React.ReactNode
}

function HintCell({ status, title, children }: HintCellProps) {
  const bgColor = {
    correct: 'bg-correct text-white',
    close: 'bg-close text-black',
    wrong: 'bg-wrong text-white',
  }[status]

  return (
    <div
      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center ${bgColor} transition-all hover:scale-105`}
      title={title}
    >
      {children}
    </div>
  )
}

// Skróty pozycji
function getPositionShort(position: string): string {
  const shorts: Record<string, string> = {
    'Bramkarz': 'BR',
    'Obronca': 'OB',
    'Pomocnik': 'PO',
    'Napastnik': 'NA',
  }
  return shorts[position] || position.slice(0, 2).toUpperCase()
}

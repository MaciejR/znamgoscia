'use client'

import { useState, useEffect } from 'react'
import { Player } from '@/lib/types'
import { getFlagEmoji, formatMarketValue } from '@/lib/utils'
import { Trophy, User, MapPin, Calendar, DollarSign } from 'lucide-react'
import Image from 'next/image'

interface PlayerCardProps {
  player: Player
  won: boolean
  guessCount: number
}

export default function PlayerCard({ player, won, guessCount }: PlayerCardProps) {
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    // Opóźnienie przed odkryciem karty
    const timer = setTimeout(() => setIsRevealed(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Nagłówek wyniku */}
      <div
        className={`text-center mb-4 p-4 rounded-xl ${
          won
            ? 'bg-correct/10 text-correct'
            : 'bg-wrong/10 text-wrong'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {won ? (
            <Trophy className="w-6 h-6" />
          ) : (
            <span className="text-2xl">😔</span>
          )}
          <span className="text-xl font-bold">
            {won ? 'Brawo!' : 'Nie udało się'}
          </span>
        </div>
        <p className="text-sm opacity-80">
          {won
            ? `Zgadłeś w ${guessCount} ${guessCount === 1 ? 'próbie' : 'próbach'}!`
            : 'Spróbuj ponownie jutro'}
        </p>
      </div>

      {/* Karta zawodnika */}
      <div
        className={`flip-card ${isRevealed ? 'flipped' : ''}`}
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative transition-transform duration-700"
          style={{
            transformStyle: 'preserve-3d',
            transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)',
          }}
        >
          {/* Przód karty (dane zawodnika) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-700">
            {/* Zdjęcie */}
            <div className="relative h-48 sm:h-56 bg-gradient-to-b from-ekstra-green/20 to-ekstra-green/5">
              {player.photo_url ? (
                <Image
                  src={player.photo_url}
                  alt={player.name}
                  fill
                  className="object-contain object-bottom"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-24 h-24 text-slate-300 dark:text-slate-600" />
                </div>
              )}
            </div>

            {/* Dane */}
            <div className="p-4">
              {/* Imię i flaga */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {player.name}
                </h2>
                <span className="text-2xl">
                  {getFlagEmoji(player.nationality_code)}
                </span>
              </div>

              {/* Szczegóły */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem
                  icon={<MapPin className="w-4 h-4" />}
                  label="Pozycja"
                  value={player.position}
                />
                <InfoItem
                  icon={<Calendar className="w-4 h-4" />}
                  label="Wiek"
                  value={`${player.age} lat`}
                />
                <InfoItem
                  icon={
                    player.club_logo ? (
                      <Image
                        src={player.club_logo}
                        alt=""
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                    )
                  }
                  label="Klub"
                  value={player.club_name || 'Brak'}
                />
                <InfoItem
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Wartość"
                  value={formatMarketValue(player.market_value)}
                />
              </div>

              {/* Numer na koszulce */}
              {player.jersey_number && (
                <div className="mt-4 flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-ekstra-green text-white flex items-center justify-center text-xl font-bold">
                    {player.jersey_number}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface InfoItemProps {
  icon: React.ReactNode
  label: string
  value: string
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="text-slate-400 dark:text-slate-500 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {value}
        </div>
      </div>
    </div>
  )
}

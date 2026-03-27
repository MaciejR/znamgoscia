'use client'

import { useState, useEffect } from 'react'
import { Player } from '@/lib/types'
import { getFlagEmoji, formatMarketValue } from '@/lib/utils'
import { Trophy, User, MapPin, Calendar, DollarSign, Briefcase, Globe } from 'lucide-react'
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
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {won ? (
            <Trophy className="w-6 h-6" />
          ) : (
            <span className="text-2xl">🏳️</span>
          )}
          <span className="text-xl font-bold">
            {won ? 'Brawo!' : 'Jutro dasz radę!'}
          </span>
        </div>
        <p className="text-sm opacity-80">
          {won
            ? `Zgadłeś w ${guessCount} ${guessCount === 1 ? 'próbie' : 'próbach'}!`
            : 'Prawidłowa odpowiedź to:'}
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
            {/* Awatar */}
            <div className="relative h-48 sm:h-56 bg-gradient-to-b from-ekstra-green/20 to-ekstra-green/5 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-ekstra-green/20 dark:bg-ekstra-green/30 flex items-center justify-center">
                <span className="text-4xl font-bold text-ekstra-green">
                  {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
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

              {/* Klub z herbem */}
              {player.club_name && (
                <div className="flex items-center justify-center gap-3 mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  {player.club_logo ? (
                    <Image
                      src={player.club_logo}
                      alt={player.club_name}
                      width={40}
                      height={40}
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center text-slate-400">
                      <MapPin className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{player.club_name}</div>
                    {player.club_league && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{player.club_league}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Szczegóły */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem
                  icon={<MapPin className="w-4 h-4" />}
                  label="Pozycja"
                  value={player.position_detailed || player.position}
                />
                <InfoItem
                  icon={<Calendar className="w-4 h-4" />}
                  label="Wiek"
                  value={player.age ? `${player.age} lat` : '?'}
                />
                <InfoItem
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Wartość"
                  value={formatMarketValue(player.market_value)}
                />
                <InfoItem
                  icon={<Trophy className="w-4 h-4" />}
                  label="Status"
                  value={player.is_active ? 'Aktywny' : 'Zakończona'}
                />
              </div>

              {/* Kluby z kariery */}
              {player.career_clubs && player.career_clubs.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kluby</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.career_clubs.map(club => (
                      <span key={club} className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                        {club}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ligi z kariery */}
              {player.career_leagues && player.career_leagues.length > 0 && (
                <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ligi</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.career_leagues.map(league => (
                      <span key={league} className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                        {league}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

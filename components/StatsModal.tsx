'use client'

import { useEffect } from 'react'
import { X, Trophy, Flame, Target, BarChart3, User } from 'lucide-react'
import { UserStats } from '@/lib/types'
import { getWinPercentage } from '@/lib/game-logic'
import { useAuth } from '@/lib/auth-context'

interface StatsModalProps {
  stats: UserStats
  isOpen: boolean
  onClose: () => void
}

export default function StatsModal({ stats, isOpen, onClose }: StatsModalProps) {
  const { user, profile } = useAuth()

  // Zamknij modalem Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const winPercentage = getWinPercentage(stats)
  const maxDistribution = Math.max(...stats.guessDistribution, 1)

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-ekstra-green" />
              Statystyki
            </h2>
            {user && profile ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                {profile.display_name || profile.username}
              </p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Grasz jako gość
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Główne statystyki */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatItem
            value={stats.gamesPlayed}
            label="Rozegrane"
            icon={<Target className="w-4 h-4" />}
          />
          <StatItem
            value={`${winPercentage}%`}
            label="Wygrane"
            icon={<Trophy className="w-4 h-4" />}
          />
          <StatItem
            value={stats.currentStreak}
            label="Seria"
            icon={<Flame className="w-4 h-4" />}
          />
          <StatItem
            value={stats.maxStreak}
            label="Max seria"
            icon={<Flame className="w-4 h-4 text-orange-500" />}
          />
        </div>

        {/* Rozkład prób */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            Rozkład prób
          </h3>
          <div className="space-y-2">
            {stats.guessDistribution.map((count, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-4 text-sm text-slate-500 dark:text-slate-400">
                  {index + 1}
                </span>
                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-ekstra-green flex items-center justify-end px-2 transition-all"
                    style={{
                      width: `${Math.max((count / maxDistribution) * 100, count > 0 ? 10 : 0)}%`,
                    }}
                  >
                    {count > 0 && (
                      <span className="text-xs font-medium text-white">
                        {count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        {stats.gamesPlayed === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
            Zagraj swoją pierwszą grę, aby zobaczyć statystyki!
          </p>
        )}

        {/* Guest notice */}
        {!user && stats.gamesPlayed > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              💡 Zaloguj się, aby zapisywać swoje statystyki na wielu urządzeniach!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface StatItemProps {
  value: number | string
  label: string
  icon: React.ReactNode
}

function StatItem({ value, label, icon }: StatItemProps) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
    </div>
  )
}

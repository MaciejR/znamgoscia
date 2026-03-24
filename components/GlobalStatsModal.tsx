'use client'

import { useState, useEffect } from 'react'
import { useStats } from '@/lib/stats-context'
import { loadUserStats } from '@/lib/utils'
import { createDefaultStats } from '@/lib/game-logic'
import { UserStats } from '@/lib/types'
import StatsModal from './StatsModal'

/**
 * Globalny modal statystyk, renderowany w layoucie.
 * Ładuje stats z localStorage. Na stronie głównej Game.tsx nadpisuje
 * ten modal swoim (ze świeżymi danymi), więc ten renderuje się
 * tylko na podstronach (archiwum, jak-grac, itp.).
 */
export default function GlobalStatsModal() {
  const { isStatsOpen, closeStats } = useStats()
  const [stats, setStats] = useState<UserStats>(createDefaultStats())
  const [isGamePage, setIsGamePage] = useState(false)

  useEffect(() => {
    // Sprawdź czy jesteśmy na stronie z Game (tam Game renderuje własny modal)
    const hasGame = document.querySelector('[data-game-stats-modal]')
    setIsGamePage(!!hasGame)

    if (!hasGame) {
      const savedStats = loadUserStats() as UserStats | null
      if (savedStats) setStats(savedStats)
    }
  }, [isStatsOpen])

  // Na stronie z Game, ten modal się nie renderuje (Game ma swój)
  if (isGamePage) return null

  return (
    <StatsModal
      stats={stats}
      isOpen={isStatsOpen}
      onClose={closeStats}
    />
  )
}

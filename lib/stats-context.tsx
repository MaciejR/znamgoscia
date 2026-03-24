'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface StatsContextType {
  isStatsOpen: boolean
  openStats: () => void
  closeStats: () => void
}

const StatsContext = createContext<StatsContextType>({
  isStatsOpen: false,
  openStats: () => {},
  closeStats: () => {},
})

export function StatsProvider({ children }: { children: ReactNode }) {
  const [isStatsOpen, setIsStatsOpen] = useState(false)

  const openStats = useCallback(() => setIsStatsOpen(true), [])
  const closeStats = useCallback(() => setIsStatsOpen(false), [])

  return (
    <StatsContext.Provider value={{ isStatsOpen, openStats, closeStats }}>
      {children}
    </StatsContext.Provider>
  )
}

export function useStats() {
  return useContext(StatsContext)
}

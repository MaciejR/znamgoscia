'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Trophy, X, Loader2, Play } from 'lucide-react'
import Link from 'next/link'
import { Player } from '@/lib/types'
import { getFlagEmoji } from '@/lib/utils'
import Image from 'next/image'

interface DayData {
  date: string
  player?: Player
  played?: boolean
  won?: boolean
}

export default function ArchiwumPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [daysData, setDaysData] = useState<Map<string, DayData>>(new Map())
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  const todayString = today.toISOString().split('T')[0]

  // Generuj dni miesiąca
  const getDaysInMonth = () => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay() || 7 // Poniedziałek = 1

    const days: (number | null)[] = []

    // Puste dni na początku
    for (let i = 1; i < startingDay; i++) {
      days.push(null)
    }

    // Dni miesiąca
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  // Pobierz dane dla wybranego dnia
  const fetchDayData = async (date: string) => {
    if (daysData.has(date)) {
      setSelectedDay(daysData.get(date)!)
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
      return
    }

    setIsLoading(true)
    setSelectedDay({ date }) // Pokaż panel z loaderem od razu
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)

    try {
      const response = await fetch(`/api/daily?date=${date}`)
      const data = await response.json()

      const dayData: DayData = {
        date,
        player: data.player,
      }

      // Sprawdź localStorage czy grał w ten dzień
      const savedState = localStorage.getItem('ekstra-typ-game-state')
      if (savedState) {
        const state = JSON.parse(savedState)
        if (state.date === date && state.status !== 'playing') {
          dayData.played = true
          dayData.won = state.status === 'won'
        }
      }

      setDaysData(prev => new Map(prev).set(date, dayData))
      setSelectedDay(dayData)
    } catch (error) {
      console.error('Error fetching day data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Przejdź do poprzedniego/następnego miesiąca
  const changeMonth = (delta: number) => {
    setCurrentMonth(prev => {
      let newMonth = prev.month + delta
      let newYear = prev.year

      if (newMonth < 0) {
        newMonth = 11
        newYear--
      } else if (newMonth > 11) {
        newMonth = 0
        newYear++
      }

      return { year: newYear, month: newMonth }
    })
  }

  const days = getDaysInMonth()
  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
        Archiwum
      </h1>

      {/* Kalendarz */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
        {/* Nawigacja miesięcy */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {monthNames[currentMonth.month]} {currentMonth.year}
          </h2>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            disabled={
              currentMonth.year === today.getFullYear() &&
              currentMonth.month >= today.getMonth()
            }
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Nagłówki dni tygodnia */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Dni */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const date = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = date === todayString
            const isPast = date < todayString
            const dayData = daysData.get(date)

            return (
              <button
                key={date}
                onClick={() => isPast && fetchDayData(date)}
                disabled={!isPast}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                  isToday
                    ? 'bg-ekstra-green text-white font-bold'
                    : isPast
                    ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                } ${
                  dayData?.played
                    ? dayData.won
                      ? 'ring-2 ring-correct ring-inset'
                      : 'ring-2 ring-wrong ring-inset'
                    : ''
                }`}
              >
                {day}
                {dayData?.played && (
                  <span className="text-[10px]">
                    {dayData.won ? '✓' : '✗'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Wybrany dzień */}
      {selectedDay && (
        <div ref={detailRef} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {new Date(selectedDay.date).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-ekstra-green animate-spin" />
            </div>
          ) : selectedDay.player ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                {selectedDay.player.photo_url ? (
                  <Image
                    src={selectedDay.player.photo_url}
                    alt={selectedDay.player.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    ?
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedDay.player.name}
                  </span>
                  <span className="text-xl">
                    {getFlagEmoji(selectedDay.player.nationality_code)}
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedDay.player.club_name} • {selectedDay.player.position}
                </div>
                {selectedDay.played !== undefined && (
                  <div
                    className={`text-sm mt-1 ${
                      selectedDay.won ? 'text-correct' : 'text-wrong'
                    }`}
                  >
                    {selectedDay.won ? 'Wygrana!' : 'Przegrana'}
                  </div>
                )}
                <Link
                  href={`/cwiczenia/${selectedDay.date}`}
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-ekstra-green text-white text-sm rounded-lg hover:bg-ekstra-green/90 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Zagraj
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">
              Brak danych dla tego dnia
            </p>
          )}
        </div>
      )}

      {/* Link powrotny */}
      <div className="text-center mt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-ekstra-green text-white rounded-xl font-medium hover:bg-ekstra-green/90 transition-colors"
        >
          <Trophy className="w-5 h-5" />
          Zagraj dzisiaj!
        </Link>
      </div>
    </div>
  )
}

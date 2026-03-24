'use client'

import { useState, useEffect, useCallback } from 'react'
import { GameState, GuessResult, SearchResult, UserStats, Player } from '@/lib/types'
import {
  createNewGameState,
  checkGameEnd,
  createDefaultStats,
  updateStats,
} from '@/lib/game-logic'
import {
  getTodayDate,
  saveGameState,
  loadGameState,
  saveUserStats,
  loadUserStats,
  getSessionId,
} from '@/lib/utils'
import GuessInput from './GuessInput'
import GuessResultComponent from './GuessResult'
import PlayerCard from './PlayerCard'
import ShareButton from './ShareButton'
import StatsModal from './StatsModal'
import { useStats } from '@/lib/stats-context'
import { Loader2, RefreshCw, BarChart3 } from 'lucide-react'

interface GameProps {
  practiceDate?: string
}

export default function Game({ practiceDate }: GameProps = {}) {
  const isPractice = !!practiceDate
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [userStats, setUserStats] = useState<UserStats>(createDefaultStats())
  const [isLoading, setIsLoading] = useState(true)
  const [isGuessing, setIsGuessing] = useState(false)
  const [answerPlayer, setAnswerPlayer] = useState<Player | null>(null)
  const { isStatsOpen, closeStats } = useStats()
  const [error, setError] = useState<string | null>(null)
  const [isHintLoading, setIsHintLoading] = useState(false)
  const [avgGuesses, setAvgGuesses] = useState<number | null>(null)

  useEffect(() => {
    initGame()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceDate])

  const practiceStateKey = practiceDate ? `ekstra-typ-practice-${practiceDate}` : null

  const initGame = async () => {
    setIsLoading(true)
    setError(null)
    setAnswerPlayer(null)

    try {
      const date = practiceDate ?? getTodayDate()

      if (isPractice) {
        // Practice mode: load from separate key, don't load user stats
        const raw = typeof window !== 'undefined' ? localStorage.getItem(practiceStateKey!) : null
        const savedState = raw ? JSON.parse(raw) as GameState : null
        if (savedState && savedState.date === date) {
          setGameState(savedState)
          if (savedState.status === 'won') {
            const lastGuess = savedState.guesses[savedState.guesses.length - 1]
            if (lastGuess?.answer) setAnswerPlayer(lastGuess.answer)
          }
        } else {
          const newState = createNewGameState(date)
          setGameState(newState)
          localStorage.setItem(practiceStateKey!, JSON.stringify(newState))
        }
      } else {
        // Normal daily mode
        const savedState = loadGameState() as GameState | null
        const savedStats = loadUserStats() as UserStats | null
        if (savedStats) setUserStats(savedStats)

        if (savedState && savedState.date === date) {
          setGameState(savedState)
          if (savedState.status === 'won') {
            const lastGuess = savedState.guesses[savedState.guesses.length - 1]
            if (lastGuess?.answer) setAnswerPlayer(lastGuess.answer)
          }
        } else {
          const newState = createNewGameState(date)
          setGameState(newState)
          saveGameState(newState)
        }

        // Pobierz statystyki dzienne (średnia prób)
        try {
          const statsRes = await fetch(`/api/stats?date=${date}`)
          if (statsRes.ok) {
            const statsData = await statsRes.json()
            if (statsData.avgGuesses > 0) setAvgGuesses(statsData.avgGuesses)
          }
        } catch { /* ignoruj */ }
      }

      // Sprawdź czy zawodnik jest dostępny
      const response = await fetch(`/api/daily?date=${date}`)
      const data = await response.json()
      if (!data.playerExists) {
        setError('Zawodnik dla tego dnia nie jest dostępny.')
      }
    } catch (err) {
      console.error('Error initializing game:', err)
      setError('Wystąpił błąd podczas ładowania gry. Spróbuj odświeżyć stronę.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGuess = useCallback(async (player: SearchResult) => {
    if (!gameState || gameState.status !== 'playing' || isGuessing) return

    setIsGuessing(true)
    setError(null)

    try {
      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: gameState.date,
          guessedPlayerId: player.id,
        }),
      })

      if (!response.ok) throw new Error('Failed to check guess')

      const result: GuessResult = await response.json()
      const newGuesses = [...gameState.guesses, result]
      let newState: GameState = { ...gameState, guesses: newGuesses }
      newState = checkGameEnd(newState)

      setGameState(newState)
      if (isPractice) {
        localStorage.setItem(practiceStateKey!, JSON.stringify(newState))
      } else {
        saveGameState(newState)
      }

      if (newState.status === 'won') {
        if (result.answer) setAnswerPlayer(result.answer)

        if (!isPractice) {
          const newStats = updateStats(userStats, true, newGuesses.length)
          setUserStats(newStats)
          saveUserStats(newStats)

          try {
            await fetch('/api/stats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: gameState.date,
                guesses_count: newGuesses.length,
                won: true,
                session_id: getSessionId(),
              }),
            })
          } catch { /* ignoruj */ }
        }
      }
    } catch (err) {
      console.error('Error making guess:', err)
      setError('Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setIsGuessing(false)
    }
  }, [gameState, isGuessing, userStats])

  const handleHint = useCallback(async () => {
    if (!gameState || gameState.status !== 'playing' || isHintLoading) return

    setIsHintLoading(true)
    setError(null)

    try {
      const alreadyGuessedIds = gameState.guesses.map(g => g.guessedPlayer.id)

      const hintResponse = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: gameState.date, alreadyGuessedIds }),
      })

      if (!hintResponse.ok) throw new Error('Failed to get hint')

      const hintData = await hintResponse.json()
      if (!hintData.hint?.player?.id) throw new Error('Invalid hint response')

      const guessResponse = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: gameState.date,
          guessedPlayerId: hintData.hint.player.id,
        }),
      })

      if (!guessResponse.ok) throw new Error('Failed to check hint player')

      const result: GuessResult = await guessResponse.json()
      result.isHint = true

      const newGuesses = [...gameState.guesses, result]
      const newState: GameState = { ...gameState, guesses: newGuesses }
      setGameState(newState)
      if (isPractice) {
        localStorage.setItem(practiceStateKey!, JSON.stringify(newState))
      } else {
        saveGameState(newState)
      }
    } catch (err) {
      console.error('Error getting hint:', err)
      setError('Nie udało się pobrać podpowiedzi.')
    } finally {
      setIsHintLoading(false)
    }
  }, [gameState, isHintLoading])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-ekstra-green animate-spin" />
        <p className="mt-4 text-slate-500 dark:text-slate-400">Ładowanie gry...</p>
      </div>
    )
  }

  if (error && !gameState) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-red-500 text-center mb-4">{error}</p>
        <button
          onClick={initGame}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  if (!gameState) return null

  const isPlaying = gameState.status === 'playing'
  const guessCount = gameState.guesses.length

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-32">
      {/* Baner trybu ćwiczeniowego */}
      {isPractice && (
        <div className="mb-4 mt-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl text-sm text-amber-700 dark:text-amber-400 text-center">
          Tryb ćwiczeniowy — {new Date(practiceDate! + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}. Wyniki nie są zapisywane.
        </div>
      )}

      {/* Panel statystyk dziennych */}
      {!isPractice && (
        <div className="flex gap-3 mb-6 mt-2">
          <StatTile label="Twoje próby" value={guessCount} />
          <StatTile
            label="Śr. do wygranej"
            value={avgGuesses !== null ? avgGuesses.toFixed(1) : '—'}
          />
        </div>
      )}

      {/* Legenda (tylko przed pierwszą próbą) */}
      {isPlaying && guessCount === 0 && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-3">
            Wpisz nazwisko zawodnika, aby rozpocząć. Brak limitu prób.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-correct rounded" />
              Atrybut pasuje
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-wrong rounded" />
              Nie pasuje
            </span>
          </div>
        </div>
      )}

      {/* Lista prób */}
      {guessCount > 0 && (
        <div className="space-y-2 mb-6">
          {gameState.guesses.map((result, index) => (
            <GuessResultComponent
              key={index}
              result={result}
              isLast={index === guessCount - 1}
            />
          ))}
        </div>
      )}

      {/* Karta zawodnika + udostępnianie (po wygranej) */}
      {!isPlaying && answerPlayer && (
        <div className="mb-6">
          <PlayerCard
            player={answerPlayer}
            won={gameState.status === 'won'}
            guessCount={guessCount}
          />
        </div>
      )}

      {!isPlaying && (
        <div className="flex justify-center mb-6">
          <ShareButton
            guesses={gameState.guesses}
            date={gameState.date}
            won={gameState.status === 'won'}
          />
        </div>
      )}

      {/* Błąd */}
      {error && isPlaying && (
        <p className="text-sm text-red-500 text-center mb-4">{error}</p>
      )}

      {/* Statystyki użytkownika */}
      <div data-game-stats-modal />
      <StatsModal
        stats={userStats}
        isOpen={isStatsOpen}
        onClose={closeStats}
        todayGuesses={gameState.status === 'won' ? gameState.guesses.length : undefined}
      />

      {/* Stały pasek na dole */}
      {isPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-4 py-3 shadow-xl">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <div className="flex-1">
              <GuessInput onGuess={handleGuess} disabled={isGuessing} />
            </div>
            {/* Przycisk Podpowiedź */}
            <button
              onClick={handleHint}
              disabled={isGuessing || isHintLoading}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              {isHintLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
              Podpowiedź
            </button>
          </div>
          {isGuessing && (
            <div className="flex justify-center mt-2">
              <Loader2 className="w-5 h-5 text-ekstra-green animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-center">
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

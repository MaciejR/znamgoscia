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
import { useAuth } from '@/lib/auth-context'
import GuessInput from './GuessInput'
import GuessResultComponent from './GuessResult'
import PlayerCard from './PlayerCard'
import ShareButton from './ShareButton'
import StatsModal from './StatsModal'
import HintButton from './HintButton'
import { Loader2, RefreshCw } from 'lucide-react'

type HintField = 'nationality' | 'position' | 'club' | 'league' | 'age'

const MAX_GUESSES = 8

export default function Game() {
  const { user } = useAuth()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [userStats, setUserStats] = useState<UserStats>(createDefaultStats())
  const [isLoading, setIsLoading] = useState(true)
  const [isGuessing, setIsGuessing] = useState(false)
  const [answerPlayer, setAnswerPlayer] = useState<Player | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hint state
  const [isHintLoading, setIsHintLoading] = useState(false)

  // Inicjalizacja gry
  useEffect(() => {
    initGame()
  }, [user]) // Przeładuj gdy użytkownik się zaloguje/wyloguje

  // Nasłuchuj na przycisk statystyk w headerze
  useEffect(() => {
    const statsButton = document.getElementById('stats-button')
    if (statsButton) {
      const handler = () => setShowStats(true)
      statsButton.addEventListener('click', handler)
      return () => statsButton.removeEventListener('click', handler)
    }
  }, [])

  const initGame = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const today = getTodayDate()

      // Wczytaj zapisany stan gry
      const savedState = loadGameState() as GameState | null

      // Wczytaj statystyki - z serwera dla zalogowanych, z localStorage dla gości
      if (user) {
        try {
          const response = await fetch(`/api/user-stats?user_id=${user.id}`)
          if (response.ok) {
            const stats = await response.json()
            setUserStats(stats)
          } else {
            setUserStats(createDefaultStats())
          }
        } catch (err) {
          console.error('Error loading user stats:', err)
          setUserStats(createDefaultStats())
        }
      } else {
        const savedStats = loadUserStats() as UserStats | null
        if (savedStats) {
          setUserStats(savedStats)
        }
      }

      // Sprawdź czy mamy zapisaną grę z dzisiaj
      if (savedState && savedState.date === today) {
        setGameState(savedState)

        // Jeśli gra skończona, pobierz odpowiedź
        if (savedState.status !== 'playing' && savedState.guesses.length > 0) {
          const lastGuess = savedState.guesses[savedState.guesses.length - 1]
          if (lastGuess.answer) {
            setAnswerPlayer(lastGuess.answer)
          }
        }
      } else {
        // Nowy dzień - nowa gra
        const newState = createNewGameState(today)
        setGameState(newState)
        saveGameState(newState)
      }

      // Sprawdź czy zawodnik jest dostępny
      const response = await fetch(`/api/daily?date=${today}`)
      const data = await response.json()

      if (!data.playerExists) {
        setError('Dzisiejszy zawodnik nie został jeszcze wybrany. Spróbuj później!')
      }
    } catch (err) {
      console.error('Error initializing game:', err)
      setError('Wystąpił błąd podczas ładowania gry. Spróbuj odświeżyć stronę.')
    } finally {
      setIsLoading(false)
    }
  }

  // Obsługa strzału
  const handleGuess = useCallback(async (player: SearchResult) => {
    if (!gameState || gameState.status !== 'playing' || isGuessing) return

    setIsGuessing(true)
    setError(null)

    try {
      const isLastGuess = gameState.guesses.length + 1 >= MAX_GUESSES

      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: gameState.date,
          guessedPlayerId: player.id,
          isLastGuess,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to check guess')
      }

      const result: GuessResult = await response.json()

      // Aktualizuj stan gry
      const newGuesses = [...gameState.guesses, result]
      let newState: GameState = {
        ...gameState,
        guesses: newGuesses,
      }
      newState = checkGameEnd(newState)

      setGameState(newState)
      saveGameState(newState)

      // Jeśli gra skończona
      if (newState.status !== 'playing') {
        if (result.answer) {
          setAnswerPlayer(result.answer)
        }

        // Aktualizuj statystyki
        const newStats = updateStats(
          userStats,
          newState.status === 'won',
          newGuesses.length
        )
        setUserStats(newStats)
        saveUserStats(newStats)

        // Wyślij statystyki do serwera
        try {
          await fetch('/api/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: gameState.date,
              guesses_count: newGuesses.length,
              won: newState.status === 'won',
              session_id: user ? null : getSessionId(), // Użyj session_id tylko dla gości
              user_id: user?.id || null, // Dodaj user_id dla zalogowanych użytkowników
            }),
          })
        } catch {
          // Ignoruj błędy zapisu statystyk
        }
      }
    } catch (err) {
      console.error('Error making guess:', err)
      setError('Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setIsGuessing(false)
    }
  }, [gameState, isGuessing, userStats])

  // Oblicz które pola są już zgodne na podstawie strzałów
  const getMatchedFields = useCallback((): HintField[] => {
    if (!gameState) return []

    const matchedFields: Set<HintField> = new Set()

    for (const guess of gameState.guesses) {
      if (guess.hints.nationality.status === 'correct') {
        matchedFields.add('nationality')
      }
      if (guess.hints.position.status === 'correct') {
        matchedFields.add('position')
      }
      if (guess.hints.club.status === 'correct') {
        matchedFields.add('club')
      }
      if (guess.hints.league.status === 'correct') {
        matchedFields.add('league')
      }
      if (guess.hints.age.status === 'correct' || guess.hints.age.status === 'close') {
        matchedFields.add('age')
      }
    }

    return Array.from(matchedFields)
  }, [gameState])

  // Obsługa wskazówki
  const handleHint = useCallback(async () => {
    if (!gameState || gameState.status !== 'playing' || isHintLoading) return

    setIsHintLoading(true)
    setError(null)

    try {
      const matchedFields = getMatchedFields()

      // Pobierz wskazówkę
      const hintResponse = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: gameState.date,
          matchedFields,
        }),
      })

      if (!hintResponse.ok) {
        throw new Error('Failed to get hint')
      }

      const hintData = await hintResponse.json()

      if (hintData.noHintsAvailable) {
        setError('Brak dostępnych wskazówek - wszystkie kategorie już są zgodne.')
        return
      }

      if (!hintData.hint?.player?.id) {
        throw new Error('Invalid hint response')
      }

      // Wywołaj /api/guess z zawodnikiem ze wskazówki
      const guessResponse = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: gameState.date,
          guessedPlayerId: hintData.hint.player.id,
          isLastGuess: false,
        }),
      })

      if (!guessResponse.ok) {
        throw new Error('Failed to check hint player')
      }

      const result: GuessResult = await guessResponse.json()

      // Dodaj flagę isHint
      result.isHint = true

      // Dodaj do listy strzałów
      const newGuesses = [...gameState.guesses, result]
      const newState: GameState = {
        ...gameState,
        guesses: newGuesses,
      }

      setGameState(newState)
      saveGameState(newState)

    } catch (err) {
      console.error('Error getting hint:', err)
      setError('Nie udało się pobrać wskazówki.')
    } finally {
      setIsHintLoading(false)
    }
  }, [gameState, isHintLoading, getMatchedFields])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-ekstra-green animate-spin" />
        <p className="mt-4 text-slate-500 dark:text-slate-400">
          Ładowanie gry...
        </p>
      </div>
    )
  }

  // Error state
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
  const guessesLeft = MAX_GUESSES - gameState.guesses.length

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Nagłówek */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Zgadnij zawodnika
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {isPlaying
            ? `Pozostało prób: ${guessesLeft}`
            : gameState.status === 'won'
            ? 'Gratulacje!'
            : 'Może jutro się uda!'}
        </p>
      </div>

      {/* Input do zgadywania */}
      {isPlaying && (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <GuessInput onGuess={handleGuess} disabled={isGuessing} />
            </div>
            <HintButton
              onClick={handleHint}
              disabled={isGuessing || gameState.guesses.length === 0}
              isLoading={isHintLoading}
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
          )}
          {isGuessing && (
            <div className="mt-2 flex justify-center">
              <Loader2 className="w-5 h-5 text-ekstra-green animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      {isPlaying && gameState.guesses.length === 0 && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-3">
            Kolory oznaczają:
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-correct rounded" />
              Poprawnie
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-close rounded" />
              Blisko (±2 lata)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-wrong rounded" />
              Niepoprawnie
            </span>
          </div>
        </div>
      )}

      {/* Lista strzałów */}
      {gameState.guesses.length > 0 && (
        <div className="space-y-2 mb-6">
          {/* Nagłówki kolumn */}
          <div className="flex items-center gap-2 px-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="min-w-[140px] sm:min-w-[180px]">Zawodnik</div>
            <div className="flex gap-1 sm:gap-1.5 flex-1 justify-end">
              <div className="w-10 sm:w-12 text-center">Kraj</div>
              <div className="w-10 sm:w-12 text-center">Poz.</div>
              <div className="w-10 sm:w-12 text-center">Klub</div>
              <div className="w-10 sm:w-12 text-center">Liga</div>
              <div className="w-10 sm:w-12 text-center">Wiek</div>
            </div>
          </div>

          {/* Wyniki */}
          {gameState.guesses.map((result, index) => (
            <GuessResultComponent key={index} result={result} index={index} />
          ))}
        </div>
      )}

      {/* Karta zawodnika (po zakończeniu gry) */}
      {!isPlaying && answerPlayer && (
        <div className="mb-6">
          <PlayerCard
            player={answerPlayer}
            won={gameState.status === 'won'}
            guessCount={gameState.guesses.length}
          />
        </div>
      )}

      {/* Przycisk udostępniania */}
      {!isPlaying && (
        <div className="flex justify-center">
          <ShareButton
            guesses={gameState.guesses}
            date={gameState.date}
            won={gameState.status === 'won'}
          />
        </div>
      )}

      {/* Modal statystyk */}
      <StatsModal
        stats={userStats}
        isOpen={showStats}
        onClose={() => setShowStats(false)}
      />

    </div>
  )
}

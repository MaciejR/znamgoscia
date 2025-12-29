import { Player, CareerEntry, GuessResult, HintStatus, Hint, GameState, UserStats } from './types'
import { getTodayDate } from './utils'

const MAX_GUESSES = 8
const AGE_CLOSE_THRESHOLD = 2 // ±2 lata

// Porównaj strzał z odpowiedzią
export function compareGuess(
  guess: Player,
  answer: Player,
  guessCareer: CareerEntry[],
  answerCareer: CareerEntry[]
): GuessResult {
  const isCorrect = guess.id === answer.id

  return {
    correct: isCorrect,
    guessedPlayer: guess,
    hints: {
      nationality: compareField(guess.nationality, answer.nationality),
      position: compareField(guess.position, answer.position),
      club: compareField(guess.club_name || '', answer.club_name || ''),
      league: compareField(guess.club_league || '', answer.club_league || ''),
      age: compareAge(guess.age, answer.age),
      commonClubs: findCommonClubs(guessCareer, answerCareer),
    },
    answer: isCorrect ? answer : undefined,
  }
}

// Porównaj pole tekstowe
function compareField(guessValue: string, answerValue: string): Hint {
  const isCorrect = guessValue.toLowerCase() === answerValue.toLowerCase()
  return {
    status: isCorrect ? 'correct' : 'wrong',
    value: guessValue,
  }
}

// Porównaj wiek
function compareAge(guessAge: number | null, answerAge: number | null): Hint {
  if (guessAge === null || answerAge === null) {
    return { status: 'wrong', value: guessAge || 0 }
  }

  const diff = guessAge - answerAge

  if (diff === 0) {
    return { status: 'correct', value: guessAge }
  }

  if (Math.abs(diff) <= AGE_CLOSE_THRESHOLD) {
    return {
      status: 'close',
      value: guessAge,
      direction: diff > 0 ? 'lower' : 'higher',
    }
  }

  return {
    status: 'wrong',
    value: guessAge,
    direction: diff > 0 ? 'lower' : 'higher',
  }
}

// Znajdź wspólne kluby w historii kariery
export function findCommonClubs(
  guessCareer: CareerEntry[],
  answerCareer: CareerEntry[]
): string[] {
  const guessClubs = new Set(guessCareer.map(c => c.club_name.toLowerCase()))
  const answerClubs = new Set(answerCareer.map(c => c.club_name.toLowerCase()))

  const common: string[] = []
  for (const club of guessClubs) {
    if (answerClubs.has(club)) {
      // Znajdź oryginalną nazwę (z dużymi literami)
      const original = guessCareer.find(c => c.club_name.toLowerCase() === club)
      if (original) {
        common.push(original.club_name)
      }
    }
  }

  return common
}

// Generuj tekst do udostępnienia
export function generateShareText(guesses: GuessResult[], date: string, won: boolean): string {
  const header = `Ekstra Typ - ${formatShareDate(date)}`

  const grid = guesses.map(guess => {
    const row = [
      getEmoji(guess.hints.nationality.status),
      getEmoji(guess.hints.position.status),
      getEmoji(guess.hints.club.status),
      getEmoji(guess.hints.league.status),
      getEmoji(guess.hints.age.status),
    ].join('')
    return row
  }).join('\n')

  const result = won
    ? `Zgadlem w ${guesses.length}/${MAX_GUESSES} prob!`
    : `Nie udalo sie w ${MAX_GUESSES} probach`

  return `${header}\n\n${grid}\n\n${result}\nhttps://ekstra-typ.pl`
}

function formatShareDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function getEmoji(status: HintStatus): string {
  switch (status) {
    case 'correct': return '🟩'
    case 'close': return '🟨'
    case 'wrong': return '🟥'
  }
}

// Oblicz wynik punktowy
export function calculateScore(guessCount: number, won: boolean): number {
  if (!won) return 0
  return Math.max(0, (MAX_GUESSES - guessCount + 1) * 100)
}

// Inicjalizuj nowy stan gry
export function createNewGameState(date?: string): GameState {
  return {
    date: date || getTodayDate(),
    guesses: [],
    status: 'playing',
    maxGuesses: MAX_GUESSES,
  }
}

// Sprawdź czy gra się skończyła
export function checkGameEnd(state: GameState): GameState {
  if (state.status !== 'playing') return state

  const lastGuess = state.guesses[state.guesses.length - 1]

  if (lastGuess?.correct) {
    return { ...state, status: 'won' }
  }

  if (state.guesses.length >= MAX_GUESSES) {
    return { ...state, status: 'lost' }
  }

  return state
}

// Domyślne statystyki użytkownika
export function createDefaultStats(): UserStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: new Array(MAX_GUESSES).fill(0),
  }
}

// Aktualizuj statystyki po grze
export function updateStats(
  currentStats: UserStats,
  won: boolean,
  guessCount: number
): UserStats {
  const newStats = { ...currentStats }

  newStats.gamesPlayed += 1

  if (won) {
    newStats.gamesWon += 1
    newStats.currentStreak += 1
    newStats.maxStreak = Math.max(newStats.maxStreak, newStats.currentStreak)

    // Aktualizuj rozkład (index = guessCount - 1)
    if (guessCount >= 1 && guessCount <= MAX_GUESSES) {
      newStats.guessDistribution = [...newStats.guessDistribution]
      newStats.guessDistribution[guessCount - 1] += 1
    }
  } else {
    newStats.currentStreak = 0
  }

  return newStats
}

// Oblicz procent wygranych
export function getWinPercentage(stats: UserStats): number {
  if (stats.gamesPlayed === 0) return 0
  return Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
}

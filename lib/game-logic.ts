import { Player, CareerEntry, GuessResult, HintStatus, Hint, GameState, UserStats } from './types'
import { getTodayDate } from './utils'

// Porównaj strzał z odpowiedzią – 6 atrybutów wg spec
export function compareGuess(
  guess: Player,
  answer: Player,
  guessCareer: CareerEntry[],
  answerCareer: CareerEntry[]
): GuessResult {
  const isCorrect = guess.id === answer.id

  const nationalityHint = compareField(guess.nationality, answer.nationality)
  const careerStatusHint = compareField(
    guess.is_active ? 'Aktywny' : 'Zakończona',
    answer.is_active ? 'Aktywny' : 'Zakończona'
  )
  const positionHint = compareField(guess.position, answer.position)
  const positionDetailedHint = compareField(
    guess.position_detailed || '',
    answer.position_detailed || ''
  )
  const clubHistoryHint = compareHistoryClubs(guessCareer, answerCareer)
  const leagueHistoryHint = compareHistoryLeagues(guessCareer, answerCareer)

  const allHints = [nationalityHint, careerStatusHint, positionHint, positionDetailedHint, clubHistoryHint, leagueHistoryHint]
  const matchCount = allHints.filter(h => h.status === 'correct').length
  const matchPercentage = isCorrect ? 100 : Math.round((matchCount / 6) * 100)

  return {
    correct: isCorrect,
    guessedPlayer: guess,
    matchPercentage,
    hints: {
      nationality: nationalityHint,
      career_status: careerStatusHint,
      position: positionHint,
      position_detailed: positionDetailedHint,
      club_history: clubHistoryHint,
      league_history: leagueHistoryHint,
    },
    answer: isCorrect ? answer : undefined,
  }
}

// Porównaj pole tekstowe
function compareField(guessValue: string, answerValue: string): Hint {
  if (!guessValue && !answerValue) {
    return { status: 'correct', value: '-' }
  }
  const isCorrect = guessValue.toLowerCase() === answerValue.toLowerCase()
  return {
    status: isCorrect ? 'correct' : 'wrong',
    value: guessValue || '-',
  }
}

// Sprawdź czy answer grał w którymś klubie z kariery guess
function compareHistoryClubs(guessCareer: CareerEntry[], answerCareer: CareerEntry[]): Hint {
  const guessClubs = new Set(guessCareer.map(c => c.club_name?.toLowerCase()).filter((c): c is string => Boolean(c)))
  const answerClubs = new Set(answerCareer.map(c => c.club_name?.toLowerCase()).filter((c): c is string => Boolean(c)))
  const hasCommon = guessClubs.size > 0 && answerClubs.size > 0 && Array.from(guessClubs).some(club => answerClubs.has(club))
  return {
    status: hasCommon ? 'correct' : 'wrong',
    value: hasCommon ? 'Tak' : 'Nie',
  }
}

// Sprawdź czy answer grał w której ś lidze z kariery guess
function compareHistoryLeagues(guessCareer: CareerEntry[], answerCareer: CareerEntry[]): Hint {
  const guessLeagues = new Set(
    guessCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )
  const answerLeagues = new Set(
    answerCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )
  const hasCommon = guessLeagues.size > 0 && answerLeagues.size > 0
    && Array.from(guessLeagues).some(league => answerLeagues.has(league))
  return {
    status: hasCommon ? 'correct' : 'wrong',
    value: hasCommon ? 'Tak' : 'Nie',
  }
}

// Oblicz wynik dopasowania zawodnika (do wyboru podpowiedzi)
export function scorePlayerMatch(
  candidate: Player,
  answer: Player,
  candidateCareer: CareerEntry[],
  answerCareer: CareerEntry[]
): number {
  let score = 0
  if (candidate.nationality === answer.nationality) score++
  if (candidate.is_active === answer.is_active) score++
  if (candidate.position === answer.position) score++
  if (candidate.position_detailed && answer.position_detailed &&
      candidate.position_detailed === answer.position_detailed) score++

  const candidateClubs = new Set(candidateCareer.map(c => c.club_name?.toLowerCase()).filter((c): c is string => Boolean(c)))
  const answerClubs = new Set(answerCareer.map(c => c.club_name?.toLowerCase()).filter((c): c is string => Boolean(c)))
  if (candidateClubs.size > 0 && answerClubs.size > 0 && Array.from(candidateClubs).some(c => answerClubs.has(c))) score++

  const candidateLeagues = new Set(
    candidateCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )
  const answerLeagues = new Set(
    answerCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )
  if (candidateLeagues.size > 0 && Array.from(candidateLeagues).some(l => answerLeagues.has(l))) score++

  return score
}

// Generuj tekst do udostępnienia (wg spec)
export function generateShareText(guesses: GuessResult[], date: string, won: boolean): string {
  // Numer zagadki (dni od 2025-01-01)
  const start = new Date('2025-01-01')
  const current = new Date(date)
  const puzzleNumber = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const grid = guesses.map((guess, i) => {
    if (i === guesses.length - 1 && guess.correct) return '✅'
    const pct = guess.matchPercentage
    if (pct >= 61) return '🟩'
    if (pct >= 31) return '🟨'
    return '🟥'
  }).join('')

  const result = won
    ? `Zgadłem w ${guesses.length} ${guesses.length === 1 ? 'próbie' : 'próbach'}!`
    : `Nie udało się odgadnąć...`

  return `🇵🇱 Polska Liga Guess #${puzzleNumber}\n${grid}\n${result}\nekstraklasaguess.pl`
}

// Inicjalizuj nowy stan gry
export function createNewGameState(date?: string): GameState {
  return {
    date: date || getTodayDate(),
    guesses: [],
    status: 'playing',
  }
}

// Sprawdź czy gra się skończyła
export function checkGameEnd(state: GameState): GameState {
  if (state.status !== 'playing') return state
  const lastGuess = state.guesses[state.guesses.length - 1]
  if (lastGuess?.correct) {
    return { ...state, status: 'won' }
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
    guessDistribution: new Array(10).fill(0),
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
    const idx = Math.min(guessCount - 1, newStats.guessDistribution.length - 1)
    if (idx >= 0) {
      newStats.guessDistribution = [...newStats.guessDistribution]
      newStats.guessDistribution[idx] += 1
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

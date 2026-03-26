import { Player, CareerEntry, GuessResult, HintStatus, Hint, GameState, UserStats } from './types'
import { getTodayDate } from './utils'

// Porównaj strzał z odpowiedzią – 7 atrybutów
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
  const ageHint = compareAge(guess.age, answer.age)

  const allHints = [nationalityHint, careerStatusHint, positionHint, positionDetailedHint, clubHistoryHint, leagueHistoryHint, ageHint]
  const matchCount = allHints.filter(h => h.status === 'correct').length
  const matchPercentage = isCorrect ? 100 : Math.round((matchCount / 7) * 100)

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
      age: ageHint,
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

// Porównaj wiek: exact=correct, różnica ≤3=close z kierunkiem, >3=wrong
function compareAge(guessAge: number | null, answerAge: number | null): Hint {
  if (guessAge == null || answerAge == null) {
    return { status: 'wrong', value: guessAge != null ? String(guessAge) : '?' }
  }
  const diff = guessAge - answerAge
  if (diff === 0) {
    return { status: 'correct', value: guessAge }
  }
  if (Math.abs(diff) <= 3) {
    return {
      status: 'close',
      value: guessAge,
      direction: diff > 0 ? 'lower' : 'higher', // answer is lower/higher than guess
    }
  }
  return {
    status: 'wrong',
    value: guessAge,
    direction: diff > 0 ? 'lower' : 'higher',
  }
}

// Normalizuj nazwę klubu: usuń prefiksy (FC, AC, ACF, etc.), lowercase
function normalizeClubName(name: string): string {
  return name.toLowerCase()
    .replace(/^(fc |ac |acf |afc |sc |fk |sk |rks |mks |ks |gks |ts |wks |bks |oks |lks |zks |nk )/i, '')
    .replace(/ (fc|sc|fk|sk)$/i, '')
    .trim()
}

// Sprawdź czy answer grał w którymś klubie z kariery guess
function compareHistoryClubs(guessCareer: CareerEntry[], answerCareer: CareerEntry[]): Hint {
  // Mapa: znormalizowana nazwa -> oryginalna nazwa (z guess)
  const guessClubsMap = new Map<string, string>()
  for (const c of guessCareer) {
    if (c.club_name) guessClubsMap.set(normalizeClubName(c.club_name), c.club_name)
  }
  // Set znormalizowanych nazw z answer
  const answerClubsNorm = new Set(
    answerCareer.map(c => c.club_name ? normalizeClubName(c.club_name) : null).filter((c): c is string => Boolean(c))
  )

  const commonClubs: string[] = []
  const seen = new Set<string>()
  guessClubsMap.forEach((original, norm) => {
    if (answerClubsNorm.has(norm) && !seen.has(norm)) {
      seen.add(norm)
      commonClubs.push(original)
    }
  })

  return {
    status: commonClubs.length > 0 ? 'correct' : 'wrong',
    value: commonClubs.length > 0 ? commonClubs.join(', ') : 'Nie',
  }
}

// Sprawdź czy answer grał w której ś lidze z kariery guess
function compareHistoryLeagues(guessCareer: CareerEntry[], answerCareer: CareerEntry[]): Hint {
  const guessLeaguesMap = new Map<string, string>()
  for (const c of guessCareer) {
    if (c.league) guessLeaguesMap.set(c.league.toLowerCase(), c.league)
  }
  const answerLeagues = new Set(
    answerCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )

  const commonLeagues: string[] = []
  const seen = new Set<string>()
  guessLeaguesMap.forEach((original, lower) => {
    if (answerLeagues.has(lower) && !seen.has(lower)) {
      seen.add(lower)
      commonLeagues.push(original)
    }
  })

  return {
    status: commonLeagues.length > 0 ? 'correct' : 'wrong',
    value: commonLeagues.length > 0 ? commonLeagues.join(', ') : 'Nie',
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

  const candidateClubs = new Set(candidateCareer.map(c => c.club_name ? normalizeClubName(c.club_name) : null).filter((c): c is string => Boolean(c)))
  const answerClubs = new Set(answerCareer.map(c => c.club_name ? normalizeClubName(c.club_name) : null).filter((c): c is string => Boolean(c)))
  if (candidateClubs.size > 0 && answerClubs.size > 0 && Array.from(candidateClubs).some(c => answerClubs.has(c))) score++

  const candidateLeagues = new Set(
    candidateCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )
  const answerLeagues = new Set(
    answerCareer.map(c => c.league?.toLowerCase()).filter((l): l is string => Boolean(l))
  )
  if (candidateLeagues.size > 0 && Array.from(candidateLeagues).some(l => answerLeagues.has(l))) score++

  if (candidate.age != null && answer.age != null && Math.abs(candidate.age - answer.age) <= 3) score++

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

  return `🇵🇱 Znam Gościa #${puzzleNumber}\n${grid}\n${result}\nekstraklasaguess.pl`
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

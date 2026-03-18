// Klub
export interface Club {
  id: number
  name: string
  name_short: string | null
  league: string
  country: string
  logo_url: string | null
  transfermarkt_id: string | null
}

// Zawodnik
export interface Player {
  id: number
  name: string
  name_normalized: string
  birth_date: string | null
  age: number | null
  nationality: string
  nationality_code: string | null
  position: Position
  position_detailed: string | null
  current_club_id: number | null
  jersey_number: number | null
  market_value: number | null
  photo_url: string | null
  transfermarkt_id: string | null
  is_active: boolean
  // Joined from clubs table
  club_name?: string
  club_short?: string
  club_league?: string
  club_logo?: string
}

// Pozycje (uproszczone)
export type Position = 'Bramkarz' | 'Obronca' | 'Pomocnik' | 'Napastnik'

// Historia kariery
export interface CareerEntry {
  id: number
  player_id: number
  club_id: number | null
  club_name: string | null
  league?: string | null
  season_start: number
  season_end: number | null
  appearances: number
  goals: number
}

// Dzienny zawodnik
export interface DailyPlayer {
  id: number
  date: string
  player_id: number
  player?: Player
}

// Status podpowiedzi
export type HintStatus = 'correct' | 'wrong' | 'close'

// Podpowiedź dla pojedynczego pola
export interface Hint {
  status: HintStatus
  value: string | number
  direction?: 'higher' | 'lower'
}

// Wynik porównania – 7 atrybutów
export interface GuessResult {
  correct: boolean
  guessedPlayer: Player
  matchPercentage: number // 0–100
  hints: {
    nationality: Hint       // Obywatelstwo
    career_status: Hint     // Status kariery (Aktywny / Zakończona)
    position: Hint          // Pozycja
    position_detailed: Hint // Dokładna rola
    club_history: Hint      // Historia klubów (wspólny klub ✓/✗)
    league_history: Hint    // Historia lig (wspólna liga ✓/✗)
    age: Hint               // Wiek (exact=correct, ±3=close z kierunkiem, dalej=wrong)
  }
  answer?: Player // tylko jeśli correct=true
  isHint?: boolean // czy wpis pochodzi z przycisku Podpowiedź
}

// Stan gry
export type GameStatus = 'playing' | 'won'

export interface GameState {
  date: string
  guesses: GuessResult[]
  status: GameStatus
}

// Wynik wyszukiwania
export interface SearchResult {
  id: number
  name: string
  club_name: string | null
  club_short: string | null
  position: Position
  nationality_code: string | null
  photo_url: string | null
}

// Statystyki użytkownika (localStorage)
export interface UserStats {
  gamesPlayed: number
  gamesWon: number
  currentStreak: number
  maxStreak: number
  guessDistribution: number[]
}

// Odpowiedź z API
export interface DailyResponse {
  date: string
  playerExists: boolean
}

export interface GuessRequest {
  date: string
  guessedPlayerId: number
}

export interface SearchResponse {
  players: SearchResult[]
}

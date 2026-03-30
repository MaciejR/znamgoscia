import { Player, Position } from './types'

// Oblicz aktualny wiek z daty urodzenia (lub użyj statycznego age jako fallback)
export function withCurrentAge<T extends Player>(player: T): T {
  if (player.birth_date) {
    const today = new Date()
    const birth = new Date(player.birth_date)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return { ...player, age }
  }
  return player // fallback: statyczny age z bazy
}

// Normalizacja polskich znaków
export function normalizePolish(str: string): string {
  const polishChars: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  }
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, char => polishChars[char] || char)
}

// Normalizacja pełna (lowercase + bez polskich znaków)
export function normalizeString(str: string): string {
  return normalizePolish(str).toLowerCase().trim()
}

// Mapowanie szczegółowych pozycji na ustandaryzowane polskie nazwy
export const POSITION_DETAILED_MAP: Record<string, string> = {
  'Goalkeeper': 'Bramkarz',
  'Centre-Back': 'Środkowy obrońca',
  'Left-Back': 'Lewy obrońca',
  'Right-Back': 'Prawy obrońca',
  'Defensive Midfield': 'Defensywny pomocnik',
  'Central Midfield': 'Środkowy pomocnik',
  'Attacking Midfield': 'Ofensywny pomocnik',
  'Left Midfield': 'Lewy pomocnik',
  'Right Midfield': 'Prawy pomocnik',
  'Left Winger': 'Lewe skrzydło',
  'Right Winger': 'Prawe skrzydło',
  'Second Striker': 'Cofnięty napastnik',
  'Centre-Forward': 'Środkowy napastnik',
  'Bramkarz': 'Bramkarz',
  'Środkowy obrońca': 'Środkowy obrońca',
  'Lewy obrońca': 'Lewy obrońca',
  'Prawy obrońca': 'Prawy obrońca',
  'Defensywny pomocnik': 'Defensywny pomocnik',
  'Środkowy pomocnik': 'Środkowy pomocnik',
  'Ofensywny pomocnik': 'Ofensywny pomocnik',
  'Lewy pomocnik': 'Lewy pomocnik',
  'Prawy pomocnik': 'Prawy pomocnik',
  'Lewe skrzydło': 'Lewe skrzydło',
  'Prawe skrzydło': 'Prawe skrzydło',
  'Cofnięty napastnik': 'Cofnięty napastnik',
  'Środkowy napastnik': 'Środkowy napastnik',
}

export function normalizePositionDetailed(posText: string | null): string | null {
  if (!posText) return null
  const trimmed = posText.trim()
  return POSITION_DETAILED_MAP[trimmed] ?? trimmed
}

// Mapowanie pozycji z angielskiego na polski
export const POSITION_MAP: Record<string, Position> = {
  'Goalkeeper': 'Bramkarz',
  'Centre-Back': 'Obronca',
  'Left-Back': 'Obronca',
  'Right-Back': 'Obronca',
  'Defensive Midfield': 'Pomocnik',
  'Central Midfield': 'Pomocnik',
  'Attacking Midfield': 'Pomocnik',
  'Left Midfield': 'Pomocnik',
  'Right Midfield': 'Pomocnik',
  'Left Winger': 'Pomocnik',
  'Right Winger': 'Pomocnik',
  'Centre-Forward': 'Napastnik',
  'Second Striker': 'Napastnik',
  // Polish variants
  'Bramkarz': 'Bramkarz',
  'Obrońca': 'Obronca',
  'Pomocnik': 'Pomocnik',
  'Napastnik': 'Napastnik',
}

// Mapowanie kodów narodowości na flagi emoji (z cache)
const FLAG_CODE_MAP: Record<string, string> = {
  'POL': 'PL', 'BRA': 'BR', 'ARG': 'AR', 'ESP': 'ES', 'POR': 'PT',
  'GER': 'DE', 'FRA': 'FR', 'ITA': 'IT', 'ENG': 'GB', 'NED': 'NL',
  'BEL': 'BE', 'CRO': 'HR', 'SRB': 'RS', 'UKR': 'UA', 'CZE': 'CZ',
  'SVK': 'SK', 'SLO': 'SI', 'AUT': 'AT', 'SUI': 'CH', 'GRE': 'GR',
  'TUR': 'TR', 'ROU': 'RO', 'HUN': 'HU', 'BUL': 'BG', 'SWE': 'SE',
  'NOR': 'NO', 'DEN': 'DK', 'FIN': 'FI', 'ISL': 'IS', 'WAL': 'GB',
  'SCO': 'GB', 'NIR': 'GB', 'IRL': 'IE', 'RUS': 'RU', 'USA': 'US',
  'MEX': 'MX', 'COL': 'CO', 'CHI': 'CL', 'URU': 'UY', 'PAR': 'PY',
  'PER': 'PE', 'ECU': 'EC', 'VEN': 'VE', 'BOL': 'BO', 'JPN': 'JP',
  'KOR': 'KR', 'CHN': 'CN', 'AUS': 'AU', 'NZL': 'NZ', 'RSA': 'ZA',
  'NGA': 'NG', 'GHA': 'GH', 'SEN': 'SN', 'CMR': 'CM', 'CIV': 'CI',
  'MAR': 'MA', 'TUN': 'TN', 'ALG': 'DZ', 'EGY': 'EG',
}
const flagCache = new Map<string, string>()

export function getFlagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2 && countryCode.length !== 3) {
    return '🏳️'
  }

  const cached = flagCache.get(countryCode)
  if (cached) return cached

  const code = countryCode.length === 3 ? (FLAG_CODE_MAP[countryCode.toUpperCase()] || countryCode.slice(0, 2)) : countryCode
  const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0))
  const emoji = String.fromCodePoint(...codePoints)

  flagCache.set(countryCode, emoji)
  return emoji
}

// Formatowanie wartości rynkowej
export function formatMarketValue(value: number | null): string {
  if (!value) return '-'
  if (value >= 1000000) {
    return `€${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `€${(value / 1000).toFixed(0)}K`
  }
  return `€${value}`
}

// Formatowanie daty
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Pobierz dzisiejszą datę w formacie YYYY-MM-DD (używa lokalnej strefy czasowej)
export function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Debounce funkcji
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Generowanie ID sesji (dla anonimowych statystyk)
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem('ekstra-typ-session-id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem('ekstra-typ-session-id', sessionId)
  }
  return sessionId
}

// Zapisywanie/odczytywanie stanu gry z localStorage
export function saveGameState(state: unknown): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ekstra-typ-game-state', JSON.stringify(state))
}

export function loadGameState(): unknown | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('ekstra-typ-game-state')
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch {
    return null
  }
}

// Zapisywanie/odczytywanie statystyk
export function saveUserStats(stats: unknown): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ekstra-typ-stats', JSON.stringify(stats))
}

export function loadUserStats(): unknown | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('ekstra-typ-stats')
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch {
    return null
  }
}

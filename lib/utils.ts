import { Player } from './types'

// Standaryzacja position_detailed na odczycie
const POSITION_DETAILED_NORMALIZE: Record<string, string> = {
  'Cofnięty napastnik': 'Środkowy napastnik',
  'Lewe skrzydło': 'Lewy napastnik',
  'Prawe skrzydło': 'Prawy napastnik',
  'Lewy pomocnik': 'Lewy napastnik',
  'Prawy pomocnik': 'Prawy napastnik',
}

export function normalizePositionDetailed(pos: string | null): string | null {
  if (!pos) return pos
  return POSITION_DETAILED_NORMALIZE[pos] ?? pos
}

// Oblicz aktualny wiek z daty urodzenia (lub użyj statycznego age jako fallback)
// + normalizacja position_detailed
export function withCurrentAge<T extends Player>(player: T): T {
  const position_detailed = normalizePositionDetailed(player.position_detailed)
  if (player.birth_date) {
    const today = new Date()
    const birth = new Date(player.birth_date)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return { ...player, age, position_detailed }
  }
  if (position_detailed !== player.position_detailed) {
    return { ...player, position_detailed }
  }
  return player
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

// Filtrowanie lig – pomijamy puchary krajowe i rozgrywki młodzieżowe poniżej U-19
const DOMESTIC_CUP_PATTERNS = [
  /puchar/i,
  /cup/i,
  /pokal/i,
  /copa/i,
  /coppa/i,
  /coupe/i,
  /taca/i,
  /taça/i,
]

const INTERNATIONAL_PATTERNS = [
  /liga mistrz/i,
  /liga europ/i,
  /liga konferencji/i,
  /champions league/i,
  /europa league/i,
  /conference league/i,
  /uefa/i,
  /puchar zdobywc/i,
  /superpuchar europ/i,
  /intercontinental/i,
  /puchar intertoto/i,
]

const YOUTH_BELOW_U19 = /\bu[- ]?(1[0-8]|[1-9])\b/i

export function isLeagueIncluded(league: string): boolean {
  if (!league) return false

  // Rozgrywki młodzieżowe poniżej U-19 – wyklucz
  if (YOUTH_BELOW_U19.test(league)) return false

  // Puchary – sprawdź czy krajowy
  const isCup = DOMESTIC_CUP_PATTERNS.some(p => p.test(league))
  if (isCup) {
    // Zachowaj jeśli międzynarodowy
    return INTERNATIONAL_PATTERNS.some(p => p.test(league))
  }

  return true
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player, CareerEntry, GuessResult, Hint } from '@/lib/types'
import { withCurrentAge } from '@/lib/utils'

interface HintRequestBody {
  date: string
  alreadyGuessedIds?: number[]
  knownAttributes?: Record<string, boolean>
  knownClubs?: string[]
  knownLeagues?: string[]
}

interface HintResponse {
  success: boolean
  result?: GuessResult
  error?: string
}

// ── Cache dzienny (te same dane dla wszystkich graczy przez cały dzień) ──

interface DailyHint {
  player_id: number
  matching_attributes: string[]
  matching_clubs: string[]
  matching_leagues: string[]
}

interface DailyCache {
  date: string
  hints: DailyHint[]
  answerPlayerId: number
  answerPlayer: Player
  answerCareer: CareerEntry[]
  answerUniqueClubs: string[]
  answerUniqueLeagues: string[]
  timestamp: number
}

let dailyCache: DailyCache | null = null
const DAILY_CACHE_TTL = 5 * 60 * 1000 // 5 minut

async function getDailyCache(date: string): Promise<DailyCache | null> {
  if (dailyCache && dailyCache.date === date && Date.now() - dailyCache.timestamp < DAILY_CACHE_TTL) {
    return dailyCache
  }

  // Pobierz hinty i answer player_id równolegle
  const [hintsResult, dailyResult] = await Promise.all([
    supabase
      .from('daily_hints')
      .select('player_id, matching_attributes, matching_clubs, matching_leagues')
      .eq('date', date),
    supabase
      .from('daily_players')
      .select('player_id')
      .eq('date', date)
      .single(),
  ])

  if (hintsResult.error || !hintsResult.data?.length || dailyResult.error || !dailyResult.data) {
    return null
  }

  const answerPlayerId = dailyResult.data.player_id

  // Pobierz dane answer playera i jego karierę równolegle
  const [answerResult, answerCareer] = await Promise.all([
    fetchPlayerWithClub(answerPlayerId),
    fetchCareerHistory(answerPlayerId),
  ])

  if (!answerResult.player) return null

  const answerUniqueClubs = Array.from(new Set(
    answerCareer.map(c => c.club_name).filter((n): n is string => Boolean(n))
  ))
  const answerUniqueLeagues = Array.from(new Set(
    answerCareer.map(c => c.league).filter((l): l is string => Boolean(l))
  ))

  dailyCache = {
    date,
    hints: hintsResult.data as DailyHint[],
    answerPlayerId,
    answerPlayer: withCurrentAge(answerResult.player),
    answerCareer,
    answerUniqueClubs,
    answerUniqueLeagues,
    timestamp: Date.now(),
  }

  return dailyCache
}

// ── Cache graczy (tylko dane gracza, bez kariery — kariera niepotrzebna dla hintów) ──

const playerCache = new Map<number, { player: Player; timestamp: number }>()
const PLAYER_CACHE_TTL = 60 * 60 * 1000 // 1 godzina
const PLAYER_CACHE_MAX = 200

async function getCachedPlayer(playerId: number): Promise<Player | null> {
  const cached = playerCache.get(playerId)
  if (cached && Date.now() - cached.timestamp < PLAYER_CACHE_TTL) {
    return cached.player
  }

  const result = await fetchPlayerWithClub(playerId)
  if (!result.player) return null

  const entry = { player: result.player, timestamp: Date.now() }
  playerCache.set(playerId, entry)

  // Evict: usuń przeterminowane, a jeśli dalej za dużo — najstarsze
  if (playerCache.size > PLAYER_CACHE_MAX) {
    const now = Date.now()
    Array.from(playerCache.entries()).forEach(([key, val]) => {
      if (now - val.timestamp > PLAYER_CACHE_TTL) playerCache.delete(key)
    })
    if (playerCache.size > PLAYER_CACHE_MAX) {
      const sorted = Array.from(playerCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = sorted.slice(0, playerCache.size - PLAYER_CACHE_MAX)
      for (const [key] of toRemove) playerCache.delete(key)
    }
  }

  return entry.player
}

// ── Budowanie GuessResult z prekomputowanych danych (bez kariery!) ──

function compareField(guessValue: string, answerValue: string): Hint {
  if (!guessValue && !answerValue) return { status: 'correct', value: '-' }
  const isCorrect = guessValue.toLowerCase() === answerValue.toLowerCase()
  return { status: isCorrect ? 'correct' : 'wrong', value: guessValue || '-' }
}

function compareAge(guessAge: number | null, answerAge: number | null): Hint {
  if (guessAge == null || answerAge == null) {
    return { status: 'wrong', value: guessAge != null ? String(guessAge) : '?' }
  }
  const diff = guessAge - answerAge
  if (diff === 0) return { status: 'correct', value: guessAge }
  if (Math.abs(diff) <= 3) {
    return { status: 'close', value: guessAge, direction: diff > 0 ? 'lower' : 'higher' }
  }
  return { status: 'wrong', value: guessAge, direction: diff > 0 ? 'lower' : 'higher' }
}

function buildHintResult(
  guessedPlayer: Player,
  answerPlayer: Player,
  matchingClubs: string[],
  matchingLeagues: string[],
): GuessResult {
  const isCorrect = guessedPlayer.id === answerPlayer.id

  const nationalityHint = compareField(guessedPlayer.nationality, answerPlayer.nationality)
  const careerStatusHint = compareField(
    guessedPlayer.is_active ? 'Aktywny' : 'Zakończona',
    answerPlayer.is_active ? 'Aktywny' : 'Zakończona'
  )
  const positionHint = compareField(guessedPlayer.position, answerPlayer.position)
  const positionDetailedHint = compareField(
    guessedPlayer.position_detailed || '',
    answerPlayer.position_detailed || ''
  )
  const clubHistoryHint: Hint = {
    status: matchingClubs.length > 0 ? 'correct' : 'wrong',
    value: matchingClubs.length > 0 ? matchingClubs.join(', ') : 'Nie',
  }
  const leagueHistoryHint: Hint = {
    status: matchingLeagues.length > 0 ? 'correct' : 'wrong',
    value: matchingLeagues.length > 0 ? matchingLeagues.join(', ') : 'Nie',
  }
  const ageHint = compareAge(guessedPlayer.age, answerPlayer.age)

  const allHints = [nationalityHint, careerStatusHint, positionHint, positionDetailedHint, clubHistoryHint, leagueHistoryHint, ageHint]
  const matchCount = allHints.filter(h => h.status === 'correct').length
  const matchPercentage = isCorrect ? 100 : Math.round((matchCount / 7) * 100)

  return {
    correct: isCorrect,
    guessedPlayer,
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
    answer: isCorrect ? answerPlayer : undefined,
  }
}

// ── GET /api/hint?date=YYYY-MM-DD — rozgrzewka cache (fire & forget z klienta) ──

export async function GET(request: NextRequest): Promise<NextResponse> {
  const date = request.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ success: false, error: 'Missing date' }, { status: 400 })
  }

  const cache = await getDailyCache(date)
  return NextResponse.json({ success: !!cache, cached: !!cache })
}

// ── POST /api/hint ──

export async function POST(request: NextRequest): Promise<NextResponse<HintResponse>> {
  try {
    const body: HintRequestBody = await request.json()
    const {
      date,
      alreadyGuessedIds = [],
      knownAttributes = {},
      knownClubs = [],
      knownLeagues = [],
    } = body

    if (!date) {
      return NextResponse.json({ success: false, error: 'Missing required field: date' }, { status: 400 })
    }

    // Pobierz dane dnia z cache (hinty + answer player)
    const cache = await getDailyCache(date)
    if (!cache) {
      return NextResponse.json({ success: false, error: 'No hints available for this date' }, { status: 404 })
    }

    // Filtruj already guessed w pamięci (hinty już są w cache)
    const excludeSet = new Set(alreadyGuessedIds)
    const available = excludeSet.size > 0
      ? cache.hints.filter(h => !excludeSet.has(h.player_id))
      : cache.hints

    if (available.length === 0) {
      return NextResponse.json({ success: false, error: 'No more hints available' }, { status: 404 })
    }

    // Zbiory znanych atrybutów
    const knownKeys = new Set(
      Object.entries(knownAttributes).filter(([, v]) => v).map(([k]) => k)
    )
    const knownClubSet = new Set(knownClubs.map(c => c.toLowerCase()))
    const knownLeagueSet = new Set(knownLeagues.map(l => l.toLowerCase()))

    // Scoring – jedna iteracja z early termination
    let bestPlayerId: number | null = null
    let bestHint: DailyHint | null = null
    let bestScore = -Infinity

    let fallbackPlayerId: number | null = null
    let fallbackHint: DailyHint | null = null
    let fallbackMinNew = Infinity
    let fallbackConfirmed = -1

    for (const hint of available) {
      const attrs = hint.matching_attributes
      const matchingClubs = hint.matching_clubs
      const matchingLeagues = hint.matching_leagues
      const maxPossibleConfirmed = attrs.length - 1

      let newReveals = 0
      let confirmedKnown = 0

      for (const a of attrs) {
        if (a === 'club_history') {
          if (matchingClubs.some(c => !knownClubSet.has(c))) newReveals++
          else confirmedKnown++
        } else if (a === 'league_history') {
          if (matchingLeagues.some(l => !knownLeagueSet.has(l))) newReveals++
          else confirmedKnown++
        } else if (knownKeys.has(a)) {
          confirmedKnown++
        } else {
          newReveals++
        }
        // Prune: jeśli już mamy >1 nowy atrybut i nie poprawi primary score — skip
        if (newReveals > 1 && bestPlayerId !== null) break
      }

      if (newReveals === 1 && confirmedKnown > bestScore) {
        bestScore = confirmedKnown
        bestPlayerId = hint.player_id
        bestHint = hint
        // Early termination: idealny wynik (1 nowy + wszystkie inne potwierdzone)
        if (confirmedKnown === maxPossibleConfirmed) break
      }

      if (newReveals > 0 && (newReveals < fallbackMinNew || (newReveals === fallbackMinNew && confirmedKnown > fallbackConfirmed))) {
        fallbackMinNew = newReveals
        fallbackConfirmed = confirmedKnown
        fallbackPlayerId = hint.player_id
        fallbackHint = hint
      }
    }

    const selectedHint = bestHint || fallbackHint || available[0]
    const selectedPlayerId = selectedHint.player_id

    // Pobierz tylko dane gracza (bez kariery! — klub/liga z prekomputowanych danych)
    let guessedPlayer: Player

    if (selectedPlayerId === cache.answerPlayerId) {
      guessedPlayer = cache.answerPlayer
    } else {
      const player = await getCachedPlayer(selectedPlayerId)
      if (!player) {
        return NextResponse.json({ success: false, error: 'Failed to fetch hint player' }, { status: 500 })
      }
      guessedPlayer = withCurrentAge(player)
    }

    // Zbuduj wynik z prekomputowanych danych (bez compareGuess, bez career fetch)
    const result = buildHintResult(
      guessedPlayer,
      cache.answerPlayer,
      selectedHint.matching_clubs,
      selectedHint.matching_leagues,
    )
    result.isHint = true

    if (result.correct && result.answer) {
      result.answer.career_clubs = cache.answerUniqueClubs
      result.answer.career_leagues = cache.answerUniqueLeagues
    }

    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('Error in hint API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// ── Helpery DB ──

async function fetchPlayerWithClub(playerId: number): Promise<{ player: Player | null }> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      id, name, name_normalized, birth_date, age, nationality, nationality_code,
      position, position_detailed, jersey_number, market_value, photo_url,
      transfermarkt_id, is_active, current_club_id,
      clubs (id, name, name_short, league, logo_url)
    `)
    .eq('id', playerId)
    .single()

  if (error || !data) {
    return { player: null }
  }

  const clubData = data.clubs
  const club = (Array.isArray(clubData) ? clubData[0] : clubData) as Record<string, unknown> | null

  return {
    player: {
      ...data,
      club_name: club?.name as string | undefined,
      club_short: club?.name_short as string | undefined,
      club_league: club?.league as string | undefined,
      club_logo: club?.logo_url as string | undefined,
    } as Player
  }
}

async function fetchCareerHistory(playerId: number): Promise<CareerEntry[]> {
  const { data, error } = await supabase
    .from('career_history')
    .select('id, player_id, club_id, club_name, league, season_start, season_end, appearances, goals')
    .eq('player_id', playerId)
    .order('season_start', { ascending: false })

  if (error || !data) {
    return []
  }

  return data as CareerEntry[]
}

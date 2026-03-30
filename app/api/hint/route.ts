import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { compareGuess } from '@/lib/game-logic'
import { Player, CareerEntry, GuessResult } from '@/lib/types'
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

// ── Cache graczy (hint candidates) ──

const playerCache = new Map<number, { player: Player; career: CareerEntry[]; timestamp: number }>()
const PLAYER_CACHE_TTL = 60 * 60 * 1000 // 1 godzina
const PLAYER_CACHE_MAX = 200

async function getCachedPlayerData(playerId: number): Promise<{ player: Player; career: CareerEntry[] } | null> {
  const cached = playerCache.get(playerId)
  if (cached && Date.now() - cached.timestamp < PLAYER_CACHE_TTL) {
    return { player: cached.player, career: cached.career }
  }

  const [result, career] = await Promise.all([
    fetchPlayerWithClub(playerId),
    fetchCareerHistory(playerId),
  ])

  if (!result.player) return null

  const entry = { player: result.player, career, timestamp: Date.now() }
  playerCache.set(playerId, entry)

  // Evict: usuń przeterminowane, a jeśli dalej za dużo — najstarsze
  if (playerCache.size > PLAYER_CACHE_MAX) {
    const now = Date.now()
    Array.from(playerCache.entries()).forEach(([key, val]) => {
      if (now - val.timestamp > PLAYER_CACHE_TTL) playerCache.delete(key)
    })
    if (playerCache.size > PLAYER_CACHE_MAX) {
      // Usuń najstarsze wpisy aż wrócimy do limitu
      const sorted = Array.from(playerCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = sorted.slice(0, playerCache.size - PLAYER_CACHE_MAX)
      for (const [key] of toRemove) playerCache.delete(key)
    }
  }

  return { player: entry.player, career: entry.career }
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
    let bestScore = -Infinity

    let fallbackPlayerId: number | null = null
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
        // Early termination: idealny wynik (1 nowy + wszystkie inne potwierdzone)
        if (confirmedKnown === maxPossibleConfirmed) break
      }

      if (newReveals > 0 && (newReveals < fallbackMinNew || (newReveals === fallbackMinNew && confirmedKnown > fallbackConfirmed))) {
        fallbackMinNew = newReveals
        fallbackConfirmed = confirmedKnown
        fallbackPlayerId = hint.player_id
      }
    }

    const selectedPlayerId = bestPlayerId || fallbackPlayerId || available[0].player_id

    // Pobierz dane wybranego gracza — jeśli to answer player, użyj danych z cache (0 queries)
    let guessedPlayer: Player
    let guessedCareer: CareerEntry[]

    if (selectedPlayerId === cache.answerPlayerId) {
      guessedPlayer = cache.answerPlayer
      guessedCareer = cache.answerCareer
    } else {
      const guessedData = await getCachedPlayerData(selectedPlayerId)
      if (!guessedData) {
        return NextResponse.json({ success: false, error: 'Failed to fetch hint player' }, { status: 500 })
      }
      guessedPlayer = withCurrentAge(guessedData.player)
      guessedCareer = guessedData.career
    }

    // Porównaj – answer player i kariera są już w cache
    const result = compareGuess(guessedPlayer, cache.answerPlayer, guessedCareer, cache.answerCareer)
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

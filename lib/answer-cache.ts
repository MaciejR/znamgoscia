import { supabase } from '@/lib/supabase'
import { Player, CareerEntry } from '@/lib/types'
import { withCurrentAge } from '@/lib/utils'

// ── Współdzielony cache odpowiedzi dnia ──
// Używany przez /api/guess i /api/hint — answer player + kariera
// pobierane raz, serwowane wszystkim graczom w danym dniu.

interface AnswerCache {
  date: string
  answerPlayerId: number
  answerPlayer: Player
  answerCareer: CareerEntry[]
  answerUniqueClubs: string[]
  answerUniqueLeagues: string[]
  timestamp: number
}

let answerCache: AnswerCache | null = null
const ANSWER_CACHE_TTL = 5 * 60 * 1000 // 5 minut

export async function getAnswerCache(date: string): Promise<AnswerCache | null> {
  if (answerCache && answerCache.date === date && Date.now() - answerCache.timestamp < ANSWER_CACHE_TTL) {
    return answerCache
  }

  // Pobierz answer player_id
  const { data: dailyPlayer, error: dailyError } = await supabase
    .from('daily_players')
    .select('player_id')
    .eq('date', date)
    .single()

  if (dailyError || !dailyPlayer) {
    return null
  }

  const answerPlayerId = dailyPlayer.player_id

  // Pobierz dane answer playera i jego karierę równolegle
  const [playerResult, careerResult] = await Promise.all([
    fetchPlayerWithClub(answerPlayerId),
    fetchCareerHistory(answerPlayerId),
  ])

  if (!playerResult.player) return null

  const answerUniqueClubs = Array.from(new Set(
    careerResult.map(c => c.club_name).filter((n): n is string => Boolean(n))
  ))
  const answerUniqueLeagues = Array.from(new Set(
    careerResult.map(c => c.league).filter((l): l is string => Boolean(l))
  ))

  answerCache = {
    date,
    answerPlayerId,
    answerPlayer: withCurrentAge(playerResult.player),
    answerCareer: careerResult,
    answerUniqueClubs,
    answerUniqueLeagues,
    timestamp: Date.now(),
  }

  return answerCache
}

// ── Cache graczy (guessowanych, nie answer) ──

const playerCache = new Map<number, { player: Player; timestamp: number }>()
const PLAYER_CACHE_TTL = 60 * 60 * 1000 // 1 godzina
const PLAYER_CACHE_MAX = 200

export async function getCachedPlayer(playerId: number): Promise<Player | null> {
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

// ── Helpery DB (współdzielone) ──

export async function fetchPlayerWithClub(playerId: number): Promise<{ player: Player | null }> {
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

  let clubName = club?.name as string | undefined
  const clubShort = club?.name_short as string | undefined
  let clubLeague = club?.league as string | undefined
  const clubLogo = club?.logo_url as string | undefined

  // Fallback: ostatni klub z kariery
  if (!clubName) {
    const { data: lastCareer } = await supabase
      .from('career_history')
      .select('club_name, league')
      .eq('player_id', playerId)
      .not('club_name', 'is', null)
      .order('season_start', { ascending: false })
      .limit(1)

    if (lastCareer && lastCareer.length > 0) {
      clubName = lastCareer[0].club_name
      clubLeague = lastCareer[0].league
    }
  }

  return {
    player: {
      ...data,
      club_name: clubName,
      club_short: clubShort,
      club_league: clubLeague,
      club_logo: clubLogo,
    } as Player
  }
}

export async function fetchCareerHistory(playerId: number): Promise<CareerEntry[]> {
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player, CareerEntry } from '@/lib/types'
import { scorePlayerMatch } from '@/lib/game-logic'
import { withCurrentAge } from '@/lib/utils'

interface GuessedHints {
  nationality?: boolean
  career_status?: boolean
  position?: boolean
  position_detailed?: boolean
  club_history?: boolean
  league_history?: boolean
  age?: boolean // true = exact or close
}

interface HintRequestBody {
  date: string
  alreadyGuessedIds?: number[]
  knownAttributes?: GuessedHints
}

interface HintResponse {
  success: boolean
  hint?: { player: Player }
  error?: string
}

// POST /api/hint – zwróć zawodnika z największą liczbą wspólnych atrybutów z szukanym
export async function POST(request: NextRequest): Promise<NextResponse<HintResponse>> {
  try {
    const body: HintRequestBody = await request.json()
    const { date, alreadyGuessedIds = [], knownAttributes = {} } = body

    if (!date) {
      return NextResponse.json({ success: false, error: 'Missing required field: date' }, { status: 400 })
    }

    // Pobierz dziennego zawodnika
    const { data: dailyPlayer, error: dailyError } = await supabase
      .from('daily_players')
      .select('player_id')
      .eq('date', date)
      .single()

    if (dailyError || !dailyPlayer) {
      return NextResponse.json({ success: false, error: 'No player set for this date' }, { status: 404 })
    }

    const answerPlayerId = dailyPlayer.player_id

    const [answerPlayer, answerCareer] = await Promise.all([
      fetchPlayerWithClub(answerPlayerId),
      fetchCareerHistory(answerPlayerId),
    ])

    if (!answerPlayer) {
      return NextResponse.json({ success: false, error: 'Answer player not found' }, { status: 404 })
    }

    const answerWithAge = withCurrentAge(answerPlayer)

    // Pobierz kandydatów – wyklucz odpowiedź i już odgadnięte
    const excludeIds = [answerPlayerId, ...alreadyGuessedIds]

    const { data: candidates, error: candidatesError } = await supabase
      .from('players')
      .select(`
        id, name, name_normalized, birth_date, age, nationality, nationality_code,
        position, position_detailed, jersey_number, market_value, photo_url,
        transfermarkt_id, is_active, current_club_id,
        clubs (id, name, name_short, league, logo_url)
      `)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .not('age', 'is', null)
      .limit(500)

    if (candidatesError || !candidates || candidates.length === 0) {
      return NextResponse.json({ success: false, error: 'No candidates found' }, { status: 404 })
    }

    // Pobierz kariery kandydatów (batch, max 200 graczy)
    const candidateIds = candidates.map(c => c.id)
    let allCareers: CareerEntry[] = []
    // Supabase .in() ma limit ~300 elementów, batch po 200
    for (let i = 0; i < Math.min(candidateIds.length, 400); i += 200) {
      const batch = candidateIds.slice(i, i + 200)
      const { data } = await supabase
        .from('career_history')
        .select('id, player_id, club_id, club_name, league, season_start, season_end, appearances, goals')
        .in('player_id', batch)
      if (data) allCareers = allCareers.concat(data as CareerEntry[])
    }

    const careersByPlayer: Record<number, CareerEntry[]> = {}
    if (allCareers) {
      for (const entry of allCareers) {
        if (!careersByPlayer[entry.player_id]) careersByPlayer[entry.player_id] = []
        careersByPlayer[entry.player_id].push(entry as CareerEntry)
      }
    }

    // Oceń kandydatów - priorytet: ujawnij brakujące atrybuty
    let bestScore = -1
    let bestPlayer: Player | null = null

    // Które atrybuty gracz już zna (trafił w poprzednich próbach)?
    const known = knownAttributes

    for (const raw of candidates) {
      const clubData = raw.clubs
      const club = (Array.isArray(clubData) ? clubData[0] : clubData) as Record<string, unknown> | null
      const candidate: Player = {
        ...raw,
        club_name: club?.name as string | undefined,
        club_short: club?.name_short as string | undefined,
        club_league: club?.league as string | undefined,
        club_logo: club?.logo_url as string | undefined,
      } as Player

      const candidateCareer = careersByPlayer[candidate.id] || []

      // Inteligentny scoring: +3 za ujawnienie nieznanego atrybutu, +1 za potwierdzenie znanego
      let score = 0

      const candidateWithAge = withCurrentAge(candidate)

      const matchNationality = candidateWithAge.nationality?.toLowerCase() === answerWithAge.nationality?.toLowerCase()
      score += matchNationality ? (known.nationality ? 1 : 3) : 0

      const matchStatus = candidateWithAge.is_active === answerWithAge.is_active
      score += matchStatus ? (known.career_status ? 1 : 3) : 0

      const matchPosition = candidateWithAge.position?.toLowerCase() === answerWithAge.position?.toLowerCase()
      score += matchPosition ? (known.position ? 1 : 3) : 0

      const matchDetailedPos = candidateWithAge.position_detailed && answerWithAge.position_detailed &&
        candidateWithAge.position_detailed.toLowerCase() === answerWithAge.position_detailed.toLowerCase()
      score += matchDetailedPos ? (known.position_detailed ? 1 : 3) : 0

      const candidateClubs = new Set(candidateCareer.map(c => c.club_name?.toLowerCase()).filter(Boolean))
      const answerClubs = new Set(answerCareer.map(c => c.club_name?.toLowerCase()).filter(Boolean))
      const matchClubs = candidateClubs.size > 0 && answerClubs.size > 0 &&
        Array.from(candidateClubs).some(c => answerClubs.has(c as string))
      score += matchClubs ? (known.club_history ? 1 : 3) : 0

      const candidateLeagues = new Set(candidateCareer.map(c => c.league?.toLowerCase()).filter(Boolean))
      const answerLeagues = new Set(answerCareer.map(c => c.league?.toLowerCase()).filter(Boolean))
      const matchLeagues = candidateLeagues.size > 0 &&
        Array.from(candidateLeagues).some(l => answerLeagues.has(l as string))
      score += matchLeagues ? (known.league_history ? 1 : 3) : 0

      if (candidateWithAge.age != null && answerWithAge.age != null) {
        const ageDiff = Math.abs(candidateWithAge.age - answerWithAge.age)
        if (ageDiff === 0) score += known.age ? 1 : 3
        else if (ageDiff <= 3) score += known.age ? 0.5 : 2
      }

      if (score > bestScore) {
        bestScore = score
        bestPlayer = candidate
      }
    }

    if (!bestPlayer) {
      return NextResponse.json({ success: false, error: 'No suitable hint found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, hint: { player: bestPlayer } })

  } catch (error) {
    console.error('Error in hint API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchPlayerWithClub(playerId: number): Promise<Player | null> {
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

  if (error || !data) return null

  const clubData = data.clubs
  const club = (Array.isArray(clubData) ? clubData[0] : clubData) as Record<string, unknown> | null

  return {
    ...data,
    club_name: club?.name as string | undefined,
    club_short: club?.name_short as string | undefined,
    club_league: club?.league as string | undefined,
    club_logo: club?.logo_url as string | undefined,
  } as Player
}

async function fetchCareerHistory(playerId: number): Promise<CareerEntry[]> {
  const { data, error } = await supabase
    .from('career_history')
    .select('id, player_id, club_id, club_name, league, season_start, season_end, appearances, goals')
    .eq('player_id', playerId)
    .order('season_start', { ascending: false })

  if (error || !data) return []

  return data as CareerEntry[]
}

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

    // Oceń kandydatów - podpowiadaj celowo, 1-2 nowe atrybuty na raz
    let bestScore = -1
    let bestPlayer: Player | null = null

    const known = knownAttributes
    const knownCount = Object.values(known).filter(Boolean).length

    // Ile nowych atrybutów chcemy ujawnić na raz?
    // Mało znanych → 1-2 nowe (nie zdradzaj za dużo)
    // Dużo znanych → więcej nowych OK (pomóż domknąć)
    const targetNewReveals = knownCount <= 2 ? 1 : knownCount <= 4 ? 2 : 3

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
      const candidateWithAge = withCurrentAge(candidate)

      // Sprawdź które atrybuty ten kandydat ujawnia
      const reveals: { isNew: boolean }[] = []

      const matchNat = candidateWithAge.nationality?.toLowerCase() === answerWithAge.nationality?.toLowerCase()
      if (matchNat) reveals.push({ isNew: !known.nationality })

      const matchStatus = candidateWithAge.is_active === answerWithAge.is_active
      if (matchStatus) reveals.push({ isNew: !known.career_status })

      const matchPos = candidateWithAge.position?.toLowerCase() === answerWithAge.position?.toLowerCase()
      if (matchPos) reveals.push({ isNew: !known.position })

      const matchDetPos = candidateWithAge.position_detailed && answerWithAge.position_detailed &&
        candidateWithAge.position_detailed.toLowerCase() === answerWithAge.position_detailed.toLowerCase()
      if (matchDetPos) reveals.push({ isNew: !known.position_detailed })

      const candidateClubs = new Set(candidateCareer.map(c => c.club_name?.toLowerCase()).filter(Boolean))
      const answerClubs = new Set(answerCareer.map(c => c.club_name?.toLowerCase()).filter(Boolean))
      const matchClubs = candidateClubs.size > 0 && answerClubs.size > 0 &&
        Array.from(candidateClubs).some(c => answerClubs.has(c as string))
      if (matchClubs) reveals.push({ isNew: !known.club_history })

      const candidateLeagues = new Set(candidateCareer.map(c => c.league?.toLowerCase()).filter(Boolean))
      const answerLeagues = new Set(answerCareer.map(c => c.league?.toLowerCase()).filter(Boolean))
      const matchLeagues = candidateLeagues.size > 0 &&
        Array.from(candidateLeagues).some(l => answerLeagues.has(l as string))
      if (matchLeagues) reveals.push({ isNew: !known.league_history })

      let matchAge = false
      if (candidateWithAge.age != null && answerWithAge.age != null) {
        matchAge = Math.abs(candidateWithAge.age - answerWithAge.age) <= 3
        if (matchAge) reveals.push({ isNew: !known.age })
      }

      const newReveals = reveals.filter(r => r.isNew).length
      const confirmedKnown = reveals.filter(r => !r.isNew).length

      // Score: najlepiej = dokładnie targetNewReveals nowych
      // Kara za zbyt wiele nowych (nie zdradzaj wszystkiego naraz)
      // Bonus za potwierdzenie znanych (spójność)
      const revealScore = newReveals > 0
        ? 10 - Math.abs(newReveals - targetNewReveals) * 3  // blisko celu = lepiej
        : 0
      const confirmScore = confirmedKnown * 0.5
      const score = revealScore + confirmScore

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

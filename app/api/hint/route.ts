import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player, CareerEntry } from '@/lib/types'
import { scorePlayerMatch } from '@/lib/game-logic'

interface HintRequestBody {
  date: string
  alreadyGuessedIds?: number[]
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
    const { date, alreadyGuessedIds = [] } = body

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
      .limit(200)

    if (candidatesError || !candidates || candidates.length === 0) {
      return NextResponse.json({ success: false, error: 'No candidates found' }, { status: 404 })
    }

    // Pobierz kariery kandydatów (batch)
    const candidateIds = candidates.map(c => c.id)
    const { data: allCareers } = await supabase
      .from('career_history')
      .select('id, player_id, club_id, club_name, league, season_start, season_end, appearances, goals')
      .in('player_id', candidateIds.slice(0, 50)) // ogranicz dla perf

    const careersByPlayer: Record<number, CareerEntry[]> = {}
    if (allCareers) {
      for (const entry of allCareers) {
        if (!careersByPlayer[entry.player_id]) careersByPlayer[entry.player_id] = []
        careersByPlayer[entry.player_id].push(entry as CareerEntry)
      }
    }

    // Oceń kandydatów
    let bestScore = -1
    let bestPlayer: Player | null = null

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
      const score = scorePlayerMatch(candidate, answerPlayer, candidateCareer, answerCareer)

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

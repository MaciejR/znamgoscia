import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { compareGuess } from '@/lib/game-logic'
import { Player, CareerEntry } from '@/lib/types'
import { withCurrentAge } from '@/lib/utils'

interface GuessRequestBody {
  date: string
  guessedPlayerId: number
}

// POST /api/guess - sprawdź odpowiedź
export async function POST(request: NextRequest) {
  try {
    const body: GuessRequestBody = await request.json()
    const { date, guessedPlayerId } = body

    if (!date || !guessedPlayerId) {
      return NextResponse.json(
        { error: 'Missing required fields: date, guessedPlayerId' },
        { status: 400 }
      )
    }

    // Pobierz dziennego zawodnika
    const { data: dailyPlayer, error: dailyError } = await supabase
      .from('daily_players')
      .select('player_id')
      .eq('date', date)
      .single()

    if (dailyError || !dailyPlayer) {
      return NextResponse.json(
        { error: 'No player set for this date' },
        { status: 404 }
      )
    }

    const answerPlayerId = dailyPlayer.player_id

    // Pobierz dane obu zawodników + kariery w jednym Promise.all (4 queries równolegle)
    const [guessedResult, answerResult, guessCareer, answerCareer] = await Promise.all([
      fetchPlayerWithClub(guessedPlayerId),
      fetchPlayerWithClub(answerPlayerId),
      fetchCareerHistory(guessedPlayerId),
      fetchCareerHistory(answerPlayerId),
    ])

    if (!guessedResult.player || !answerResult.player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    const guessedPlayer = withCurrentAge(guessedResult.player)
    const answerPlayer = withCurrentAge(answerResult.player)

    // Porównaj strzał z odpowiedzią
    const result = compareGuess(
      guessedPlayer,
      answerPlayer,
      guessCareer,
      answerCareer
    )

    // Przy poprawnej odpowiedzi dodaj kariery do answer
    if (result.correct && result.answer) {
      result.answer.career_clubs = Array.from(new Set(
        answerCareer.map(c => c.club_name).filter((n): n is string => Boolean(n))
      ))
      result.answer.career_leagues = Array.from(new Set(
        answerCareer.map(c => c.league).filter((l): l is string => Boolean(l))
      ))
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in guess API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Pomocnicza funkcja do pobierania zawodnika z klubem
async function fetchPlayerWithClub(playerId: number): Promise<{ player: Player | null }> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      id,
      name,
      name_normalized,
      birth_date,
      age,
      nationality,
      nationality_code,
      position,
      position_detailed,
      jersey_number,
      market_value,
      photo_url,
      transfermarkt_id,
      is_active,
      current_club_id,
      clubs (
        id,
        name,
        name_short,
        league,
        logo_url
      )
    `)
    .eq('id', playerId)
    .single()

  if (error || !data) {
    return { player: null }
  }

  const clubData = data.clubs
  const club = (Array.isArray(clubData) ? clubData[0] : clubData) as Record<string, unknown> | null

  let clubName = club?.name as string | undefined
  let clubShort = club?.name_short as string | undefined
  let clubLeague = club?.league as string | undefined
  let clubLogo = club?.logo_url as string | undefined

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

// Pomocnicza funkcja do pobierania historii kariery (kolumna league bezpośrednio w tabeli)
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

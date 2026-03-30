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

// POST /api/hint – wybierz podpowiedź i od razu zwróć GuessResult (hint + guess w jednym)
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

    // Pobierz precomputowane podpowiedzi dla dnia – filtruj already guessed w SQL
    let query = supabase
      .from('daily_hints')
      .select('player_id, matching_attributes, matching_clubs, matching_leagues')
      .eq('date', date)

    if (alreadyGuessedIds.length > 0) {
      query = query.not('player_id', 'in', `(${alreadyGuessedIds.join(',')})`)
    }

    const { data: hints, error: hintsError } = await query

    if (hintsError || !hints || hints.length === 0) {
      return NextResponse.json({ success: false, error: 'No hints available for this date' }, { status: 404 })
    }

    // Zbiory znanych atrybutów (5 skalarnych) + granularne kluby/ligi
    const knownKeys = new Set(
      Object.entries(knownAttributes).filter(([, v]) => v).map(([k]) => k)
    )
    const knownClubSet = new Set(knownClubs.map(c => c.toLowerCase()))
    const knownLeagueSet = new Set(knownLeagues.map(l => l.toLowerCase()))

    // Scoring – jedna iteracja, zbieramy najlepszego z newReveals===1 i fallback jednocześnie
    let bestPlayerId: number | null = null
    let bestScore = -Infinity

    let fallbackPlayerId: number | null = null
    let fallbackMinNew = Infinity
    let fallbackConfirmed = -1

    for (const hint of hints) {
      const attrs: string[] = hint.matching_attributes || []
      const matchingClubs: string[] = hint.matching_clubs || []
      const matchingLeagues: string[] = hint.matching_leagues || []

      let newReveals = 0
      let confirmedKnown = 0

      for (const a of attrs) {
        if (a === 'club_history') {
          const hasNew = matchingClubs.some(c => !knownClubSet.has(c))
          if (hasNew) newReveals++
          else confirmedKnown++
        } else if (a === 'league_history') {
          const hasNew = matchingLeagues.some(l => !knownLeagueSet.has(l))
          if (hasNew) newReveals++
          else confirmedKnown++
        } else if (knownKeys.has(a)) {
          confirmedKnown++
        } else {
          newReveals++
        }
      }

      // Priorytet: dokładnie 1 nowy atrybut
      if (newReveals === 1 && confirmedKnown > bestScore) {
        bestScore = confirmedKnown
        bestPlayerId = hint.player_id
      }

      // Fallback: minimum nowych > 0
      if (newReveals > 0 && (newReveals < fallbackMinNew || (newReveals === fallbackMinNew && confirmedKnown > fallbackConfirmed))) {
        fallbackMinNew = newReveals
        fallbackConfirmed = confirmedKnown
        fallbackPlayerId = hint.player_id
      }
    }

    const selectedPlayerId = bestPlayerId || fallbackPlayerId || hints[0].player_id

    // Pobierz daily player_id + dane obu graczy + kariery równolegle
    const { data: dailyPlayer, error: dailyError } = await supabase
      .from('daily_players')
      .select('player_id')
      .eq('date', date)
      .single()

    if (dailyError || !dailyPlayer) {
      return NextResponse.json({ success: false, error: 'No player set for this date' }, { status: 404 })
    }

    const answerPlayerId = dailyPlayer.player_id

    // Pobierz dane obu graczy i kariery równolegle (4 zapytania → Promise.all)
    const [guessedResult, answerResult, guessCareer, answerCareer] = await Promise.all([
      fetchPlayerWithClub(selectedPlayerId),
      fetchPlayerWithClub(answerPlayerId),
      fetchCareerHistory(selectedPlayerId),
      fetchCareerHistory(answerPlayerId),
    ])

    if (!guessedResult.player || !answerResult.player) {
      return NextResponse.json({ success: false, error: 'Failed to fetch player data' }, { status: 500 })
    }

    const guessedPlayer = withCurrentAge(guessedResult.player)
    const answerPlayer = withCurrentAge(answerResult.player)

    // Porównaj – zwróć pełny GuessResult
    const result = compareGuess(guessedPlayer, answerPlayer, guessCareer, answerCareer)
    result.isHint = true

    // Przy poprawnej odpowiedzi dodaj kariery do answer
    if (result.correct && result.answer) {
      result.answer.career_clubs = Array.from(new Set(
        answerCareer.map(c => c.club_name).filter((n): n is string => Boolean(n))
      ))
      result.answer.career_leagues = Array.from(new Set(
        answerCareer.map(c => c.league).filter((l): l is string => Boolean(l))
      ))
    }

    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('Error in hint API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Pomocnicza funkcja do pobierania zawodnika z klubem
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

// Pomocnicza funkcja do pobierania historii kariery
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

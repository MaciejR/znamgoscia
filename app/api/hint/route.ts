import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player } from '@/lib/types'

interface HintRequestBody {
  date: string
  alreadyGuessedIds?: number[]
  knownAttributes?: Record<string, boolean>
  knownClubs?: string[]
  knownLeagues?: string[]
}

interface HintResponse {
  success: boolean
  hint?: { player: Player }
  error?: string
}

// POST /api/hint – wybierz podpowiedź z precomputowanej puli daily_hints
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

    // Pobierz precomputowane podpowiedzi dla dnia
    const { data: hints, error: hintsError } = await supabase
      .from('daily_hints')
      .select('player_id, matching_attributes, matching_clubs, matching_leagues')
      .eq('date', date)

    if (hintsError || !hints || hints.length === 0) {
      return NextResponse.json({ success: false, error: 'No hints available for this date' }, { status: 404 })
    }

    // Filtruj: wyklucz już zgadniętych
    const excludeSet = new Set(alreadyGuessedIds)
    const available = hints.filter(h => !excludeSet.has(h.player_id))

    if (available.length === 0) {
      return NextResponse.json({ success: false, error: 'No more hints available' }, { status: 404 })
    }

    // Zbiory znanych atrybutów (5 skalarnych) + granularne kluby/ligi
    const knownKeys = new Set(
      Object.entries(knownAttributes).filter(([, v]) => v).map(([k]) => k)
    )
    const knownClubSet = new Set(knownClubs.map(c => c.toLowerCase()))
    const knownLeagueSet = new Set(knownLeagues.map(l => l.toLowerCase()))

    // Oblicz newReveals i confirmedKnown dla kandydata
    function scoreCandidate(hint: typeof available[0]) {
      const attrs: string[] = hint.matching_attributes || []
      const matchingClubs: string[] = hint.matching_clubs || []
      const matchingLeagues: string[] = hint.matching_leagues || []

      let newReveals = 0
      let confirmedKnown = 0

      for (const a of attrs) {
        if (a === 'club_history') {
          const newClubs = matchingClubs.filter(c => !knownClubSet.has(c))
          if (newClubs.length > 0) {
            newReveals++
          } else {
            confirmedKnown++
          }
        } else if (a === 'league_history') {
          const newLeagues = matchingLeagues.filter(l => !knownLeagueSet.has(l))
          if (newLeagues.length > 0) {
            newReveals++
          } else {
            confirmedKnown++
          }
        } else if (knownKeys.has(a)) {
          confirmedKnown++
        } else {
          newReveals++
        }
      }

      return { newReveals, confirmedKnown }
    }

    // Wybierz kandydata ujawniającego dokładnie 1 nowy atrybut
    let bestScore = -Infinity
    let bestPlayerId: number | null = null

    for (const hint of available) {
      const { newReveals, confirmedKnown } = scoreCandidate(hint)

      if (newReveals !== 1) continue

      if (confirmedKnown > bestScore) {
        bestScore = confirmedKnown
        bestPlayerId = hint.player_id
      }
    }

    if (!bestPlayerId) {
      // Fallback: weź kandydata z najmniejszą liczbą nowych (>0)
      let minNew = Infinity
      let fallbackConfirmed = -1
      for (const hint of available) {
        const { newReveals, confirmedKnown } = scoreCandidate(hint)
        if (newReveals > 0 && (newReveals < minNew || (newReveals === minNew && confirmedKnown > fallbackConfirmed))) {
          minNew = newReveals
          fallbackConfirmed = confirmedKnown
          bestPlayerId = hint.player_id
        }
      }
      if (!bestPlayerId) {
        bestPlayerId = available[0].player_id
      }
    }

    // Pobierz dane gracza
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select(`
        id, name, name_normalized, birth_date, age, nationality, nationality_code,
        position, position_detailed, jersey_number, market_value, photo_url,
        transfermarkt_id, is_active, current_club_id,
        clubs (id, name, name_short, league, logo_url)
      `)
      .eq('id', bestPlayerId)
      .single()

    if (playerError || !playerData) {
      return NextResponse.json({ success: false, error: 'Failed to fetch hint player' }, { status: 500 })
    }

    const clubData = playerData.clubs
    const club = (Array.isArray(clubData) ? clubData[0] : clubData) as Record<string, unknown> | null

    const player: Player = {
      ...playerData,
      club_name: club?.name as string | undefined,
      club_short: club?.name_short as string | undefined,
      club_league: club?.league as string | undefined,
      club_logo: club?.logo_url as string | undefined,
    } as Player

    return NextResponse.json({ success: true, hint: { player } })

  } catch (error) {
    console.error('Error in hint API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

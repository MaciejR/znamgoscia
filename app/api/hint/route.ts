import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player } from '@/lib/types'

interface GuessedHints {
  nationality?: boolean
  career_status?: boolean
  position?: boolean
  position_detailed?: boolean
  club_history?: boolean
  league_history?: boolean
  age?: boolean
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

// POST /api/hint – wybierz podpowiedź z precomputowanej puli daily_hints
export async function POST(request: NextRequest): Promise<NextResponse<HintResponse>> {
  try {
    const body: HintRequestBody = await request.json()
    const { date, alreadyGuessedIds = [], knownAttributes = {} } = body

    if (!date) {
      return NextResponse.json({ success: false, error: 'Missing required field: date' }, { status: 400 })
    }

    // Pobierz precomputowane podpowiedzi dla dnia
    const { data: hints, error: hintsError } = await supabase
      .from('daily_hints')
      .select('player_id, matching_attributes')
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

    // Ile nowych atrybutów chcemy ujawnić?
    const known = knownAttributes
    const knownKeys = new Set(
      Object.entries(known).filter(([, v]) => v).map(([k]) => k)
    )
    const knownCount = knownKeys.size
    const targetNewReveals = knownCount <= 2 ? 1 : knownCount <= 4 ? 2 : 3

    // Scoring: wybierz kandydata najbliższego targetNewReveals nowych atrybutów
    let bestScore = -Infinity
    let bestPlayerId: number | null = null

    for (const hint of available) {
      const attrs: string[] = hint.matching_attributes
      const newReveals = attrs.filter(a => !knownKeys.has(a)).length
      const confirmedKnown = attrs.filter(a => knownKeys.has(a)).length

      if (newReveals === 0) continue

      const revealScore = 10 - Math.abs(newReveals - targetNewReveals) * 3
      const confirmScore = confirmedKnown * 0.5
      const score = revealScore + confirmScore

      if (score > bestScore) {
        bestScore = score
        bestPlayerId = hint.player_id
      }
    }

    if (!bestPlayerId) {
      // Fallback: weź dowolnego z nowymi atrybutami
      const withNew = available.filter(h =>
        (h.matching_attributes as string[]).some(a => !knownKeys.has(a))
      )
      if (withNew.length > 0) {
        bestPlayerId = withNew[0].player_id
      } else {
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player } from '@/lib/types'

// Typy obszarów do porównania
type HintField = 'nationality' | 'position' | 'club' | 'league' | 'age'

interface HintRequestBody {
  date: string
  matchedFields: HintField[] // obszary które już mają zgodność
}

interface HintResponse {
  success: boolean
  hint?: {
    player: Player
    matchedField: HintField
    matchedValue: string
  }
  noHintsAvailable?: boolean
  error?: string
}

// POST /api/hint - pobierz wskazówkę
export async function POST(request: NextRequest): Promise<NextResponse<HintResponse>> {
  try {
    const body: HintRequestBody = await request.json()
    const { date, matchedFields } = body

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: date' },
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
        { success: false, error: 'No player set for this date' },
        { status: 404 }
      )
    }

    const answerPlayerId = dailyPlayer.player_id

    // Pobierz dane zawodnika do odgadnięcia
    const answerPlayer = await fetchPlayerWithClub(answerPlayerId)

    if (!answerPlayer) {
      return NextResponse.json(
        { success: false, error: 'Answer player not found' },
        { status: 404 }
      )
    }

    // Wszystkie możliwe obszary
    const allFields: HintField[] = ['nationality', 'position', 'club', 'league', 'age']

    // Znajdź obszary które jeszcze nie mają zgodności
    const unmatchedFields = allFields.filter(field => !matchedFields.includes(field))

    // Jeśli wszystkie obszary są już zgodne
    if (unmatchedFields.length === 0) {
      return NextResponse.json({
        success: true,
        noHintsAvailable: true
      })
    }

    // Wybierz losowy obszar z niepasujących
    const randomField = unmatchedFields[Math.floor(Math.random() * unmatchedFields.length)]

    // Znajdź zawodnika z tym samym atrybutem
    const hintPlayer = await findPlayerWithMatchingField(answerPlayer, randomField, answerPlayerId)

    if (!hintPlayer) {
      // Spróbuj inny obszar jeśli nie znaleziono zawodnika
      for (const field of unmatchedFields) {
        if (field === randomField) continue
        const player = await findPlayerWithMatchingField(answerPlayer, field, answerPlayerId)
        if (player) {
          return NextResponse.json({
            success: true,
            hint: {
              player: player,
              matchedField: field,
              matchedValue: getFieldValue(answerPlayer, field)
            }
          })
        }
      }

      // Jeśli żaden obszar nie ma pasującego zawodnika
      return NextResponse.json({
        success: true,
        noHintsAvailable: true
      })
    }

    return NextResponse.json({
      success: true,
      hint: {
        player: hintPlayer,
        matchedField: randomField,
        matchedValue: getFieldValue(answerPlayer, randomField)
      }
    })

  } catch (error) {
    console.error('Error in hint API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Pobierz zawodnika z klubem
async function fetchPlayerWithClub(playerId: number): Promise<Player | null> {
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
    return null
  }

  const club = data.clubs as Record<string, unknown> | null

  return {
    ...data,
    club_name: club?.name as string | undefined,
    club_short: club?.name_short as string | undefined,
    club_league: club?.league as string | undefined,
    club_logo: club?.logo_url as string | undefined,
  } as Player
}

// Znajdź losowego zawodnika z pasującym polem
async function findPlayerWithMatchingField(
  answerPlayer: Player,
  field: HintField,
  excludePlayerId: number
): Promise<Player | null> {
  let query = supabase
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
    .neq('id', excludePlayerId)
    .eq('is_active', true)

  // Dodaj filtr w zależności od pola
  switch (field) {
    case 'nationality':
      query = query.eq('nationality', answerPlayer.nationality)
      break
    case 'position':
      query = query.eq('position', answerPlayer.position)
      break
    case 'club':
      if (answerPlayer.current_club_id) {
        query = query.eq('current_club_id', answerPlayer.current_club_id)
      } else {
        return null
      }
      break
    case 'league':
      // Potrzebujemy join na kluby dla ligi
      if (answerPlayer.club_league) {
        const { data: clubsData } = await supabase
          .from('clubs')
          .select('id')
          .eq('league', answerPlayer.club_league)

        if (clubsData && clubsData.length > 0) {
          const clubIds = clubsData.map(c => c.id)
          query = query.in('current_club_id', clubIds)
        } else {
          return null
        }
      } else {
        return null
      }
      break
    case 'age':
      if (answerPlayer.age) {
        query = query.eq('age', answerPlayer.age)
      } else {
        return null
      }
      break
  }

  // Pobierz losowego zawodnika
  const { data, error } = await query.limit(50)

  if (error || !data || data.length === 0) {
    return null
  }

  // Wybierz losowego z wyników
  const randomIndex = Math.floor(Math.random() * data.length)
  const randomPlayer = data[randomIndex]
  const club = randomPlayer.clubs as Record<string, unknown> | null

  return {
    ...randomPlayer,
    club_name: club?.name as string | undefined,
    club_short: club?.name_short as string | undefined,
    club_league: club?.league as string | undefined,
    club_logo: club?.logo_url as string | undefined,
  } as Player
}

// Pobierz wartość pola
function getFieldValue(player: Player, field: HintField): string {
  switch (field) {
    case 'nationality':
      return player.nationality
    case 'position':
      return player.position
    case 'club':
      return player.club_name || ''
    case 'league':
      return player.club_league || ''
    case 'age':
      return player.age?.toString() || ''
  }
}

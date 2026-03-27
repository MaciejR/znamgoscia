import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCurrentAge } from '@/lib/utils'
import { Player } from '@/lib/types'

// GET /api/daily - pobierz dzisiejszego zawodnika
// GET /api/daily?date=2024-01-15 - pobierz zawodnika z konkretnego dnia
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')

    const reveal = searchParams.get('reveal') === 'true'

    // Użyj podanej daty lub dzisiejszej
    const date = dateParam || new Date().toISOString().split('T')[0]

    // Sprawdź czy to data przeszła
    const today = new Date().toISOString().split('T')[0]
    const isPastDate = date < today

    // Pobierz dziennego zawodnika
    const { data: dailyPlayer, error: dailyError } = await supabase
      .from('daily_players')
      .select(`
        id,
        date,
        player_id,
        players (
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
          current_club_id,
          clubs (
            id,
            name,
            name_short,
            league,
            logo_url
          )
        )
      `)
      .eq('date', date)
      .single()

    if (dailyError && dailyError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching daily player:', dailyError)
      return NextResponse.json(
        { error: 'Failed to fetch daily player' },
        { status: 500 }
      )
    }

    // Jeśli nie ma zawodnika na ten dzień
    if (!dailyPlayer) {
      return NextResponse.json({
        date,
        playerExists: false,
        message: 'No player set for this date'
      })
    }

    // Dla dat przeszłych lub reveal=true zwróć pełne dane zawodnika
    if (isPastDate || reveal) {
      const player = dailyPlayer.players as unknown as Record<string, unknown>
      const club = player?.clubs as unknown as Record<string, unknown>

      const playerData = withCurrentAge({
        id: player?.id,
        name: player?.name,
        age: player?.age,
        birth_date: player?.birth_date,
        nationality: player?.nationality,
      } as Player)

      // Jeśli gracz nie ma klubu w tabeli clubs, pobierz ostatni z kariery
      let clubName = club?.name as string | undefined
      let clubShort = club?.name_short as string | undefined
      let clubLeague = club?.league as string | undefined
      let clubLogo = club?.logo_url as string | undefined

      // Pobierz pełną historię kariery
      const { data: careerData } = await supabase
        .from('career_history')
        .select('club_name, league')
        .eq('player_id', player.id as number)
        .order('season_start', { ascending: false })

      if (!clubName && careerData && careerData.length > 0) {
        const firstWithClub = careerData.find(c => c.club_name)
        if (firstWithClub) {
          clubName = firstWithClub.club_name
          clubLeague = firstWithClub.league
        }
      }

      // Unikalne kluby i ligi z kariery
      const careerClubs = [...new Set(
        (careerData || []).map(c => c.club_name).filter((n): n is string => Boolean(n))
      )]
      const careerLeagues = [...new Set(
        (careerData || []).map(c => c.league).filter((l): l is string => Boolean(l))
      )]

      return NextResponse.json({
        date,
        playerExists: true,
        player: {
          id: player?.id,
          name: player?.name,
          age: playerData.age,
          nationality: player?.nationality,
          nationality_code: player?.nationality_code,
          position: player?.position,
          position_detailed: player?.position_detailed,
          jersey_number: player?.jersey_number,
          market_value: player?.market_value,
          photo_url: player?.photo_url,
          club_name: clubName,
          club_short: clubShort,
          club_league: clubLeague,
          club_logo: clubLogo,
          career_clubs: careerClubs,
          career_leagues: careerLeagues,
        }
      })
    }

    // Dla dzisiejszej daty nie zwracaj danych zawodnika
    return NextResponse.json({
      date,
      playerExists: true,
    })

  } catch (error) {
    console.error('Error in daily API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

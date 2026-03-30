import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

interface StatsRequestBody {
  date: string
  guesses_count: number
  won: boolean
  session_id?: string
  user_id?: string
}

// POST /api/stats - zapisz statystyki gry
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const body: StatsRequestBody = await request.json()
    const { date, guesses_count, won, session_id, user_id } = body

    if (!date || guesses_count === undefined || won === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Zapisz statystyki pojedynczej gry
    const { error } = await supabase
      .from('game_stats')
      .insert({
        date,
        guesses_count,
        won,
        session_id: session_id || null,
        user_id: user_id || null,
      })

    if (error) {
      console.error('Error saving stats:', error)
      return NextResponse.json(
        { error: 'Failed to save stats' },
        { status: 500 }
      )
    }

    // Aktualizacja user_statistics dla zalogowanych użytkowników jest obsługiwana
    // automatycznie przez trigger bazodanowy `on_game_stats_insert`
    // (zdefiniowany w migracji 002_add_user_authentication.sql)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/stats?date=YYYY-MM-DD - pobierz statystyki dnia (agregacja w bazie danych)
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: 'Missing required parameter: date' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('get_daily_stats', {
      target_date: date,
    })

    if (error) {
      console.error('Error fetching daily stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      )
    }

    const stats = data || {
      totalGames: 0,
      wonGames: 0,
      winRate: 0,
      avgGuesses: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    }

    const response = NextResponse.json({
      date,
      ...stats,
    })
    // Stats dzienne zmieniają się rzadko — cache 5 minut
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    return response

  } catch (error) {
    console.error('Error in stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
    const body: StatsRequestBody = await request.json()
    const { date, guesses_count, won, session_id, user_id } = body

    if (!date || guesses_count === undefined || won === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Zapisz statystyki
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

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/stats - pobierz globalne statystyki
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')

    // Statystyki dla konkretnego dnia
    if (date) {
      const { data, error } = await supabase
        .from('game_stats')
        .select('guesses_count, won')
        .eq('date', date)

      if (error) {
        console.error('Error fetching stats:', error)
        return NextResponse.json(
          { error: 'Failed to fetch stats' },
          { status: 500 }
        )
      }

      const totalGames = data?.length || 0
      const wonGames = data?.filter(g => g.won).length || 0
      const avgGuesses = data && data.length > 0
        ? data.filter(g => g.won).reduce((sum, g) => sum + g.guesses_count, 0) / wonGames
        : 0

      // Rozkład prób
      const distribution = new Array(8).fill(0)
      data?.filter(g => g.won).forEach(g => {
        if (g.guesses_count >= 1 && g.guesses_count <= 8) {
          distribution[g.guesses_count - 1]++
        }
      })

      return NextResponse.json({
        date,
        totalGames,
        wonGames,
        winRate: totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0,
        avgGuesses: Math.round(avgGuesses * 10) / 10,
        distribution,
      })
    }

    // Ogólne statystyki
    const { data, error } = await supabase
      .from('game_stats')
      .select('guesses_count, won')

    if (error) {
      console.error('Error fetching stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      )
    }

    const totalGames = data?.length || 0
    const wonGames = data?.filter(g => g.won).length || 0

    return NextResponse.json({
      totalGames,
      wonGames,
      winRate: totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0,
    })

  } catch (error) {
    console.error('Error in stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

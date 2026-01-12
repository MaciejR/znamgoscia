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

    // Dla zalogowanych użytkowników - zaktualizuj zbiorczą tabelę user_statistics
    if (user_id) {
      // Pobierz aktualne statystyki użytkownika
      const { data: currentStats } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', user_id)
        .single()

      if (currentStats) {
        // Aktualizuj istniejące statystyki
        const newGamesPlayed = (currentStats.games_played || 0) + 1
        const newGamesWon = (currentStats.games_won || 0) + (won ? 1 : 0)
        const newCurrentStreak = won ? (currentStats.current_streak || 0) + 1 : 0
        const newMaxStreak = Math.max(currentStats.max_streak || 0, newCurrentStreak)

        // Aktualizuj rozkład prób
        const guessDistribution = currentStats.guess_distribution || [0, 0, 0, 0, 0, 0, 0, 0]
        if (won && guesses_count >= 1 && guesses_count <= 8) {
          guessDistribution[guesses_count - 1]++
        }

        const { error: updateError } = await supabase
          .from('user_statistics')
          .update({
            games_played: newGamesPlayed,
            games_won: newGamesWon,
            current_streak: newCurrentStreak,
            max_streak: newMaxStreak,
            guess_distribution: guessDistribution,
          })
          .eq('user_id', user_id)

        if (updateError) {
          console.error('Error updating user statistics:', updateError)
        }
      } else {
        // Utwórz nowy rekord statystyk
        const guessDistribution = [0, 0, 0, 0, 0, 0, 0, 0]
        if (won && guesses_count >= 1 && guesses_count <= 8) {
          guessDistribution[guesses_count - 1] = 1
        }

        const { error: insertError } = await supabase
          .from('user_statistics')
          .insert({
            user_id,
            games_played: 1,
            games_won: won ? 1 : 0,
            current_streak: won ? 1 : 0,
            max_streak: won ? 1 : 0,
            guess_distribution: guessDistribution,
          })

        if (insertError) {
          console.error('Error inserting user statistics:', insertError)
        }
      }
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
    const supabase = getServiceSupabase()
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

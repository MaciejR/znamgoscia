import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/user-stats?user_id=xxx - pobierz statystyki użytkownika
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Pobierz statystyki użytkownika z tabeli user_statistics
    const { data: userStats, error: statsError } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (statsError) {
      console.error('Error fetching user statistics:', statsError)

      // Jeśli użytkownik nie ma jeszcze statystyk, zwróć puste dane
      if (statsError.code === 'PGRST116') {
        return NextResponse.json({
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          guessDistribution: [0, 0, 0, 0, 0, 0, 0, 0],
        })
      }

      return NextResponse.json(
        { error: 'Failed to fetch user statistics' },
        { status: 500 }
      )
    }

    // Konwertuj format z bazy danych na format UserStats
    return NextResponse.json({
      gamesPlayed: userStats.games_played || 0,
      gamesWon: userStats.games_won || 0,
      currentStreak: userStats.current_streak || 0,
      maxStreak: userStats.max_streak || 0,
      guessDistribution: userStats.guess_distribution || [0, 0, 0, 0, 0, 0, 0, 0],
    })

  } catch (error) {
    console.error('Error in user-stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

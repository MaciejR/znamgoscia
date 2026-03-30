import { NextRequest, NextResponse } from 'next/server'
import { compareGuess } from '@/lib/game-logic'
import { withCurrentAge } from '@/lib/utils'
import { getAnswerCache, getCachedPlayer, fetchCareerHistory } from '@/lib/answer-cache'

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

    // Answer player z cache (wspólny dla wszystkich graczy w danym dniu)
    const cache = await getAnswerCache(date)
    if (!cache) {
      return NextResponse.json(
        { error: 'No player set for this date' },
        { status: 404 }
      )
    }

    // Guessed player: dane + kariera równolegle
    // Jeśli zgadywany == answer, użyj danych z cache
    let guessedPlayer
    let guessCareer

    if (guessedPlayerId === cache.answerPlayerId) {
      guessedPlayer = cache.answerPlayer
      guessCareer = cache.answerCareer
    } else {
      const [player, career] = await Promise.all([
        getCachedPlayer(guessedPlayerId),
        fetchCareerHistory(guessedPlayerId),
      ])

      if (!player) {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        )
      }

      guessedPlayer = withCurrentAge(player)
      guessCareer = career
    }

    // Porównaj strzał z odpowiedzią
    const result = compareGuess(
      guessedPlayer,
      cache.answerPlayer,
      guessCareer,
      cache.answerCareer
    )

    // Przy poprawnej odpowiedzi dodaj kariery do answer
    if (result.correct && result.answer) {
      result.answer.career_clubs = cache.answerUniqueClubs
      result.answer.career_leagues = cache.answerUniqueLeagues
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

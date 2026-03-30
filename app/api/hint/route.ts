import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Player, CareerEntry, GuessResult, Hint } from '@/lib/types'
import { withCurrentAge } from '@/lib/utils'
import { getAnswerCache, getCachedPlayer } from '@/lib/answer-cache'

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

// ── Cache hintów dnia (prekomputowane matching attributes) ──

interface DailyHint {
  player_id: number
  matching_attributes: string[]
  matching_clubs: string[]
  matching_leagues: string[]
}

interface HintsCache {
  date: string
  hints: DailyHint[]
  timestamp: number
}

let hintsCache: HintsCache | null = null
const HINTS_CACHE_TTL = 5 * 60 * 1000 // 5 minut

async function getDailyHints(date: string): Promise<DailyHint[] | null> {
  if (hintsCache && hintsCache.date === date && Date.now() - hintsCache.timestamp < HINTS_CACHE_TTL) {
    return hintsCache.hints
  }

  const { data, error } = await supabase
    .from('daily_hints')
    .select('player_id, matching_attributes, matching_clubs, matching_leagues')
    .eq('date', date)

  if (error || !data?.length) {
    return null
  }

  hintsCache = {
    date,
    hints: data as DailyHint[],
    timestamp: Date.now(),
  }

  return hintsCache.hints
}

// ── Budowanie GuessResult z prekomputowanych danych (bez kariery!) ──

function compareField(guessValue: string, answerValue: string): Hint {
  if (!guessValue && !answerValue) return { status: 'correct', value: '-' }
  const isCorrect = guessValue.toLowerCase() === answerValue.toLowerCase()
  return { status: isCorrect ? 'correct' : 'wrong', value: guessValue || '-' }
}

function compareAge(guessAge: number | null, answerAge: number | null): Hint {
  if (guessAge == null || answerAge == null) {
    return { status: 'wrong', value: guessAge != null ? String(guessAge) : '?' }
  }
  const diff = guessAge - answerAge
  if (diff === 0) return { status: 'correct', value: guessAge }
  if (Math.abs(diff) <= 3) {
    return { status: 'close', value: guessAge, direction: diff > 0 ? 'lower' : 'higher' }
  }
  return { status: 'wrong', value: guessAge, direction: diff > 0 ? 'lower' : 'higher' }
}

function buildHintResult(
  guessedPlayer: Player,
  answerPlayer: Player,
  matchingClubs: string[],
  matchingLeagues: string[],
): GuessResult {
  const isCorrect = guessedPlayer.id === answerPlayer.id

  const nationalityHint = compareField(guessedPlayer.nationality, answerPlayer.nationality)
  const careerStatusHint = compareField(
    guessedPlayer.is_active ? 'Aktywny' : 'Zakończona',
    answerPlayer.is_active ? 'Aktywny' : 'Zakończona'
  )
  const positionHint = compareField(guessedPlayer.position, answerPlayer.position)
  const positionDetailedHint = compareField(
    guessedPlayer.position_detailed || '',
    answerPlayer.position_detailed || ''
  )
  const clubHistoryHint: Hint = {
    status: matchingClubs.length > 0 ? 'correct' : 'wrong',
    value: matchingClubs.length > 0 ? matchingClubs.join(', ') : 'Nie',
  }
  const leagueHistoryHint: Hint = {
    status: matchingLeagues.length > 0 ? 'correct' : 'wrong',
    value: matchingLeagues.length > 0 ? matchingLeagues.join(', ') : 'Nie',
  }
  const ageHint = compareAge(guessedPlayer.age, answerPlayer.age)

  const allHints = [nationalityHint, careerStatusHint, positionHint, positionDetailedHint, clubHistoryHint, leagueHistoryHint, ageHint]
  const matchCount = allHints.filter(h => h.status === 'correct').length
  const matchPercentage = isCorrect ? 100 : Math.round((matchCount / 7) * 100)

  return {
    correct: isCorrect,
    guessedPlayer,
    matchPercentage,
    hints: {
      nationality: nationalityHint,
      career_status: careerStatusHint,
      position: positionHint,
      position_detailed: positionDetailedHint,
      club_history: clubHistoryHint,
      league_history: leagueHistoryHint,
      age: ageHint,
    },
    answer: isCorrect ? answerPlayer : undefined,
  }
}

// ── GET /api/hint?date=YYYY-MM-DD — rozgrzewka cache (fire & forget z klienta) ──

export async function GET(request: NextRequest): Promise<NextResponse> {
  const date = request.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ success: false, error: 'Missing date' }, { status: 400 })
  }

  // Rozgrzej oba cache równolegle
  const [hints, answer] = await Promise.all([
    getDailyHints(date),
    getAnswerCache(date),
  ])

  return NextResponse.json({ success: !!(hints && answer), cached: !!(hints && answer) })
}

// ── POST /api/hint ──

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

    // Pobierz hinty i answer z cache równolegle
    const [hints, answerData] = await Promise.all([
      getDailyHints(date),
      getAnswerCache(date),
    ])

    if (!hints || !answerData) {
      return NextResponse.json({ success: false, error: 'No hints available for this date' }, { status: 404 })
    }

    // Filtruj already guessed w pamięci (hinty już są w cache)
    const excludeSet = new Set(alreadyGuessedIds)
    const available = excludeSet.size > 0
      ? hints.filter(h => !excludeSet.has(h.player_id))
      : hints

    if (available.length === 0) {
      return NextResponse.json({ success: false, error: 'No more hints available' }, { status: 404 })
    }

    // Zbiory znanych atrybutów
    const knownKeys = new Set(
      Object.entries(knownAttributes).filter(([, v]) => v).map(([k]) => k)
    )
    const knownClubSet = new Set(knownClubs.map(c => c.toLowerCase()))
    const knownLeagueSet = new Set(knownLeagues.map(l => l.toLowerCase()))

    // Scoring – jedna iteracja z early termination
    let bestHint: DailyHint | null = null
    let bestScore = -Infinity

    let fallbackHint: DailyHint | null = null
    let fallbackMinNew = Infinity
    let fallbackConfirmed = -1

    for (const hint of available) {
      const attrs = hint.matching_attributes
      const matchingClubs = hint.matching_clubs
      const matchingLeagues = hint.matching_leagues
      const maxPossibleConfirmed = attrs.length - 1

      let newReveals = 0
      let confirmedKnown = 0

      for (const a of attrs) {
        if (a === 'club_history') {
          if (matchingClubs.some(c => !knownClubSet.has(c))) newReveals++
          else confirmedKnown++
        } else if (a === 'league_history') {
          if (matchingLeagues.some(l => !knownLeagueSet.has(l))) newReveals++
          else confirmedKnown++
        } else if (knownKeys.has(a)) {
          confirmedKnown++
        } else {
          newReveals++
        }
        // Prune: jeśli już mamy >1 nowy atrybut i nie poprawi primary score — skip
        if (newReveals > 1 && bestHint !== null) break
      }

      if (newReveals === 1 && confirmedKnown > bestScore) {
        bestScore = confirmedKnown
        bestHint = hint
        // Early termination: idealny wynik (1 nowy + wszystkie inne potwierdzone)
        if (confirmedKnown === maxPossibleConfirmed) break
      }

      if (newReveals > 0 && (newReveals < fallbackMinNew || (newReveals === fallbackMinNew && confirmedKnown > fallbackConfirmed))) {
        fallbackMinNew = newReveals
        fallbackConfirmed = confirmedKnown
        fallbackHint = hint
      }
    }

    const selectedHint = bestHint || fallbackHint || available[0]
    const selectedPlayerId = selectedHint.player_id

    // Pobierz tylko dane gracza (bez kariery! — klub/liga z prekomputowanych danych)
    let guessedPlayer: Player

    if (selectedPlayerId === answerData.answerPlayerId) {
      guessedPlayer = answerData.answerPlayer
    } else {
      const player = await getCachedPlayer(selectedPlayerId)
      if (!player) {
        return NextResponse.json({ success: false, error: 'Failed to fetch hint player' }, { status: 500 })
      }
      guessedPlayer = withCurrentAge(player)
    }

    // Zbuduj wynik z prekomputowanych danych (bez compareGuess, bez career fetch)
    const result = buildHintResult(
      guessedPlayer,
      answerData.answerPlayer,
      selectedHint.matching_clubs,
      selectedHint.matching_leagues,
    )
    result.isHint = true

    if (result.correct && result.answer) {
      result.answer.career_clubs = answerData.answerUniqueClubs
      result.answer.career_leagues = answerData.answerUniqueLeagues
    }

    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('Error in hint API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

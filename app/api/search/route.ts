import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeString, normalizePositionDetailed } from '@/lib/utils'
import { SearchResult } from '@/lib/types'

// Cache dla wyników wyszukiwania (5 minut)
const searchCache = new Map<string, { data: SearchResult[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minut

// GET /api/search?q=lewan&limit=10
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!query || query.length < 2) {
      return NextResponse.json({ players: [] })
    }

    // Normalizuj zapytanie
    const normalizedQuery = normalizeString(query)
    const cacheKey = `${normalizedQuery}:${limit}`

    // Sprawdź cache
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ players: cached.data })
    }

    // Dwa równoległe zapytania: prefix (trafniejszy) + contains (reszta)
    const selectFields = 'id, name, position_detailed, nationality_code'
    const [prefixResult, containsResult] = await Promise.all([
      supabase
        .from('players')
        .select(selectFields)
        .ilike('name_normalized', `${normalizedQuery}%`)
        .order('market_value', { ascending: false, nullsFirst: false })
        .limit(limit),
      supabase
        .from('players')
        .select(selectFields)
        .ilike('name_normalized', `%${normalizedQuery}%`)
        .not('name_normalized', 'ilike', `${normalizedQuery}%`)
        .order('market_value', { ascending: false, nullsFirst: false })
        .limit(limit),
    ])

    if (prefixResult.error && containsResult.error) {
      console.error('Search error:', prefixResult.error)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // Merge: prefix matches first, then contains, up to limit
    const prefixData = prefixResult.data || []
    const containsData = containsResult.data || []
    const merged = [...prefixData, ...containsData].slice(0, limit)

    const players: SearchResult[] = merged.map(player => ({
      id: player.id,
      name: player.name,
      position_detailed: normalizePositionDetailed(player.position_detailed),
      nationality_code: player.nationality_code,
    }))

    // Zapisz w cache
    searchCache.set(cacheKey, { data: players, timestamp: Date.now() })

    // Czyszczenie starych wpisów z cache (co 100 requestów)
    if (searchCache.size > 100) {
      const now = Date.now()
      Array.from(searchCache.entries()).forEach(([key, value]) => {
        if (now - value.timestamp > CACHE_TTL) {
          searchCache.delete(key)
        }
      })
    }

    const response = NextResponse.json({ players })
    // Wyniki wyszukiwania stabilne — cache 5 min na CDN
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    return response

  } catch (error) {
    console.error('Error in search API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

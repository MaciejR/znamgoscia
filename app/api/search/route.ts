import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeString } from '@/lib/utils'
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

    // Wyszukaj zawodników
    const { data, error } = await supabase
      .from('players')
      .select(`
        id,
        name,
        position_detailed,
        nationality_code
      `)
      .ilike('name_normalized', `%${normalizedQuery}%`)
      .order('name')
      .limit(limit)

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // Formatuj wyniki
    const players: SearchResult[] = (data || []).map(player => {
      return {
        id: player.id,
        name: player.name,
        position_detailed: player.position_detailed,
        nationality_code: player.nationality_code,
      }
    })

    // Sortuj - dokładne dopasowanie na początku
    players.sort((a, b) => {
      const aExact = normalizeString(a.name).startsWith(normalizedQuery)
      const bExact = normalizeString(b.name).startsWith(normalizedQuery)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })

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

    return NextResponse.json({ players })

  } catch (error) {
    console.error('Error in search API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

// In-memory store for rate limiting (resets on cold start)
// For production scale, replace with Upstash Redis
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

interface RateLimitRule {
  windowMs: number
  max: number
}

const RULES: Record<string, RateLimitRule> = {
  '/api/guess':  { windowMs: 60_000, max: 30 },
  '/api/search': { windowMs: 60_000, max: 60 },
  '/api/hint':   { windowMs: 60_000, max: 20 },
  '/api/stats':  { windowMs: 60_000, max: 40 },
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(key: string, rule: RateLimitRule): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + rule.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: rule.max - 1, resetAt }
  }

  if (entry.count >= rule.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: rule.max - entry.count, resetAt: entry.resetAt }
}

// Periodically clean up expired entries to prevent memory growth
function pruneExpiredEntries() {
  const now = Date.now()
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) rateLimitStore.delete(key)
  })
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const rule = RULES[pathname]

  if (!rule) return NextResponse.next()

  if (rateLimitStore.size > 10_000) pruneExpiredEntries()

  const ip = getClientIP(req)
  const key = `${pathname}:${ip}`
  const { allowed, remaining, resetAt } = checkRateLimit(key, rule)

  const headers = {
    'X-RateLimit-Limit': String(rule.max),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Spróbuj ponownie za chwilę.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          ...headers,
        },
      }
    )
  }

  const response = NextResponse.next()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export const config = {
  matcher: ['/api/guess', '/api/search', '/api/hint', '/api/stats'],
}

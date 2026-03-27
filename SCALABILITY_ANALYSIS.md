# Analiza skalowalności – Znam Gościa

## Podsumowanie

Aplikacja działa dobrze przy umiarkowanym ruchu, ale ma kilka krytycznych punktów, które staną się wąskimi gardłami przy wzroście liczby użytkowników. Poniżej analiza od najpoważniejszych problemów.

---

## 1. KRYTYCZNE – `GET /api/stats` bez parametru `date`

**Problem:** Endpoint pobiera **całą tabelę `game_stats`** do pamięci i oblicza statystyki po stronie serwera (JavaScript).

```typescript
// app/api/stats/route.ts
const { data } = await supabase
  .from('game_stats')
  .select('guesses_count, won')
  // BRAK WHERE – pełny table scan
```

**Wpływ:**
- Przy 10k gier: ~OK (kilkaset KB)
- Przy 100k gier: odczuwalne spowolnienie (kilka MB transferu z DB)
- Przy 1M gier: timeout lub OOM na serverless function (Vercel limit 50MB heap)

**Rozwiązanie:**
- Przenieść agregację do bazy danych (SQL `GROUP BY`, `COUNT`, `AVG`)
- Lub utrzymywać tabelę podsumowującą (materialized view / summary table aktualizowana triggerem)
- Dodać `Cache-Control: s-maxage=300` – statystyki globalne nie muszą być real-time

---

## 2. KRYTYCZNE – `POST /api/hint` – ciężkie obliczenia per request

**Problem:** Każde kliknięcie "Podpowiedź" powoduje:
1. Pobranie 500 kandydatów z tabeli `players` (z JOIN na `clubs`)
2. Pobranie historii kariery w batchach po 200 (do 400 graczy)
3. Scoring wszystkich 500 kandydatów w pamięci (operacje na Set, porównania stringów)

**Wpływ:**
- Przy 100 jednoczesnych żądaniach hint: ~100 × (500 players + 400 career batches) = dziesiątki tysięcy zapytań do Supabase
- Supabase free tier: limit 500 jednoczesnych połączeń (pool)
- Czas odpowiedzi: 500ms–2s nawet przy niskim ruchu

**Rozwiązanie:**
- Cache'ować dane zawodnika dnia + jego career history (nie zmienia się przez 24h)
- Zmniejszyć pulę kandydatów (np. 100 zamiast 500, z lepszym pre-filteringiem w SQL)
- Przenieść scoring do stored procedure w PostgreSQL
- Dodać Redis cache na wynik hint (klucz: `date + knownAttributes + excludeIds`)

---

## 3. WYSOKIE – Rate limiting w pamięci (middleware.ts)

**Problem:** Rate limiter używa `Map` w pamięci instancji:

```typescript
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
```

**Wpływ na Vercel serverless:**
- Każda instancja serverless ma osobną mapę → limity nie działają globalnie
- Cold start = reset limitów → atakujący może flood'ować API
- Przy autoscalingu: 10 instancji = 10× wyższy faktyczny limit

**Rozwiązanie:**
- Upstash Redis (dedykowany do rate-limitingu na Vercel) – `@upstash/ratelimit`
- Alternatywnie: Vercel Edge Config lub Cloudflare rate limiting

---

## 4. WYSOKIE – Brak cache'owania odpowiedzi API

**Problem:** Żaden endpoint nie ustawia nagłówków cache:
- Brak `Cache-Control` / `s-maxage` / `stale-while-revalidate`
- Brak ISR (Incremental Static Regeneration)
- Każde żądanie trafia do serverless function → cold start + query do DB

**Wrażliwe endpointy:**

| Endpoint | Zmienność danych | Potencjał cache |
|----------|-----------------|-----------------|
| `GET /api/daily?date=X` | Raz na dzień | `s-maxage=3600` (1h) |
| `GET /api/stats?date=X` | Co kilka minut | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/search?q=X` | Tygodniowo | `s-maxage=3600` (dane graczy rzadko się zmieniają) |

**Wpływ:** Przy 10k użytkowników dziennie, każdy robi ~3-5 zapytań API = 30k-50k cold function invocations zamiast edge cache hits.

**Rozwiązanie:**
- Dodać nagłówki `Cache-Control` do GET endpoints
- Vercel Edge Cache automatycznie honoruje `s-maxage`
- Dla `/api/daily` – rozważyć `generateStaticParams` + ISR

---

## 5. ŚREDNIE – `GET /api/stats?date=X` bez limitu

**Problem:** Pobiera wszystkie rekordy `game_stats` dla danej daty bez `LIMIT`:

```typescript
const { data } = await supabase
  .from('game_stats')
  .select('guesses_count, won')
  .eq('date', date)
```

**Wpływ:** Jeśli 50k osób gra danego dnia → 50k wierszy ładowanych do pamięci na każde żądanie statystyk.

**Rozwiązanie:**
- Agregacja w SQL: `SELECT COUNT(*), AVG(guesses_count), SUM(CASE WHEN won THEN 1 END) FROM game_stats WHERE date = $1`
- Lub tabela `daily_stats_summary` aktualizowana triggerem przy INSERT do `game_stats`

---

## 6. ŚREDNIE – Search cache per instancja

**Problem:** Cache wyszukiwania (`/api/search`) jest `Map` w pamięci z TTL 5 minut. Na Vercel serverless:
- Każda instancja ma osobny cache
- Cold start = pusty cache
- Popularne zapytania ("lew", "pod") nie są współdzielone

**Wpływ:** Przy wielu instancjach cache hit rate spada do ~10-20%.

**Rozwiązanie:**
- Upstash Redis jako shared cache layer
- Lub Vercel KV (oparty na Redis)
- Alternatywnie: nagłówek `Cache-Control: s-maxage=300` na odpowiedzi (Vercel Edge Cache)

---

## 7. ŚREDNIE – Supabase connection pooling

**Problem:** Aplikacja tworzy klienta Supabase per import (singleton w module scope):

```typescript
// lib/supabase.ts
export const supabase = createClient(url, key)
```

W środowisku serverless każda instancja tworzy nowe połączenie. Supabase free tier ma limit ~60 direct connections / 200 pooled.

**Wpływ:**
- Przy 100 jednoczesnych użytkownikach: możliwe wyczerpanie connection pool
- Hint endpoint (3-5 zapytań per request) szybko zużywa połączenia

**Rozwiązanie:**
- Upewnić się, że Supabase client używa poolera (`?pgbouncer=true` w URL)
- Rozważyć upgrade planu Supabase przy wzroście ruchu
- Zmniejszyć liczbę zapytań per request (szczególnie `/api/hint`)

---

## 8. ŚREDNIE – Race condition w `POST /api/stats`

**Problem:** Aktualizacja `user_statistics` ma pattern SELECT → UPDATE (nie atomowy):

```typescript
const { data: existing } = await supabase.select('*').eq('user_id', userId).single()
if (existing) {
  await supabase.update({...}).eq('user_id', userId)  // Race window
} else {
  await supabase.insert({...})
}
```

**Wpływ:** Przy szybkim double-click lub dwóch zakładkach: duplikaty lub utracone aktualizacje.

**Rozwiązanie:**
- Użyć `UPSERT` (`supabase.upsert()`)
- Lub polegać wyłącznie na triggerze bazodanowym (migracja 002 go definiuje) i usunąć logikę z app code

---

## 9. NISKIE – localStorage bez synchronizacji między zakładkami

**Problem:** Jeśli użytkownik otworzy grę w 2 zakładkach, obie czytają/piszą ten sam klucz localStorage bez koordynacji. Last-write-wins.

**Wpływ:** Utrata postępu gry lub zduplikowane statystyki (rzadkie, ale frustrujące).

**Rozwiązanie:**
- Listener na `window.addEventListener('storage', ...)` do synchronizacji między tabami
- Lub blokada rozgrywki gdy gra jest otwarta w innej zakładce (BroadcastChannel API)

---

## 10. NISKIE – Brak CDN cache na obrazki graczy

**Problem:** Zdjęcia graczy (Transfermarkt CDN) ładowane przez Next.js Image Optimization. Każde żądanie generuje optymalizację na serwerze.

**Wpływ:** Next.js Image Optimization ma limity na Vercel (1000 obrazków/miesiąc na free tier).

**Rozwiązanie:**
- `next/image` domyślnie cache'uje – upewnić się że `minimumCacheTTL` jest ustawiony
- Rozważyć self-hosting obrazków na Supabase Storage

---

## Macierz priorytetów

| # | Problem | Trudność naprawy | Wpływ | Priorytet |
|---|---------|-------------------|-------|-----------|
| 1 | Stats – full table scan | Niska | Krytyczny | **P0** |
| 2 | Hint – 500 kandydatów per request | Średnia | Krytyczny | **P0** |
| 3 | Rate limiting – brak distributed state | Niska | Wysoki | **P1** |
| 4 | Brak Cache-Control headers | Niska | Wysoki | **P1** |
| 5 | Stats per date – brak agregacji SQL | Niska | Średni | **P1** |
| 6 | Search cache per instancja | Niska | Średni | **P2** |
| 7 | Supabase connection pooling | Niska | Średni | **P2** |
| 8 | Race condition w stats | Niska | Średni | **P2** |
| 9 | localStorage sync | Średnia | Niski | **P3** |
| 10 | Image optimization limits | Niska | Niski | **P3** |

---

## Szacunkowe progi ruchu

| Użytkownicy dziennie | Status | Wąskie gardło |
|----------------------|--------|---------------|
| < 1 000 | OK | Brak |
| 1 000 – 5 000 | Ostrzeżenie | Stats endpoint zaczyna zwalniać |
| 5 000 – 10 000 | Problem | Hint endpoint + connection pool |
| 10 000 – 50 000 | Krytyczne | Wszystkie powyższe + rate limiting nieskuteczne |
| > 50 000 | Wymaga refaktoru | Cache layer (Redis), SQL agregacje, CDN |

---

## Quick wins (implementacja < 1 dzień)

1. **Dodać `Cache-Control` headers** do `GET /api/daily` i `GET /api/stats` – największy ROI przy minimalnym wysiłku
2. **Zamienić client-side agregację statystyk na SQL** – jeden `SELECT COUNT(*), AVG(...)` zamiast pobierania całej tabeli
3. **Cache'ować dane daily playera w hint endpoint** – ten sam gracz przez 24h, nie trzeba go pobierać za każdym razem
4. **Dodać `LIMIT` do stats query per date** – np. 10 000 rekordów max, z info "statystyki przybliżone"

# Znam Gościa – CLAUDE.md

## Przegląd projektu

Codzienny quiz piłkarski dla fanów polskiej ligi. Każdego dnia jeden zagadkowy zawodnik – aktywny lub historyczny. Gracz zgaduje wpisując nazwiska – po każdej próbie widzi 7 atrybutów i procent dopasowania. **Brak rejestracji i logowania** – wszystko anonimowo w przeglądarce (localStorage).

## Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Scraping:** Python (httpx + BeautifulSoup)

## Kluczowe zasady mechaniki

1. **Brak limitu prób** – gracz może zgadywać dowolnie wiele razy (stany: `playing`, `won`, `gave_up`).
2. **7 atrybutów porównania** (układ 2×3 + wiek):
   - Obywatelstwo (`nationality`)
   - Status kariery (`career_status`): „Aktywny" / „Zakończona"
   - Pozycja (`position`): Bramkarz / Obrońca / Pomocnik / Napastnik
   - Dokładna rola (`position_detailed`): np. „Lewy obrońca", „Środkowy napastnik"
   - Historia klubów (`club_history`): wyświetla **nazwy wspólnych klubów** (np. „Lech Poznań")
   - Historia lig (`league_history`): wyświetla **nazwy wspólnych lig** (np. „PKO BP Ekstraklasa, Süper Lig")
   - Wiek (`age`): exact = zielony, ±3 lata = żółty z kierunkiem ↑↓, dalej = czerwony
3. **Procent dopasowania** = liczba pasujących atrybutów / 7 × 100. Kolor: czerwony 0–30%, pomarańczowy 31–60%, zielony 61–100%.
4. **Karty prób** są rozwijane (ostatnia domyślnie otwarta, poprzednie zwinięte).
5. **Stały pasek dolny** z polem tekstowym + „Podpowiedź" (szary) + „Poddaj się" (czerwony).
6. **Podpowiedź** – inteligentny system celowanych podpowiedzi:
   - Analizuje które atrybuty gracz już zna (z poprzednich prób)
   - Zawsze ujawnia dokładnie **1 nowy** nieznany atrybut
   - Spośród kandydatów z 1 nowym atrybutem preferuje tego, który potwierdza najwięcej już znanych
   - Kosztuje +1 próbę, oznaczana etykietą „Podpowiedź"
7. **Poddaj się** – ujawnia odpowiedź z komunikatem „Jutro dasz radę!". Stan `gave_up` nie jest liczony jako wygrana.
8. **Wiek obliczany dynamicznie** z `birth_date` (nie statyczny) – `withCurrentAge()` w `lib/utils.ts`.
9. **Panel statystyk** (ikona 📊) – działa na każdej stronie dzięki `StatsContext`. Na stronie głównej `Game.tsx` renderuje własny modal ze świeżymi danymi; na podstronach `GlobalStatsModal` ładuje z localStorage.
10. **Udostępnianie** po wygranej: format `🇵🇱 Znam Gościa #N\n<emoji grid>\nZgadłem w X próbach!\nznamgoscia.pl`

## Pula zawodników

- **5360 graczy** w bazie (aktywni + historyczni z historii Ekstraklasy)
- **5275** z kompletem danych (age, position_detailed, nationality)
- **5161** z `birth_date` (dynamiczny wiek), reszta fallback na statyczny `age`
- **Wyszukiwanie** obejmuje wszystkich graczy; nieaktywni pokazują „Zakończona kariera"
- **Daily player** wybierany z puli graczy z kompletem danych i min. 10 występów
- **Dropdown search** pokazuje: imię i nazwisko, pozycja szczegółowa, flaga narodowości (bez zdjęcia, klubu)

## Schemat bazy danych (Supabase)

### Tabela `players`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | int | PK |
| `name` | text | Pełne imię i nazwisko |
| `name_normalized` | text | Lowercase bez polskich znaków (do wyszukiwania) |
| `birth_date` | date | Data urodzenia (do dynamicznego obliczania wieku) |
| `age` | int | Wiek (fallback gdy brak birth_date) |
| `nationality` | text | Kraj obywatelstwa |
| `nationality_code` | text | Kod ISO (3 litery) |
| `position` | text | Bramkarz / Obronca / Pomocnik / Napastnik |
| `position_detailed` | text | Dokładna rola (po polsku) |
| `is_active` | bool | Aktywny zawodnik |
| `current_club_id` | int | FK → clubs.id |
| `photo_url` | text | URL zdjęcia (ujawniane po odgadnięciu) |
| `market_value` | int | Wartość rynkowa w EUR |
| `transfermarkt_id` | text | ID zewnętrzne |

### Tabela `clubs`
| Kolumna | Typ |
|---|---|
| `id` | int |
| `name` | text |
| `name_short` | text |
| `league` | text |
| `logo_url` | text |
| `transfermarkt_id` | text |

### Tabela `career_history`
| Kolumna | Typ |
|---|---|
| `id` | int |
| `player_id` | int FK |
| `club_id` | int FK (nullable) |
| `club_name` | text |
| `league` | text |
| `season_start` | int |
| `season_end` | int |
| `appearances` | int |
| `goals` | int |

### Tabela `daily_players`
| Kolumna | Typ |
|---|---|
| `date` | date (UNIQUE) |
| `player_id` | int FK |

### Tabela `game_stats`
Anonimowe statystyki gier (session_id zamiast user_id dla gości).

## Routing

| Ścieżka | Opis |
|---|---|
| `/` | Strona główna z grą dnia |
| `/jak-grac` | Zasady gry |
| `/archiwum` | Kalendarz z przeszłymi zagadkami (bez spoilerów) |
| `/cwiczenia/[date]` | Tryb ćwiczeniowy (gra na wybraną datę, wyniki niezapisywane) |

## Lokalizacja stanu

- Stan gry dnia → `localStorage` klucz `ekstra-typ-game-state`
- Stan ćwiczeń → `localStorage` klucz `ekstra-typ-practice-{date}`
- Statystyki gracza → `localStorage` klucz `ekstra-typ-stats`
- Session ID → `localStorage` klucz `ekstra-typ-session-id`
- Statystyki globalne → API `GET /api/stats?date=YYYY-MM-DD`
- Stats modal → `StatsContext` (React Context w `lib/stats-context.tsx`)

## API

| Endpoint | Metoda | Opis |
|---|---|---|
| `/api/daily?date=&reveal=` | GET | Piłkarz dnia. `reveal=true` ujawnia odpowiedź (dla „Poddaj się") |
| `/api/guess` | POST | Sprawdź odpowiedź: `{ date, guessedPlayerId }` → `GuessResult` z 7 hintami |
| `/api/search?q=&limit=` | GET | Wyszukiwanie graczy (wszyscy, nie tylko aktywni) |
| `/api/hint` | POST | Inteligentna podpowiedź: `{ date, alreadyGuessedIds, knownAttributes }` |
| `/api/stats` | GET/POST | Statystyki globalne |

## Scraping (Python)

Skrypty w `scripts/`:
- `scrape_players.py` – import składów klubów Ekstraklasy
- `scrape_careers.py` – import historii kariery (z opcją `--missing-league`)
- `enrich_careers.py` – wzbogacanie kariery o ligi zagraniczne
- `update_daily.py` – wybór piłkarza dnia (GitHub Actions cron 00:01 UTC)

### Kluczowe parsowanie w `scraper/transfermarkt.py`:
- **Pozycja** z `td.posrela` → wyciągana z drugiego wiersza `table.inline-table` (nie `get_text()` na całym td!)
- **Wiek** z drugiego `td.zentriert` w wierszu (kolumna po numerze koszulki)
- **birth_date** z `itemprop="birthDate"` na stronie profilu gracza

## GitHub Actions

- `daily-player.yml` – codziennie 00:01 UTC, wybiera piłkarza dnia (env: Preview)
- `weekly-update.yml` – co niedzielę 03:00 UTC, aktualizuje składy (timeout 60 min)

## Ważne decyzje implementacyjne

- **Brak auth w logice gry** – `Game.tsx` nie używa `useAuth`. Auth komponenty istnieją ale nie blokują rozgrywki.
- **CareerEntry.league** – kolumna bezpośrednio w tabeli `career_history` (migracja 003).
- **Wiek** – obliczany dynamicznie z `birth_date` przez `withCurrentAge()`, fallback na statyczny `age`.
- **Podpowiedź** – celowana, zawsze ujawnia dokładnie 1 nowy nieznany atrybut.
- **Archiwum** – nie spoileruje odpowiedzi; pokazuje zawodnika tylko gdy gracz wygrał daną datę.
- **Stats icon** – działa globalnie przez `StatsContext` + `GlobalStatsModal`, nie przez `getElementById`.
- **localStorage keys** zachowane jako `ekstra-typ-*` (kompatybilność wsteczna po rebrandingu).

## Środowiska (dev / prod)

| Element | PROD | DEV |
|---------|------|-----|
| **Branch** | `main` | `dev` |
| **Vercel** | Production deploy | Preview deploy (automatyczny) |
| **Supabase** | `pujqllqolcxujfnltbxv` | `irlkfxzyxwgzwyuzrzrb` |

- Push na `dev` → Vercel preview z DEV Supabase (env vars ustawione per environment w Vercel)
- Push/merge na `main` → Vercel production z PROD Supabase
- Workflow: pracuj na `dev`, gdy gotowe → PR `dev` → `main` → merge
- Sync danych prod→dev: `python3 /tmp/sync_prod_to_dev.py` (skrypt jednorazowy, w razie potrzeby odtworzyć)

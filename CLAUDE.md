# Polska Liga Guess – CLAUDE.md

## Przegląd projektu

Gra typu Wordle dla piłkarzy polskiej ligi (wzorowana na manmark.co.uk). Każdego dnia jeden zagadkowy zawodnik. Gracz zgaduje wpisując nazwiska – po każdej próbie widzi 6 atrybutów i procent dopasowania. **Brak rejestracji i logowania** – wszystko anonimowo w przeglądarce (localStorage).

## Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL)
- **Hosting:** Vercel

## Kluczowe zasady mechniki

1. **Brak limitu prób** – gracz może zgadywać dowolnie wiele razy (brak stanu `lost`).
2. **6 atrybutów porównania** (układ 2×3):
   - Obywatelstwo (`nationality`)
   - Status kariery (`career_status`): „Aktywny" / „Zakończona"
   - Pozycja (`position`): Bramkarz / Obrońca / Pomocnik / Napastnik
   - Dokładna rola (`position_detailed`): np. „Lewy obrońca"
   - Historia klubów (`club_history`): ✓ jeśli szukany grał w którymś klubie typowanego
   - Historia lig (`league_history`): ✓ jeśli szukany grał w której ś lidze typowanego
3. **Procent dopasowania** = liczba pasujących atrybutów / 6 × 100. Kolor: czerwony 0–30%, pomarańczowy 31–60%, zielony 61–100%. Poprawna odpowiedź = 100%.
4. **Karty prób** są rozwijane (ostatnia domyślnie otwarta, poprzednie zwinięte).
5. **Stały pasek dolny** z polem tekstowym + przyciskiem „Zgadnij" (niebieski) + „Podpowiedź" (szary).
6. **Podpowiedź** automatycznie wstawia zawodnika z największą liczbą wspólnych atrybutów z szukanym (kosztuje +1 próbę, oznaczana etykietą „Podpowiedź").
7. **Panel statystyk dziennych** (na górze): „Twoje próby" (z localStorage) + „Śr. do wygranej" (z API `/api/stats?date=…`).
8. **Udostępnianie** po wygranej: format `🇵🇱 Polska Liga Guess #N\n<emoji grid>\nZgadłem w X próbach!\nekstraklasaguess.pl`

## Schemat bazy danych (Supabase)

### Tabela `players`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | int | PK |
| `name` | text | Pełne imię i nazwisko |
| `nationality` | text | Kraj obywatelstwa |
| `nationality_code` | text | Kod ISO (2 lub 3 litery) |
| `position` | text | Bramkarz / Obronca / Pomocnik / Napastnik |
| `position_detailed` | text | Dokładna rola |
| `is_active` | bool | Aktywny zawodnik |
| `current_club_id` | int | FK → clubs.id |
| `photo_url` | text | URL zdjęcia (ujawniane po odgadnięciu) |

### Tabela `clubs`
| Kolumna | Typ |
|---|---|
| `id` | int |
| `name` | text |
| `name_short` | text |
| `league` | text | np. „Ekstraklasa", „Premier League" |

### Tabela `career_history`
| Kolumna | Typ |
|---|---|
| `id` | int |
| `player_id` | int FK |
| `club_id` | int FK (nullable) |
| `club_name` | text |
| `season_start` | int |
| `season_end` | int |

### Tabela `daily_players`
| Kolumna | Typ |
|---|---|
| `date` | date |
| `player_id` | int FK |

### Tabela `game_stats`
Anonimowe statystyki gier (session_id zamiast user_id dla gości).

## Routing

Jedna strona – `/`. Brak dodatkowych widoków.

## Lokalizacja stanu

- Stan gry i statystyki gracza → `localStorage` (klucze: `ekstra-typ-game-state`, `ekstra-typ-stats`)
- Statystyki globalne (śr. prób) → API `GET /api/stats?date=YYYY-MM-DD`

## Ważne decyzje implementacyjne

- **Brak auth w logice gry** – `Game.tsx` nie używa `useAuth`. Auth komponenty istnieją w projekcie ale nie blokują rozgrywki.
- **CareerEntry.league** pobierane przez join z tabelą `clubs` przy zapytaniach do `career_history`.
- **Hint API** (`/api/hint`) – szuka zawodnika z max wspólnych atrybutów z szukanym, bierze pod uwagę `alreadyGuessedIds` przesłane w body.
- **GuessResult** – expandable card, domyślnie rozwinięta tylko ostatnia próba.

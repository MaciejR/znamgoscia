# Ekstra Typ - Codzienny Quiz Piłkarski

Codzienny quiz w stylu Wordle, gdzie gracze zgadują zawodnika z polskiej Ekstraklasy. Po każdym strzale gracz otrzymuje kolorowe wskazówki dotyczące narodowości, pozycji, klubu, wieku i historii kariery.

**Inspiracja:** [ManMark](https://www.manmark.co.uk/)

## Funkcje

- Codziennie nowy zawodnik do odgadnięcia
- 8 prób na odgadnięcie
- Kolorowe podpowiedzi (zielony = poprawnie, żółty = blisko, czerwony = źle)
- Autocomplete wyszukiwania zawodników
- Statystyki gracza (localStorage)
- Archiwum poprzednich dni
- Responsywny design (mobile-first)
- Dark mode

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Next.js 14 + React + Tailwind CSS |
| Backend | Next.js API Routes |
| Baza danych | Supabase (PostgreSQL) |
| Scraping | Python + httpx + BeautifulSoup |
| Hosting | Vercel |
| Cron jobs | GitHub Actions |

## Uruchomienie lokalne

### 1. Instalacja zależności

```bash
npm install
```

### 2. Konfiguracja Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. Uruchom migrację z `supabase/migrations/001_initial_schema.sql`
3. Skopiuj `.env.example` do `.env.local` i uzupełnij dane:

```env
# Nowe klucze API Supabase (2024/2025)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx...
SUPABASE_SECRET_KEY=sb_secret_xxx...
```

> **Uwaga:** Supabase wprowadził nowy system kluczy. Znajdziesz je w:
> `Project Settings → API Keys → Publishable key / Secret key`

### 3. Scraping danych (Python)

```bash
cd scripts
pip install -r requirements.txt
python scrape_players.py
```

### 4. Uruchomienie serwera deweloperskiego

```bash
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000)

## Struktura projektu

```
ekstra-typ/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── daily/         # Dzienny zawodnik
│   │   ├── guess/         # Sprawdzanie odpowiedzi
│   │   ├── search/        # Autocomplete
│   │   └── stats/         # Statystyki
│   ├── archiwum/          # Strona archiwum
│   ├── jak-grac/          # Instrukcja gry
│   └── page.tsx           # Strona główna
├── components/            # Komponenty React
│   ├── Game.tsx          # Główny komponent gry
│   ├── GuessInput.tsx    # Input z autocomplete
│   ├── GuessResult.tsx   # Wynik strzału
│   ├── PlayerCard.tsx    # Karta zawodnika
│   ├── ShareButton.tsx   # Udostępnianie wyniku
│   └── StatsModal.tsx    # Modal statystyk
├── lib/                   # Logika i utilities
│   ├── game-logic.ts     # Logika gry
│   ├── supabase.ts       # Klient Supabase
│   ├── types.ts          # Typy TypeScript
│   └── utils.ts          # Funkcje pomocnicze
├── scripts/               # Skrypty Python
│   ├── scraper/          # Moduły scrapera
│   ├── scrape_players.py # Pełny scraping
│   └── update_daily.py   # Wybór dziennego zawodnika
├── supabase/              # Migracje SQL
└── docs/github-workflows-example/  # Przykłady GitHub Actions
```

## Znaczenie kolorów

| Kolor | Znaczenie |
|-------|-----------|
| 🟩 Zielony | Wartość poprawna |
| 🟨 Żółty | Wiek ±2 lata |
| 🟥 Czerwony | Wartość niepoprawna |

## Kategorie podpowiedzi

- **Narodowość** - flaga kraju
- **Pozycja** - BR/OB/PO/NA
- **Klub** - skrót nazwy
- **Liga** - EKL = Ekstraklasa
- **Wiek** - liczba + kierunek (↑/↓)
- **Wspólne kluby** - kluby, w których grali obaj

## GitHub Actions

### Daily Player (codziennie o 00:01 UTC)
Wybiera losowego zawodnika na dany dzień.

### Weekly Update (niedziela o 03:00 UTC)
Aktualizuje bazę danych (nowi zawodnicy, transfery, wartości).

> **Uwaga:** Pliki workflow znajdują się w `docs/github-workflows-example/`.
> Skopiuj je do `.github/workflows/` i skonfiguruj sekrety.

## Zmienne sekretne (GitHub Secrets)

- `SUPABASE_URL` - URL projektu Supabase
- `SUPABASE_SECRET_KEY` - Secret key (sb_secret_xxx...)

## Deployment na Vercel

1. Połącz repozytorium z Vercel
2. Dodaj zmienne środowiskowe:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
3. Deploy!

## Licencja

MIT

## Autor

Ekstra Typ Team

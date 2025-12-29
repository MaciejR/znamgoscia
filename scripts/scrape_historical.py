#!/usr/bin/env python3
"""
Skrypt do pobierania wszystkich historycznych zawodników Ekstraklasy.
Pobiera dane z sezonów od 2010/11 do 2024/25.

UWAGA: Ten skrypt może działać bardzo długo (kilka godzin) ze względu na
dużą liczbę żądań i opóźnienia między nimi (aby nie przeciążyć serwera).

Użycie:
    python scrape_historical.py [start_season] [end_season]

Przykłady:
    python scrape_historical.py              # Domyślnie 2010-2024
    python scrape_historical.py 2015 2024    # Tylko od 2015 do 2024
    python scrape_historical.py 2020         # Od 2020 do 2024
"""

import os
import sys
import argparse
from datetime import datetime

from dotenv import load_dotenv

# Dodaj ścieżkę do modułów
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.transfermarkt import TransfermarktScraper
from scraper.database import DatabaseManager


def main():
    parser = argparse.ArgumentParser(description='Pobierz historycznych zawodników Ekstraklasy')
    parser.add_argument('start_season', type=int, nargs='?', default=2010,
                        help='Pierwszy sezon do pobrania (domyślnie: 2010)')
    parser.add_argument('end_season', type=int, nargs='?', default=2024,
                        help='Ostatni sezon do pobrania (domyślnie: 2024)')
    parser.add_argument('--min-delay', type=float, default=2.0,
                        help='Minimalne opóźnienie między żądaniami (domyślnie: 2.0s)')
    parser.add_argument('--max-delay', type=float, default=4.0,
                        help='Maksymalne opóźnienie między żądaniami (domyślnie: 4.0s)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Tylko pobierz dane, nie zapisuj do bazy')

    args = parser.parse_args()

    # Załaduj zmienne środowiskowe
    load_dotenv()

    # Sprawdź czy mamy wymagane zmienne
    if not os.environ.get('SUPABASE_URL') and not os.environ.get('NEXT_PUBLIC_SUPABASE_URL'):
        print("BŁĄD: Brak zmiennej SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_URL")
        sys.exit(1)

    if not os.environ.get('SUPABASE_SECRET_KEY') and not os.environ.get('SUPABASE_SERVICE_ROLE_KEY'):
        print("BŁĄD: Brak zmiennej SUPABASE_SECRET_KEY")
        sys.exit(1)

    print("=" * 60)
    print("EKSTRA TYP - Scraping historycznych zawodników")
    print("=" * 60)
    print(f"Sezony: {args.start_season}/{args.start_season+1} - {args.end_season}/{args.end_season+1}")
    print(f"Opóźnienia: {args.min_delay}s - {args.max_delay}s")
    print(f"Dry run: {'Tak' if args.dry_run else 'Nie'}")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Szacowany czas
    seasons_count = args.end_season - args.start_season + 1
    estimated_requests = seasons_count * 18 * 2  # ~18 klubów/sezon, 2 requesty/klub
    avg_delay = (args.min_delay + args.max_delay) / 2
    estimated_time_min = (estimated_requests * avg_delay) / 60
    print(f"\nSzacowany czas: ~{estimated_time_min:.0f} minut ({estimated_time_min/60:.1f} godzin)")
    print(f"Szacowana liczba żądań: ~{estimated_requests}")
    print()

    # Inicjalizacja
    scraper = TransfermarktScraper(min_delay=args.min_delay, max_delay=args.max_delay)

    if not args.dry_run:
        db = DatabaseManager()

    # Statystyki
    stats = {
        'clubs_added': 0,
        'clubs_updated': 0,
        'players_added': 0,
        'players_updated': 0,
        'errors': 0,
    }

    try:
        # Pobierz dane historyczne
        clubs, players, seen_ids = scraper.scrape_historical(
            start_season=args.start_season,
            end_season=args.end_season
        )

        print("\n" + "=" * 60)
        print("PODSUMOWANIE SCRAPINGU")
        print("=" * 60)
        print(f"Znaleziono klubów: {len(clubs)}")
        print(f"Znaleziono unikalnych zawodników: {len(players)}")

        if args.dry_run:
            print("\n[DRY RUN] Dane nie zostały zapisane do bazy")
            # Wyświetl przykładowych zawodników
            print("\nPrzykładowi zawodnicy:")
            for i, player in enumerate(players[:10]):
                print(f"  {i+1}. {player['name']} ({player.get('nationality', 'N/A')}) - {player.get('position', 'N/A')}")
            if len(players) > 10:
                print(f"  ... i {len(players) - 10} więcej")
        else:
            # Zapisz kluby
            print("\nZapisywanie klubów do bazy...")
            for club in clubs:
                try:
                    existing = db.get_club_by_tm_id(club.transfermarkt_id)
                    if existing:
                        stats['clubs_updated'] += 1
                    else:
                        db.upsert_club(club)
                        stats['clubs_added'] += 1
                except Exception as e:
                    print(f"Błąd zapisywania klubu {club.name}: {e}")
                    stats['errors'] += 1

            # Zapisz zawodników
            print(f"Zapisywanie {len(players)} zawodników do bazy...")
            for i, player_data in enumerate(players):
                try:
                    club = player_data.pop('club', None)
                    club_id = None

                    if club:
                        db_club = db.get_club_by_tm_id(club.transfermarkt_id)
                        if db_club:
                            club_id = db_club['id']

                    # Usuń niepotrzebne pola
                    player_data.pop('player_url', None)
                    player_data.pop('season', None)
                    player_data.pop('first_seen_season', None)

                    existing = db.get_player_by_tm_id(player_data.get('transfermarkt_id'))
                    if existing:
                        stats['players_updated'] += 1
                    else:
                        db.upsert_player(player_data, club_id)
                        stats['players_added'] += 1

                    if (i + 1) % 100 == 0:
                        print(f"  Zapisano {i + 1}/{len(players)} zawodników...")

                except Exception as e:
                    print(f"Błąd zapisywania zawodnika {player_data.get('name', 'N/A')}: {e}")
                    stats['errors'] += 1

    except KeyboardInterrupt:
        print("\n\nPrzerwano przez użytkownika!")
    except Exception as e:
        print(f"\nBŁĄD: {e}")
        import traceback
        traceback.print_exc()
        stats['errors'] += 1

    # Podsumowanie końcowe
    print("\n" + "=" * 60)
    print("STATYSTYKI KOŃCOWE")
    print("=" * 60)
    print(f"Kluby dodane: {stats['clubs_added']}")
    print(f"Kluby zaktualizowane: {stats['clubs_updated']}")
    print(f"Zawodnicy dodani: {stats['players_added']}")
    print(f"Zawodnicy zaktualizowani: {stats['players_updated']}")
    print(f"Błędy: {stats['errors']}")
    print(f"Koniec: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    return 0 if stats['errors'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())

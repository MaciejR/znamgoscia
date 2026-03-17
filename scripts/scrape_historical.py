#!/usr/bin/env python3
"""
Skrypt do pobierania wszystkich historycznych zawodników Ekstraklasy.
Pobiera dane z sezonów i BUDUJE historię kariery bezpośrednio z danych sezonowych
(bez potrzeby odwiedzania osobnych stron kariery).

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
from dataclasses import asdict
from datetime import datetime

from dotenv import load_dotenv

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

    load_dotenv()

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

    seasons_count = args.end_season - args.start_season + 1
    estimated_requests = seasons_count * 18 * 2
    avg_delay = (args.min_delay + args.max_delay) / 2
    estimated_time_min = (estimated_requests * avg_delay) / 60
    print(f"\nSzacowany czas: ~{estimated_time_min:.0f} minut ({estimated_time_min/60:.1f} godzin)")
    print(f"Szacowana liczba żądań: ~{estimated_requests}")
    print()

    scraper = TransfermarktScraper(min_delay=args.min_delay, max_delay=args.max_delay)

    if not args.dry_run:
        db = DatabaseManager()

    stats = {
        'clubs_added': 0,
        'clubs_updated': 0,
        'players_added': 0,
        'players_updated': 0,
        'career_entries': 0,
        'errors': 0,
    }

    # Cache klubów: tm_id -> db_id
    club_id_cache = {}

    try:
        for season in range(args.start_season, args.end_season + 1):
            print(f"\n{'='*60}")
            print(f"SEZON {season}/{season+1}")
            print(f"{'='*60}")

            clubs = scraper.get_league_teams_for_season(season)

            for club in clubs:
                # Zapisz/odczytaj klub
                if not args.dry_run:
                    if club.transfermarkt_id not in club_id_cache:
                        existing = db.get_club_by_tm_id(club.transfermarkt_id)
                        if existing:
                            club_id_cache[club.transfermarkt_id] = existing['id']
                            stats['clubs_updated'] += 1
                        else:
                            club_id = db.upsert_club(asdict(club))
                            if club_id:
                                club_id_cache[club.transfermarkt_id] = club_id
                                stats['clubs_added'] += 1

                club_db_id = club_id_cache.get(club.transfermarkt_id) if not args.dry_run else None

                # Pobierz skład na ten sezon
                players = scraper.get_team_squad_for_season(club, season)
                print(f"  {club.name}: {len(players)} zawodników")

                for player_data in players:
                    try:
                        player_data.pop('season', None)
                        player_url = player_data.pop('player_url', None)
                        tm_id = player_data.get('transfermarkt_id')

                        if args.dry_run:
                            stats['players_added'] += 1
                            continue

                        # Dla bieżącego sezonu (ostatni) ustaw current_club_id
                        if season == args.end_season and club_db_id:
                            player_data['current_club_id'] = club_db_id

                        existing = db.get_player_by_tm_id(tm_id)
                        if existing:
                            player_id = existing['id']
                            stats['players_updated'] += 1
                            # Aktualizuj current_club_id jeśli to ostatni sezon
                            if season == args.end_season and club_db_id:
                                db.client.table('players').update(
                                    {'current_club_id': club_db_id}
                                ).eq('id', player_id).execute()
                        else:
                            player_id = db.upsert_player(player_data)
                            if player_id:
                                stats['players_added'] += 1

                        # Dodaj wpis kariery dla tego sezonu w Ekstraklasie
                        if player_id and club_db_id:
                            db.add_career_entry({
                                'player_id': player_id,
                                'club_id': club_db_id,
                                'club_name': club.name,
                                'league': 'Ekstraklasa',
                                'season_start': season,
                                'season_end': season + 1,
                                'appearances': 0,
                                'goals': 0,
                            })
                            stats['career_entries'] += 1

                    except Exception as e:
                        print(f"    Błąd: {player_data.get('name', '?')}: {e}")
                        stats['errors'] += 1

            print(f"\n  Podsumowanie po sezonie {season}/{season+1}:")
            print(f"  Kluby w cache: {len(club_id_cache)}")
            if not args.dry_run:
                total = db.client.table('players').select('count', count='exact').execute()
                print(f"  Zawodnicy w bazie: {total.count}")

    except KeyboardInterrupt:
        print("\n\nPrzerwano przez użytkownika!")
    except Exception as e:
        print(f"\nBŁĄD: {e}")
        import traceback
        traceback.print_exc()
        stats['errors'] += 1

    print("\n" + "=" * 60)
    print("STATYSTYKI KOŃCOWE")
    print("=" * 60)
    print(f"Kluby dodane: {stats['clubs_added']}")
    print(f"Kluby zaktualizowane: {stats['clubs_updated']}")
    print(f"Zawodnicy dodani: {stats['players_added']}")
    print(f"Zawodnicy zaktualizowani: {stats['players_updated']}")
    print(f"Wpisy kariery: {stats['career_entries']}")
    print(f"Błędy: {stats['errors']}")
    print(f"Koniec: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    return 0 if stats['errors'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
Skrypt do pobierania historii kariery dla zawodników już w bazie.
Uzupełnia career_history dla wszystkich zawodników którzy mają transfermarkt_id.

Użycie:
    python scrape_careers.py                    # Wszyscy bez kariery
    python scrape_careers.py --limit 100        # Pierwszych 100
    python scrape_careers.py --refetch          # Wszyscy (nawet z karierą)
    python scrape_careers.py --missing-league   # Gracze z wpisami bez pola league
    python scrape_careers.py --min-delay 3      # Wolniejszy (ostrożniejszy)
"""

import os
import sys
import argparse
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.transfermarkt import TransfermarktScraper
from scraper.database import DatabaseManager


def main():
    parser = argparse.ArgumentParser(description='Pobierz historię kariery zawodników')
    parser.add_argument('--limit', type=int, default=0,
                        help='Maksymalna liczba zawodników (0 = bez limitu)')
    parser.add_argument('--refetch', action='store_true',
                        help='Pobierz ponownie nawet jeśli mają już wpisaną karierę')
    parser.add_argument('--missing-league', action='store_true',
                        help='Tylko gracze, którzy mają wpisy kariery bez pola league')
    parser.add_argument('--min-delay', type=float, default=2.5,
                        help='Minimalne opóźnienie między żądaniami (domyślnie: 2.5s)')
    parser.add_argument('--max-delay', type=float, default=4.5,
                        help='Maksymalne opóźnienie między żądaniami (domyślnie: 4.5s)')
    args = parser.parse_args()

    load_dotenv()

    if not os.environ.get('SUPABASE_URL') and not os.environ.get('NEXT_PUBLIC_SUPABASE_URL'):
        print("BŁĄD: Brak zmiennej SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_URL")
        sys.exit(1)
    if not os.environ.get('SUPABASE_SECRET_KEY') and not os.environ.get('SUPABASE_SERVICE_ROLE_KEY'):
        print("BŁĄD: Brak zmiennej SUPABASE_SECRET_KEY")
        sys.exit(1)

    print("=" * 60)
    print("EKSTRA TYP - Scrapowanie historii kariery")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    db = DatabaseManager()
    scraper = TransfermarktScraper(min_delay=args.min_delay, max_delay=args.max_delay)

    # Pobierz zawodników z transfermarkt_id
    result = db.client.table('players').select('id, name, transfermarkt_id').execute()
    all_players = result.data or []

    if args.refetch:
        players = all_players
        print(f"Wszyscy zawodnicy: {len(players)}")
    elif args.missing_league:
        # Znajdź player_id gdzie istnieje wpis kariery z league = NULL (z paginacją)
        missing_ids = set()
        page_size = 1000
        offset = 0
        while True:
            batch = db.client.table('career_history').select('player_id').is_('league', 'null').range(offset, offset + page_size - 1).execute()
            if not batch.data:
                break
            for r in batch.data:
                missing_ids.add(r['player_id'])
            if len(batch.data) < page_size:
                break
            offset += page_size
        players = [p for p in all_players if p['id'] in missing_ids]
        print(f"Zawodnicy z brakującą ligą w karierze: {len(players)} / {len(all_players)}")
    else:
        # Filtruj tych co już mają kariery
        with_career = db.client.table('career_history').select('player_id').execute()
        player_ids_with_career = {r['player_id'] for r in (with_career.data or [])}
        players = [p for p in all_players if p['id'] not in player_ids_with_career]
        print(f"Zawodnicy bez kariery: {len(players)} / {len(all_players)}")

    players = [p for p in players if p.get('transfermarkt_id')]

    if args.limit > 0:
        players = players[:args.limit]
        print(f"Limit: {args.limit}")

    if not players:
        print("Brak zawodników do przetworzenia.")
        return 0

    # Szacowany czas
    avg_delay = (args.min_delay + args.max_delay) / 2
    est_min = (len(players) * avg_delay) / 60
    print(f"Szacowany czas: ~{est_min:.0f} minut")
    print()

    stats = {'ok': 0, 'no_career': 0, 'errors': 0, 'total_entries': 0}

    for i, player in enumerate(players):
        tm_id = player['transfermarkt_id']
        player_url = f"/a/profil/spieler/{tm_id}"

        try:
            career = scraper.get_player_career(player_url)

            if career:
                for entry in career:
                    db.add_career_entry({
                        'player_id': player['id'],
                        'club_name': entry['club_name'],
                        'league': entry.get('league'),
                        'season_start': entry['season_start'],
                        'season_end': entry['season_end'],
                        'appearances': entry.get('appearances', 0),
                        'goals': entry.get('goals', 0),
                    })
                stats['ok'] += 1
                stats['total_entries'] += len(career)
                print(f"  [{i+1}/{len(players)}] ✓ {player['name']} — {len(career)} sezonów")
            else:
                stats['no_career'] += 1
                print(f"  [{i+1}/{len(players)}] - {player['name']} — brak danych kariery")

        except Exception as e:
            stats['errors'] += 1
            print(f"  [{i+1}/{len(players)}] ✗ {player['name']} — błąd: {e}")

    print("\n" + "=" * 60)
    print("PODSUMOWANIE")
    print("=" * 60)
    print(f"Zawodnicy z karierą: {stats['ok']}")
    print(f"Bez danych kariery:  {stats['no_career']}")
    print(f"Błędy:               {stats['errors']}")
    print(f"Łącznie wpisów:      {stats['total_entries']}")
    print(f"Koniec: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())

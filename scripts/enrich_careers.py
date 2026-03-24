#!/usr/bin/env python3
"""
Wzbogacanie historii kariery - pobiera PEŁNĄ karierę każdego zawodnika
(wszystkie ligi, nie tylko Ekstraklasa) z Transfermarkt.

Skrypt jest wznawialny: pomija zawodników, którzy już mają wpisy kariery
z ligami innymi niż Ekstraklasa.

Użycie:
    # Wskazując produkcyjny Supabase przez zmienne środowiskowe:
    SUPABASE_URL=https://... SUPABASE_SECRET_KEY=sb_secret_... python enrich_careers.py

    # Lub przez plik .env:
    python enrich_careers.py --env .env.production

Opcje:
    --env FILE        Plik .env do załadowania
    --batch N         Ile zawodników przetworzyć (domyślnie: wszystkich)
    --dry-run         Pobierz dane, ale nie zapisuj do bazy
"""

import os
import sys
import time
import argparse
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.transfermarkt import TransfermarktScraper
from scraper.database import DatabaseManager


def parse_args():
    p = argparse.ArgumentParser(description='Wzbogacanie historii kariery zawodników')
    p.add_argument('--env',      type=str, default=None, help='Plik .env do załadowania')
    p.add_argument('--batch',    type=int, default=0,    help='Limit zawodników do przetworzenia (0 = wszyscy)')
    p.add_argument('--dry-run',  action='store_true',    help='Tylko scrapuj, nie zapisuj')
    return p.parse_args()


def get_players_needing_career(db: DatabaseManager) -> list[dict]:
    """
    Zwraca zawodników, którzy nie mają jeszcze pełnych danych kariery.
    "Pełne" = mają przynajmniej jeden wpis kariery z ligą inną niż Ekstraklasa
    lub w ogóle nie mają wpisów kariery.
    """
    print("Pobieranie listy zawodników wymagających wzbogacenia kariery...")

    # Wszystkie career_history entries — paginacja
    career_rows = []
    page_size = 1000
    offset = 0
    while True:
        batch = db.client.table('career_history').select(
            'player_id, league'
        ).range(offset, offset + page_size - 1).execute().data or []
        career_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    # Zbierz player_id tych, którzy mają ligę inną niż Ekstraklasa
    enriched_ids: set[int] = set()
    for row in career_rows:
        league = row.get('league') or ''
        if league and league != 'Ekstraklasa':
            enriched_ids.add(row['player_id'])

    print(f"  Zawodników już z pełną karierą: {len(enriched_ids)}")

    # Wszyscy zawodnicy z transfermarkt_id — paginacja po 1000 (limit REST API)
    all_players = []
    page_size = 1000
    offset = 0
    while True:
        batch = db.client.table('players').select(
            'id, name, transfermarkt_id'
        ).not_.is_('transfermarkt_id', 'null').range(offset, offset + page_size - 1).execute().data or []
        all_players.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    # Odfiltruj tych, którzy już mają pełną karierę
    to_enrich = [p for p in all_players if p['id'] not in enriched_ids]
    print(f"  Zawodników do wzbogacenia: {len(to_enrich)} / {len(all_players)}")

    return to_enrich


def build_player_url(transfermarkt_id: str) -> str:
    """Buduje URL profilu zawodnika z jego ID Transfermarkt."""
    return f"/a/profil/spieler/{transfermarkt_id}"


def main():
    args = parse_args()

    if args.env:
        load_dotenv(args.env)
    else:
        load_dotenv()

    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("BŁĄD: Brak SUPABASE_URL lub SUPABASE_SECRET_KEY")
        sys.exit(1)

    print("=" * 70)
    print("Ekstra Typ - Wzbogacanie historii kariery (wszystkie ligi)")
    print(f"Start:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Tryb:   {'DRY-RUN' if args.dry_run else 'ZAPIS DO BAZY'}")
    print(f"Supabase: {supabase_url}")
    print("=" * 70)

    scraper = TransfermarktScraper(min_delay=2.0, max_delay=4.0)
    db = DatabaseManager()

    players = get_players_needing_career(db)

    if args.batch > 0:
        players = players[:args.batch]
        print(f"\nPrzetwarzam tylko pierwsze {args.batch} zawodników (--batch).")

    total = len(players)
    if total == 0:
        print("\nWszyscy zawodnicy mają już pełną historię kariery. Nic do zrobienia.")
        return

    avg_delay = 3.0  # średnie opóźnienie
    eta_min = (total * avg_delay) / 60
    print(f"\nSzacowany czas: ~{eta_min:.0f} minut ({eta_min/60:.1f} h) dla {total} zawodników")
    print()

    stats = {
        'processed': 0,
        'entries_added': 0,
        'skipped': 0,
        'errors': 0,
    }

    start_time = time.time()

    for i, player in enumerate(players, 1):
        player_id = player['id']
        name = player.get('name', '?')
        tm_id = player.get('transfermarkt_id')

        if not tm_id:
            stats['skipped'] += 1
            continue

        # ETA co 50 zawodników
        if i % 50 == 0 or i == 1:
            elapsed = time.time() - start_time
            if i > 1:
                avg_per = elapsed / (i - 1)
                remaining = (total - i) * avg_per
                eta_str = f"{int(remaining//3600)}h {int((remaining%3600)//60)}m"
            else:
                eta_str = f"~{eta_min:.0f}m"
            print(f"[{i}/{total}] ETA: {eta_str}  |  Dodano wpisów: {stats['entries_added']}  Błędy: {stats['errors']}")

        player_url = build_player_url(tm_id)

        try:
            career = scraper.get_player_career(player_url)

            if not career:
                stats['skipped'] += 1
                continue

            if not args.dry_run:
                for entry in career:
                    db.add_career_entry({
                        'player_id': player_id,
                        'club_name': entry.get('club_name'),
                        'league': entry.get('league'),
                        'season_start': entry.get('season_start'),
                        'season_end': entry.get('season_end'),
                        'appearances': entry.get('appearances', 0),
                        'goals': entry.get('goals', 0),
                    })
                stats['entries_added'] += len(career)

            leagues = [e.get('league') for e in career if e.get('league')]
            stats['processed'] += 1

            if i % 10 == 0:
                leagues_preview = ', '.join(set(leagues[:5]))
                print(f"  {name}: {len(career)} wpisów [{leagues_preview}{'...' if len(leagues) > 5 else ''}]")

        except KeyboardInterrupt:
            print(f"\n\nPrzerwano przez użytkownika przy zawodniku {i}/{total}.")
            print("Możesz wznowić — skrypt pomija już wzbogaconych zawodników.")
            break
        except Exception as e:
            print(f"  ! Błąd {name}: {e}")
            stats['errors'] += 1

    total_time = time.time() - start_time
    print("\n" + "=" * 70)
    print("PODSUMOWANIE")
    print("=" * 70)
    print(f"Zawodnicy przetworzone:  {stats['processed']}")
    print(f"Wpisy kariery dodane:    {stats['entries_added']}")
    print(f"Pominięci (brak danych): {stats['skipped']}")
    print(f"Błędy:                   {stats['errors']}")
    print(f"Czas:                    {int(total_time//3600)}h {int((total_time%3600)//60)}m {int(total_time%60)}s")
    print(f"Koniec: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)


if __name__ == '__main__':
    main()

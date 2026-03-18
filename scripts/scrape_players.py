#!/usr/bin/env python3
"""
Główny skrypt scrapingu - pobiera dane wszystkich zawodników Ekstraklasy
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Dodaj ścieżkę do modułów
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.transfermarkt import TransfermarktScraper
from scraper.database import DatabaseManager


def main():
    """Główna funkcja scrapingu"""
    print("=" * 60)
    print("Ekstra Typ - Scraping zawodników Ekstraklasy")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Załaduj zmienne środowiskowe
    load_dotenv()

    # Sprawdź czy mamy wymagane zmienne
    if not os.environ.get('SUPABASE_URL') and not os.environ.get('NEXT_PUBLIC_SUPABASE_URL'):
        print("BŁĄD: Brak zmiennej SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_URL")
        sys.exit(1)

    if not os.environ.get('SUPABASE_SECRET_KEY') and not os.environ.get('SUPABASE_SERVICE_ROLE_KEY'):
        print("BŁĄD: Brak zmiennej SUPABASE_SECRET_KEY")
        sys.exit(1)

    # Inicjalizacja
    scraper = TransfermarktScraper(min_delay=2.0, max_delay=4.0)
    db = DatabaseManager()

    # Statystyki
    stats = {
        'clubs_added': 0,
        'clubs_updated': 0,
        'players_added': 0,
        'players_updated': 0,
        'players_deactivated': 0,
        'career_entries': 0,
        'errors': 0,
    }

    active_tm_ids = []

    try:
        # 1. Pobierz kluby
        print("\n[1/3] Pobieranie klubów...")
        clubs = scraper.get_league_teams()

        club_id_map = {}  # transfermarkt_id -> database_id

        for club in clubs:
            club_data = {
                'name': club.name,
                'name_short': club.name_short,
                'league': club.league,
                'country': club.country,
                'logo_url': club.logo_url,
                'transfermarkt_id': club.transfermarkt_id,
            }

            club_id = db.upsert_club(club_data)
            if club_id:
                club_id_map[club.transfermarkt_id] = club_id
                stats['clubs_added'] += 1
                print(f"  ✓ {club.name}")
            else:
                stats['errors'] += 1
                print(f"  ✗ {club.name} - błąd zapisu")

        # 2. Pobierz zawodników dla każdego klubu
        print("\n[2/3] Pobieranie zawodników...")

        for club in clubs:
            print(f"\n  Klub: {club.name}")
            players = scraper.get_team_squad(club)

            club_db_id = club_id_map.get(club.transfermarkt_id)

            for player_data in players:
                # Dodaj ID klubu
                player_data['current_club_id'] = club_db_id

                player_url = player_data.get('player_url')

                # Zapisz zawodnika
                player_id = db.upsert_player(player_data)

                if player_id:
                    stats['players_added'] += 1
                    active_tm_ids.append(player_data.get('transfermarkt_id'))

                    # Pobierz i zapisz historię kariery
                    if player_url:
                        career = scraper.get_player_career(player_url)
                        stats['career_entries'] += len(career)
                        for entry in career:
                            db.add_career_entry({
                                'player_id': player_id,
                                'club_name': entry['club_name'],
                                'league': entry.get('league'),
                                'season_start': entry['season_start'],
                                'season_end': entry['season_end'],
                                'appearances': entry.get('appearances', 0),
                                'goals': entry.get('goals', 0),
                            })
                        print(f"    ✓ {player_data.get('name')} ({len(career)} sezonów kariery)")
                    else:
                        print(f"    ✓ {player_data.get('name')}")
                else:
                    stats['errors'] += 1
                    print(f"    ✗ {player_data.get('name')} - błąd zapisu")

        # 3. Oznacz nieaktywnych zawodników
        print("\n[3/3] Aktualizacja statusu zawodników...")
        deactivated = db.mark_players_inactive(active_tm_ids)
        stats['players_deactivated'] = deactivated
        print(f"  Dezaktywowano {deactivated} zawodników")

    except KeyboardInterrupt:
        print("\n\nPrzerwano przez użytkownika")
    except Exception as e:
        print(f"\n\nBŁĄD: {e}")
        stats['errors'] += 1

    # Podsumowanie
    print("\n" + "=" * 60)
    print("PODSUMOWANIE")
    print("=" * 60)
    print(f"Kluby dodane/zaktualizowane: {stats['clubs_added']}")
    print(f"Zawodnicy dodani/zaktualizowani: {stats['players_added']}")
    print(f"Zawodnicy dezaktywowani: {stats['players_deactivated']}")
    print(f"Wpisy kariery: {stats['career_entries']}")
    print(f"Błędy: {stats['errors']}")
    print(f"Koniec: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    return 0 if stats['errors'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())

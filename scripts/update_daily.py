#!/usr/bin/env python3
"""
Skrypt wyboru dziennego zawodnika
Uruchamiany codziennie przez GitHub Actions
"""

import os
import sys
from datetime import date, datetime
from dotenv import load_dotenv

# Dodaj ścieżkę do modułów
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.database import DatabaseManager


def main():
    """Główna funkcja"""
    print("=" * 60)
    print("Ekstra Typ - Wybór dziennego zawodnika")
    print(f"Data: {date.today().isoformat()}")
    print(f"Czas: {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 60)

    # Załaduj zmienne środowiskowe
    load_dotenv()

    # Sprawdź czy mamy wymagane zmienne
    if not os.environ.get('SUPABASE_URL') and not os.environ.get('NEXT_PUBLIC_SUPABASE_URL'):
        print("BŁĄD: Brak zmiennej SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_URL")
        sys.exit(1)

    if not os.environ.get('SUPABASE_SERVICE_ROLE_KEY'):
        print("BŁĄD: Brak zmiennej SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    try:
        db = DatabaseManager()

        # Sprawdź czy dzisiaj już jest ustawiony zawodnik
        today = date.today()
        existing = db.get_daily_player(today)

        if existing:
            player = existing.get('players', {})
            print(f"\nDzisiejszy zawodnik już ustawiony:")
            print(f"  Imię: {player.get('name')}")
            print(f"  ID: {existing.get('player_id')}")
            print("\nNic do zrobienia.")
            return 0

        # Wybierz losowego zawodnika
        print("\nWybieranie losowego zawodnika...")
        player = db.get_random_player_for_daily(exclude_days=30)

        if not player:
            print("BŁĄD: Nie znaleziono dostępnego zawodnika!")
            return 1

        print(f"  Wybrany zawodnik: {player.get('name')}")
        print(f"  Klub: {player.get('current_club_id')}")
        print(f"  Pozycja: {player.get('position')}")

        # Ustaw jako dziennego
        success = db.set_daily_player(player['id'], today)

        if success:
            print(f"\n✓ Zawodnik dnia ustawiony pomyślnie!")
            print(f"  ID: {player['id']}")
            print(f"  Imię: {player.get('name')}")
            return 0
        else:
            print("\n✗ Błąd ustawiania zawodnika dnia")
            return 1

    except Exception as e:
        print(f"\nBŁĄD: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

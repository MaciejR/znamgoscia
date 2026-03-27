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


def precompute_hints(db: DatabaseManager, for_date: date, player_id: int) -> int | None:
    """Wywołuje funkcję SQL precompute_daily_hints() dla danego dnia."""
    try:
        result = db.client.rpc('precompute_daily_hints', {
            'target_date': for_date.isoformat(),
            'answer_player_id': player_id,
        }).execute()
        return result.data
    except Exception as e:
        print(f"Error precomputing hints: {e}")
        return None


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

    if not os.environ.get('SUPABASE_SECRET_KEY') and not os.environ.get('SUPABASE_SERVICE_ROLE_KEY'):
        print("BŁĄD: Brak zmiennej SUPABASE_SECRET_KEY")
        sys.exit(1)

    try:
        db = DatabaseManager()

        # Sprawdź czy dzisiaj już jest ustawiony zawodnik
        today = date.today()
        existing = db.get_daily_player(today)

        if existing:
            player = existing.get('players', {})
            player_id = existing.get('player_id')
            print(f"\nDzisiejszy zawodnik już ustawiony:")
            print(f"  Imię: {player.get('name')}")
            print(f"  ID: {player_id}")

            # Sprawdź czy podpowiedzi już wygenerowane
            hints = db.client.table('daily_hints').select('id').eq(
                'date', today.isoformat()
            ).limit(1).execute()

            if hints.data:
                print("\nPodpowiedzi już wygenerowane. Nic do zrobienia.")
            else:
                print("\nBrak podpowiedzi — generuję...")
                hints_count = precompute_hints(db, today, player_id)
                if hints_count is not None:
                    print(f"  ✓ Wygenerowano {hints_count} podpowiedzi")
                else:
                    print("  ✗ Błąd generowania podpowiedzi")

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

        if not success:
            print("\n✗ Błąd ustawiania zawodnika dnia")
            return 1

        print(f"\n✓ Zawodnik dnia ustawiony pomyślnie!")
        print(f"  ID: {player['id']}")
        print(f"  Imię: {player.get('name')}")

        # Precompute podpowiedzi dla dzisiejszego dnia
        print("\nPrecompute podpowiedzi...")
        hints_count = precompute_hints(db, today, player['id'])
        if hints_count is not None:
            print(f"  ✓ Wygenerowano {hints_count} podpowiedzi")
        else:
            print("  ✗ Błąd generowania podpowiedzi")

        return 0

    except Exception as e:
        print(f"\nBŁĄD: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

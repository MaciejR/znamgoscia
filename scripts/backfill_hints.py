#!/usr/bin/env python3
"""
Backfill podpowiedzi dla wszystkich dni z daily_players.
Użycie:
  python backfill_hints.py                    # wszystkie dni
  python backfill_hints.py 2026-01-01         # od podanej daty

Wymaga zmiennych środowiskowych:
  SUPABASE_URL (lub NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SECRET_KEY (lub SUPABASE_SERVICE_ROLE_KEY)

UWAGA: Przed uruchomieniem upewnij się, że migracja 006 (z nową wersją
precompute_daily_hints) jest wdrożona w Supabase SQL Editor.
"""

import os
import sys
import time
from datetime import date
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.database import DatabaseManager


def main():
    load_dotenv()
    db = DatabaseManager()

    env_val = os.environ.get('MIN_DAILY_APPEARANCES')
    min_apps = int(env_val) if env_val and env_val.isdigit() else 10

    # Pobierz wszystkie daty z daily_players
    query = db.client.table('daily_players').select('date, player_id').order('date')

    if len(sys.argv) > 1:
        from_date = sys.argv[1]
        query = query.gte('date', from_date)

    result = query.execute()
    days = result.data or []

    if not days:
        print("Brak dni do przetworzenia.")
        return 0

    print(f"Znaleziono {len(days)} dni do przetworzenia (min_appearances={min_apps})")
    print()

    success = 0
    failed = 0

    for i, day in enumerate(days, 1):
        d = day['date']
        pid = day['player_id']

        try:
            r = db.client.rpc('precompute_daily_hints', {
                'target_date': d,
                'answer_player_id': pid,
                'min_appearances': min_apps,
            }).execute()
            count = r.data
            print(f"[{i}/{len(days)}] {d} → {count} podpowiedzi")
            success += 1
        except Exception as e:
            print(f"[{i}/{len(days)}] {d} → ✗ {e}")
            failed += 1
            time.sleep(2)  # poczekaj przed kolejną próbą

    print(f"\nGotowe: {success} OK, {failed} błędów")
    return 1 if failed > 0 else 0


if __name__ == '__main__':
    sys.exit(main())

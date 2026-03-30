#!/usr/bin/env python3
"""
Ręczne generowanie podpowiedzi na dziś (lub podaną datę).
Użycie:
  python generate_hints_today.py              # dziś
  python generate_hints_today.py 2026-03-30   # konkretna data

Wymaga zmiennych środowiskowych:
  SUPABASE_URL (lub NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SECRET_KEY (lub SUPABASE_SERVICE_ROLE_KEY)

UWAGA: Przed pierwszym użyciem upewnij się, że nowa wersja funkcji
precompute_daily_hints (set-based) jest wdrożona w Supabase SQL Editor.
"""

import os
import sys
from datetime import date
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.database import DatabaseManager


def main():
    load_dotenv()
    db = DatabaseManager()

    target_date = date.today()
    if len(sys.argv) > 1:
        target_date = date.fromisoformat(sys.argv[1])

    print(f"Data: {target_date.isoformat()}")

    # Pobierz daily playera
    daily = db.get_daily_player(target_date)
    if not daily:
        print("Brak daily playera na ten dzień.")
        return 1

    player_id = daily['player_id']
    player_name = daily.get('players', {}).get('name', '?')
    print(f"Daily player: {player_name} (ID: {player_id})")

    # Sprawdź istniejące podpowiedzi
    existing = db.client.table('daily_hints').select('id', count='exact').eq(
        'date', target_date.isoformat()
    ).limit(1).execute()

    existing_count = existing.count or 0
    if existing_count > 0:
        print(f"Podpowiedzi już istnieją ({existing_count} wierszy) — zostaną nadpisane.")

    # Generuj podpowiedzi
    env_val = os.environ.get('MIN_DAILY_APPEARANCES')
    min_apps = int(env_val) if env_val and env_val.isdigit() else 10

    print(f"Generuję podpowiedzi (min_appearances={min_apps})...")
    try:
        result = db.client.rpc('precompute_daily_hints', {
            'target_date': target_date.isoformat(),
            'answer_player_id': player_id,
            'min_appearances': min_apps,
        }).execute()
        count = result.data
        print(f"✓ Wygenerowano {count} podpowiedzi")
    except Exception as e:
        print(f"✗ Błąd: {e}")
        print("\nMożliwe przyczyny:")
        print("  - Funkcja SQL nie została zaktualizowana (uruchom nową wersję w Supabase SQL Editor)")
        print("  - Statement timeout (sprawdź plan Supabase)")
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())

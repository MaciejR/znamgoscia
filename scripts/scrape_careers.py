#!/usr/bin/env python3
"""
Skrypt do pobierania historii kariery wszystkich zawodników.
Pobiera kluby z całej kariery (nie tylko Ekstraklasa).
"""

import os
import sys
import time
import random
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Dodaj ścieżkę do modułów
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.database import get_supabase_client


USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]


def get_player_career(player_tm_id: str, session: httpx.Client) -> list:
    """
    Pobiera historię kariery zawodnika z Transfermarkt.
    """
    url = f"https://www.transfermarkt.pl/spieler/leistungsdatendetails/spieler/{player_tm_id}"

    headers = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    }

    try:
        response = session.get(url, headers=headers, follow_redirects=True)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'lxml')
    except Exception as e:
        print(f"    Błąd pobierania: {e}")
        return []

    career = []

    # Znajdź wszystkie tabele z danymi
    tables = soup.find_all('table', class_='items')

    for table in tables:
        rows = table.find_all('tr', class_=['odd', 'even'])

        for row in rows:
            try:
                # Znajdź klub - szukamy linku do klubu
                club_link = None
                club_name = None

                # Szukaj w komórkach
                for td in row.find_all('td'):
                    links = td.find_all('a')
                    for link in links:
                        href = link.get('href', '')
                        if '/verein/' in href:
                            club_name = link.get('title') or link.text.strip()
                            if club_name and len(club_name) > 1:
                                club_link = link
                                break
                    if club_link:
                        break

                if not club_name:
                    continue

                # Znajdź sezon
                season_text = None
                for td in row.find_all('td', class_='zentriert'):
                    text = td.get_text(strip=True)
                    if '/' in text and len(text) <= 7:  # Format: "23/24" lub "2023/24"
                        season_text = text
                        break

                if not season_text:
                    continue

                # Parsuj sezon
                import re
                season_match = re.search(r'(\d{2,4})/(\d{2,4})', season_text)
                if not season_match:
                    continue

                start, end = season_match.groups()
                if len(start) == 2:
                    start = f"20{start}" if int(start) < 50 else f"19{start}"
                if len(end) == 2:
                    end = f"20{end}" if int(end) < 50 else f"19{end}"

                season_start = int(start)
                season_end = int(end)

                # Znajdź ligę (jeśli jest)
                league_name = None
                for td in row.find_all('td'):
                    img = td.find('img', class_='flaggenrahmen')
                    if img and img.get('title'):
                        # To może być flaga kraju/ligi
                        pass
                    # Szukaj tekstu z nazwą ligi
                    text = td.get_text(strip=True)
                    if any(x in text.lower() for x in ['liga', 'league', 'division', 'serie', 'bundesliga', 'premier', 'la liga']):
                        league_name = text
                        break

                career.append({
                    'club_name': club_name,
                    'league_name': league_name,
                    'season_start': season_start,
                    'season_end': season_end,
                })

            except Exception as e:
                continue

    # Usuń duplikaty
    seen = set()
    unique_career = []
    for entry in career:
        key = (entry['club_name'], entry['season_start'])
        if key not in seen:
            seen.add(key)
            unique_career.append(entry)

    return unique_career


def main():
    print("=" * 60)
    print("Ekstra Typ - Pobieranie historii kariery zawodników")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    load_dotenv()

    client = get_supabase_client()

    # Pobierz wszystkich zawodników z transfermarkt_id
    result = client.table('players').select('id, name, transfermarkt_id').not_.is_('transfermarkt_id', 'null').execute()
    players = result.data or []

    print(f"\nZnaleziono {len(players)} zawodników do przetworzenia")

    stats = {
        'players_processed': 0,
        'careers_added': 0,
        'errors': 0,
    }

    session = httpx.Client(timeout=30.0, follow_redirects=True)

    try:
        for i, player in enumerate(players):
            player_id = player['id']
            player_name = player['name']
            tm_id = player['transfermarkt_id']

            print(f"\n[{i+1}/{len(players)}] {player_name} (TM: {tm_id})")

            # Sprawdź czy już mamy karierę tego zawodnika
            existing = client.table('career_history').select('id').eq('player_id', player_id).limit(1).execute()
            if existing.data:
                print(f"  Już ma historię kariery - pomijam")
                continue

            # Pobierz karierę
            time.sleep(random.uniform(1.5, 3.0))  # Opóźnienie
            career = get_player_career(tm_id, session)

            if career:
                print(f"  Znaleziono {len(career)} wpisów w karierze:")
                for entry in career[:5]:  # Pokaż max 5
                    print(f"    - {entry['club_name']} ({entry['season_start']}/{entry['season_end']})")
                if len(career) > 5:
                    print(f"    ... i {len(career) - 5} więcej")

                # Zapisz do bazy
                for entry in career:
                    try:
                        client.table('career_history').insert({
                            'player_id': player_id,
                            'club_name': entry['club_name'],
                            'league_name': entry.get('league_name'),
                            'season_start': entry['season_start'],
                            'season_end': entry['season_end'],
                        }).execute()
                        stats['careers_added'] += 1
                    except Exception as e:
                        # Może już istnieje
                        pass
            else:
                print(f"  Brak danych o karierze")

            stats['players_processed'] += 1

    except KeyboardInterrupt:
        print("\n\nPrzerwano przez użytkownika")
    except Exception as e:
        print(f"\n\nBŁĄD: {e}")
        import traceback
        traceback.print_exc()
        stats['errors'] += 1
    finally:
        session.close()

    print("\n" + "=" * 60)
    print("PODSUMOWANIE")
    print("=" * 60)
    print(f"Zawodnicy przetworzeni: {stats['players_processed']}")
    print(f"Wpisy kariery dodane: {stats['careers_added']}")
    print(f"Błędy: {stats['errors']}")
    print(f"Koniec: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)


if __name__ == '__main__':
    main()

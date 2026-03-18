"""
Scraper dla Transfermarkt - pobieranie danych zawodników Ekstraklasy
"""

import time
import random
import re
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from dataclasses import asdict

import httpx
from bs4 import BeautifulSoup

from .models import (
    Club, Player, CareerEntry,
    normalize_name, parse_position, parse_market_value,
    get_nationality_code, calculate_age
)


class TransfermarktScraper:
    """Scraper dla Transfermarkt"""

    BASE_URL = "https://www.transfermarkt.pl"
    EKSTRAKLASA_URL = "/pko-bp-ekstraklasa/startseite/wettbewerb/PL1"

    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ]

    def __init__(self, min_delay: float = 2.0, max_delay: float = 4.0):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.session = httpx.Client(
            timeout=30.0,
            follow_redirects=True,
        )

    def __del__(self):
        if hasattr(self, 'session'):
            self.session.close()

    def _get_headers(self) -> Dict[str, str]:
        """Zwraca nagłówki HTTP z losowym User-Agent"""
        return {
            'User-Agent': random.choice(self.USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

    def _respectful_request(self, url: str, max_retries: int = 3) -> Optional[BeautifulSoup]:
        """
        Wykonuje request z opóźnieniem i obsługą błędów.
        """
        delay = random.uniform(self.min_delay, self.max_delay)
        time.sleep(delay)

        for attempt in range(max_retries):
            try:
                response = self.session.get(
                    url if url.startswith('http') else f"{self.BASE_URL}{url}",
                    headers=self._get_headers()
                )
                response.raise_for_status()
                return BeautifulSoup(response.text, 'lxml')
            except httpx.HTTPError as e:
                print(f"Request error (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** (attempt + 1))  # Exponential backoff
                continue

        return None

    def get_league_teams(self) -> List[Club]:
        """
        Pobiera listę klubów z Ekstraklasy.
        """
        print("Pobieranie klubów Ekstraklasy...")
        soup = self._respectful_request(self.EKSTRAKLASA_URL)

        if not soup:
            print("Nie udało się pobrać strony ligi")
            return []

        clubs = []

        # Znajdź tabelę z klubami
        table = soup.find('table', class_='items')
        if not table:
            print("Nie znaleziono tabeli klubów")
            return []

        rows = table.find_all('tr')

        for row in rows:
            try:
                # Znajdź link do klubu - szukamy linku z /verein/ w href
                club_link = None
                for link in row.find_all('a'):
                    href = link.get('href', '')
                    if '/verein/' in href and '/startseite/' in href:
                        club_link = link
                        break

                if not club_link:
                    continue

                club_name = club_link.get('title', '') or club_link.text.strip()
                if not club_name or club_name in ['name', 'Kadra']:
                    continue

                club_url = club_link.get('href', '')

                # Wyciągnij ID klubu z URL
                tm_id_match = re.search(r'/verein/(\d+)', club_url)
                tm_id = tm_id_match.group(1) if tm_id_match else None

                # Sprawdź czy już mamy ten klub
                if any(c.transfermarkt_id == tm_id for c in clubs):
                    continue

                # Logo klubu
                logo_img = row.find('img', class_='tiny_wappen') or row.find('img', class_='bilderrahmen-fixed')
                logo_url = logo_img.get('src', logo_img.get('data-src', '')) if logo_img else None

                # Skrót nazwy (pierwsze 3 litery)
                name_short = self._get_club_short_name(club_name)

                club = Club(
                    name=club_name,
                    name_short=name_short,
                    league="Ekstraklasa",
                    country="Polska",
                    logo_url=logo_url,
                    transfermarkt_id=tm_id
                )
                clubs.append(club)
                print(f"  Znaleziono klub: {club_name}")

            except Exception as e:
                print(f"Błąd parsowania klubu: {e}")
                continue

        print(f"Pobrano {len(clubs)} klubów")
        return clubs

    def _get_club_short_name(self, name: str) -> str:
        """Generuje skrót nazwy klubu"""
        # Znane skróty
        known_shorts = {
            'Legia Warszawa': 'LEG',
            'Lech Poznań': 'LPO',
            'Raków Częstochowa': 'RAK',
            'Pogoń Szczecin': 'POG',
            'Jagiellonia Białystok': 'JAG',
            'Górnik Zabrze': 'GOR',
            'Śląsk Wrocław': 'SLA',
            'Cracovia': 'CRA',
            'Wisła Kraków': 'WIS',
            'Piast Gliwice': 'PIA',
            'Zagłębie Lubin': 'ZAG',
            'Warta Poznań': 'WAR',
            'Korona Kielce': 'KOR',
            'Widzew Łódź': 'WID',
            'Stal Mielec': 'STA',
            'Radomiak Radom': 'RAD',
            'Puszcza Niepołomice': 'PUS',
            'Motor Lublin': 'MOT',
            'GKS Katowice': 'GKS',
            'Lechia Gdańsk': 'LGD',
        }

        if name in known_shorts:
            return known_shorts[name]

        # Domyślnie pierwsze 3 litery
        words = name.split()
        if len(words) >= 1:
            return words[0][:3].upper()
        return name[:3].upper()

    def get_team_squad(self, club: Club) -> List[Dict[str, Any]]:
        """
        Pobiera skład klubu.
        """
        if not club.transfermarkt_id:
            print(f"Brak ID Transfermarkt dla klubu {club.name}")
            return []

        url = f"/{''.join(c for c in club.name.lower() if c.isalnum() or c == ' ').replace(' ', '-')}/kader/verein/{club.transfermarkt_id}"
        print(f"Pobieranie składu: {club.name}")

        soup = self._respectful_request(url)
        if not soup:
            # Próbuj alternatywny URL
            url = f"/verein/{club.transfermarkt_id}/kader"
            soup = self._respectful_request(url)

        if not soup:
            print(f"Nie udało się pobrać składu {club.name}")
            return []

        players = []

        # Znajdź tabelę z zawodnikami
        table = soup.find('table', class_='items')
        if not table:
            print(f"Nie znaleziono tabeli składu dla {club.name}")
            return []

        rows = table.find_all('tr', class_=['odd', 'even'])

        for row in rows:
            try:
                player_data = self._parse_player_row(row)
                if player_data:
                    players.append(player_data)
            except Exception as e:
                print(f"Błąd parsowania zawodnika: {e}")
                continue

        print(f"  Znaleziono {len(players)} zawodników")
        return players

    def _parse_player_row(self, row) -> Optional[Dict[str, Any]]:
        """
        Parsuje wiersz z danymi zawodnika z tabeli składu.
        """
        # Znajdź link do profilu zawodnika - szukamy linku z /profil/spieler/
        player_link = None
        for link in row.find_all('a'):
            href = link.get('href', '')
            if '/profil/spieler/' in href:
                player_link = link
                break

        if not player_link:
            return None

        name = player_link.text.strip()
        if not name or len(name) < 2:
            return None

        player_url = player_link.get('href', '')

        # ID zawodnika
        tm_id_match = re.search(r'/spieler/(\d+)', player_url)
        tm_id = tm_id_match.group(1) if tm_id_match else None

        # Zdjęcie
        img = row.find('img', class_='bilderrahmen-fixed')
        if not img:
            img = row.find('img', attrs={'data-src': True})
        photo_url = img.get('data-src', img.get('src', '')) if img else None

        # Pozycja - szukamy w różnych miejscach
        position = ''
        position_detailed = None
        position_td = row.find('td', class_='posrela')
        if position_td:
            pos_text = position_td.get_text(strip=True)
            position = parse_position(pos_text)
            if pos_text:
                position_detailed = pos_text  # pełna rola (np. "Środkowy obrońca")
        else:
            # Alternatywnie szukamy w innych td
            for td in row.find_all('td'):
                text = td.get_text(strip=True)
                if text in ['Bramkarz', 'Obrońca', 'Pomocnik', 'Napastnik',
                           'Goalkeeper', 'Centre-Back', 'Left-Back', 'Right-Back',
                           'Defensive Midfield', 'Central Midfield', 'Attacking Midfield',
                           'Left Winger', 'Right Winger', 'Centre-Forward', 'Second Striker']:
                    position = parse_position(text)
                    position_detailed = text
                    break

        # Narodowość
        nationality = ''
        nationality_code = None
        flag_img = row.find('img', class_='flaggenrahmen')
        if flag_img:
            nationality = flag_img.get('title', '')
            nationality_code = get_nationality_code(nationality)

        # Data urodzenia i wiek
        birth_date = None
        age = None
        for td in row.find_all('td'):
            text = td.get_text(strip=True)
            # Format: "DD.MM.YYYY" lub "sty 1, 2000"
            date_match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', text)
            if date_match:
                day, month, year = date_match.groups()
                try:
                    birth_date = date(int(year), int(month), int(day))
                    age = calculate_age(birth_date)
                except ValueError:
                    pass
                break

        # Wartość rynkowa
        market_value = None
        value_td = row.find('td', class_='rechts hauptlink')
        if value_td:
            market_value = parse_market_value(value_td.get_text(strip=True))
        else:
            # Szukaj w linkach z marktwertverlauf
            for link in row.find_all('a'):
                href = link.get('href', '')
                if 'marktwertverlauf' in href:
                    market_value = parse_market_value(link.get_text(strip=True))
                    break

        # Numer na koszulce
        jersey_number = None
        number_div = row.find('div', class_='rn_nummer')
        if number_div:
            try:
                jersey_number = int(number_div.get_text(strip=True))
            except ValueError:
                pass

        # Jeśli brakuje narodowości, ustaw domyślną
        if not nationality:
            nationality = 'Nieznana'

        # Jeśli brakuje pozycji, ustaw domyślną
        if not position:
            position = 'Pomocnik'

        return {
            'name': name,
            'name_normalized': normalize_name(name),
            'birth_date': birth_date,
            'age': age,
            'nationality': nationality,
            'nationality_code': nationality_code,
            'position': position,
            'position_detailed': position_detailed,
            'jersey_number': jersey_number,
            'market_value': market_value,
            'photo_url': photo_url,
            'transfermarkt_id': tm_id,
            'player_url': player_url,
        }

    def get_player_career(self, player_url: str) -> List[Dict[str, Any]]:
        """
        Pobiera historię kariery zawodnika z /leistungsdaten/saison/ges –
        strona ta zwraca zagregowane statystyki po lidze (all-time).
        Każdy wiersz = jedna liga/rozgrywki, z której wyciągamy nazwę ligi.
        """
        if not player_url:
            return []

        # Wyciągnij ID zawodnika
        id_match = re.search(r'/spieler/(\d+)', player_url)
        if not id_match:
            return []
        player_id = id_match.group(1)

        # Użyj sluga z URL jeśli dostępny, inaczej 'a'
        slug_match = re.match(r'/([^/]+)/(?:profil|leistungsdaten)/spieler/', player_url)
        slug = slug_match.group(1) if slug_match else 'a'

        career_url = f"/{slug}/leistungsdaten/spieler/{player_id}/saison/ges"

        soup = self._respectful_request(career_url)
        if not soup:
            return []

        career = []
        table = soup.find('table', class_='items')
        if not table:
            return []

        rows = table.find_all('tr', class_=['odd', 'even'])

        for row in rows:
            try:
                # Nazwa ligi/rozgrywek – szukaj linku z /wettbewerb/ w href
                league_link = row.find('a', href=lambda h: h and '/wettbewerb/' in h)
                if not league_link:
                    continue
                league_name = (league_link.get('title', '') or league_link.get_text(strip=True)).strip()
                if not league_name:
                    continue

                # Sezony – wyciągnij z linku do szczegółów (saison/YYYY)
                season_start = 0
                season_end = 0
                detail_td = row.find('td', class_='player-profile-performance-data')
                if detail_td:
                    detail_link = detail_td.find('a')
                    if detail_link:
                        href = detail_link.get('href', '')
                        saison_match = re.search(r'/saison/(\d+)', href)
                        if saison_match:
                            year = int(saison_match.group(1))
                            season_end = year
                            season_start = year - 1

                # Występy – pierwsza liczba w td.zentriert
                appearances = 0
                for td in row.find_all('td', class_='zentriert'):
                    text = td.get_text(strip=True)
                    if text.isdigit():
                        appearances = int(text)
                        break

                career.append({
                    'club_name': None,
                    'league': league_name,
                    'season_start': season_start,
                    'season_end': season_end,
                    'appearances': appearances,
                    'goals': 0,
                })

            except Exception:
                continue

        return career

    def get_league_teams_for_season(self, season: int) -> List[Club]:
        """
        Pobiera listę klubów z Ekstraklasy dla danego sezonu.
        Sezon 2023 oznacza sezon 2023/24.
        """
        url = f"/pko-bp-ekstraklasa/startseite/wettbewerb/PL1/plus/?saison_id={season}"
        print(f"Pobieranie klubów Ekstraklasy dla sezonu {season}/{season+1}...")

        soup = self._respectful_request(url)
        if not soup:
            print(f"Nie udało się pobrać strony ligi dla sezonu {season}")
            return []

        clubs = []
        table = soup.find('table', class_='items')
        if not table:
            print(f"Nie znaleziono tabeli klubów dla sezonu {season}")
            return []

        rows = table.find_all('tr')

        for row in rows:
            try:
                club_link = None
                for link in row.find_all('a'):
                    href = link.get('href', '')
                    if '/verein/' in href and '/startseite/' in href:
                        club_link = link
                        break

                if not club_link:
                    continue

                club_name = club_link.get('title', '') or club_link.text.strip()
                if not club_name or club_name in ['name', 'Kadra']:
                    continue

                club_url = club_link.get('href', '')
                tm_id_match = re.search(r'/verein/(\d+)', club_url)
                tm_id = tm_id_match.group(1) if tm_id_match else None

                if any(c.transfermarkt_id == tm_id for c in clubs):
                    continue

                logo_img = row.find('img', class_='tiny_wappen') or row.find('img', class_='bilderrahmen-fixed')
                logo_url = logo_img.get('src', logo_img.get('data-src', '')) if logo_img else None
                name_short = self._get_club_short_name(club_name)

                club = Club(
                    name=club_name,
                    name_short=name_short,
                    league="Ekstraklasa",
                    country="Polska",
                    logo_url=logo_url,
                    transfermarkt_id=tm_id
                )
                clubs.append(club)

            except Exception as e:
                continue

        print(f"  Znaleziono {len(clubs)} klubów dla sezonu {season}/{season+1}")
        return clubs

    def get_team_squad_for_season(self, club: Club, season: int) -> List[Dict[str, Any]]:
        """
        Pobiera skład klubu dla danego sezonu.
        """
        if not club.transfermarkt_id:
            return []

        # Transfermarkt wymaga nazwy klubu w URL
        club_slug = ''.join(c for c in club.name.lower() if c.isalnum() or c == ' ').replace(' ', '-')
        url = f"/{club_slug}/kader/verein/{club.transfermarkt_id}/saison_id/{season}"
        print(f"  Pobieranie składu: {club.name} ({season}/{season+1})")

        soup = self._respectful_request(url)
        if not soup:
            return []

        players = []
        table = soup.find('table', class_='items')
        if not table:
            return []

        rows = table.find_all('tr', class_=['odd', 'even'])

        for row in rows:
            try:
                player_data = self._parse_player_row(row)
                if player_data:
                    player_data['season'] = season
                    players.append(player_data)
            except Exception as e:
                continue

        return players

    def scrape_historical(self, start_season: int = 2010, end_season: int = 2024) -> tuple[List[Club], List[Dict], set]:
        """
        Pobiera wszystkich zawodników z historycznych sezonów Ekstraklasy.

        Args:
            start_season: Pierwszy sezon do pobrania (np. 2010 = sezon 2010/11)
            end_season: Ostatni sezon do pobrania (np. 2024 = sezon 2024/25)

        Returns:
            Tuple z listą klubów, listą zawodników i setem ID już pobranych zawodników
        """
        all_clubs = {}  # tm_id -> Club
        all_players = {}  # tm_id -> player_data (unikalne)
        seen_player_ids = set()

        for season in range(start_season, end_season + 1):
            print(f"\n{'='*60}")
            print(f"SEZON {season}/{season+1}")
            print(f"{'='*60}")

            clubs = self.get_league_teams_for_season(season)

            for club in clubs:
                if club.transfermarkt_id and club.transfermarkt_id not in all_clubs:
                    all_clubs[club.transfermarkt_id] = club

                players = self.get_team_squad_for_season(club, season)
                print(f"    Znaleziono {len(players)} zawodników")

                for player_data in players:
                    tm_id = player_data.get('transfermarkt_id')
                    if tm_id and tm_id not in seen_player_ids:
                        seen_player_ids.add(tm_id)
                        player_data['club'] = club
                        player_data['first_seen_season'] = season
                        all_players[tm_id] = player_data
                    elif tm_id and tm_id in all_players:
                        # Aktualizuj sezon jeśli wcześniejszy
                        if season < all_players[tm_id].get('first_seen_season', 9999):
                            all_players[tm_id]['first_seen_season'] = season

            print(f"\nPodsumowanie po sezonie {season}/{season+1}:")
            print(f"  Łącznie klubów: {len(all_clubs)}")
            print(f"  Łącznie unikalnych zawodników: {len(all_players)}")

        return list(all_clubs.values()), list(all_players.values()), seen_player_ids

    def scrape_all(self) -> tuple[List[Club], List[Dict], List[Dict]]:
        """
        Pobiera wszystkie dane - kluby, zawodników i ich kariery.
        """
        all_clubs = self.get_league_teams()
        all_players = []
        all_careers = []

        for club in all_clubs:
            players = self.get_team_squad(club)

            for player_data in players:
                player_data['club'] = club
                all_players.append(player_data)

                # Pobierz karierę (opcjonalnie, wydłuża scraping)
                # career = self.get_player_career(player_data.get('player_url', ''))
                # for entry in career:
                #     entry['player_tm_id'] = player_data.get('transfermarkt_id')
                #     all_careers.append(entry)

        return all_clubs, all_players, all_careers

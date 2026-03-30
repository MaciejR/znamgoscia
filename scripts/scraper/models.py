"""
Modele danych i funkcje pomocnicze dla scrapera
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional, List
from datetime import date


@dataclass
class Club:
    """Model klubu"""
    name: str
    name_short: Optional[str] = None
    league: str = "Ekstraklasa"
    country: str = "Polska"
    logo_url: Optional[str] = None
    transfermarkt_id: Optional[str] = None


@dataclass
class Player:
    """Model zawodnika"""
    name: str
    name_normalized: str
    birth_date: Optional[date] = None
    age: Optional[int] = None
    nationality: str = ""
    nationality_code: Optional[str] = None
    position: str = ""
    position_detailed: Optional[str] = None
    current_club_id: Optional[int] = None
    jersey_number: Optional[int] = None
    market_value: Optional[int] = None
    photo_url: Optional[str] = None
    transfermarkt_id: Optional[str] = None
    is_active: bool = True


@dataclass
class CareerEntry:
    """Model wpisu w historii kariery"""
    player_id: int
    club_id: Optional[int] = None
    club_name: str = ""
    season_start: Optional[int] = None
    season_end: Optional[int] = None
    appearances: int = 0
    goals: int = 0


# Mapowanie szczegółowych pozycji na ustandaryzowane polskie nazwy
POSITION_DETAILED_MAP = {
    # Angielskie nazwy z Transfermarkt
    'Goalkeeper': 'Bramkarz',
    'Centre-Back': 'Środkowy obrońca',
    'Left-Back': 'Lewy obrońca',
    'Right-Back': 'Prawy obrońca',
    'Defensive Midfield': 'Defensywny pomocnik',
    'Central Midfield': 'Środkowy pomocnik',
    'Attacking Midfield': 'Ofensywny pomocnik',
    'Left Midfield': 'Lewy pomocnik',
    'Right Midfield': 'Prawy pomocnik',
    'Left Winger': 'Lewe skrzydło',
    'Right Winger': 'Prawe skrzydło',
    'Second Striker': 'Środkowy napastnik',
    'Centre-Forward': 'Środkowy napastnik',
    # Polskie warianty (normalizacja do jednego formatu)
    'Bramkarz': 'Bramkarz',
    'Środkowy obrońca': 'Środkowy obrońca',
    'Lewy obrońca': 'Lewy obrońca',
    'Prawy obrońca': 'Prawy obrońca',
    'Defensywny pomocnik': 'Defensywny pomocnik',
    'Środkowy pomocnik': 'Środkowy pomocnik',
    'Ofensywny pomocnik': 'Ofensywny pomocnik',
    'Lewy pomocnik': 'Lewy pomocnik',
    'Prawy pomocnik': 'Prawy pomocnik',
    'Lewe skrzydło': 'Lewy pomocnik',
    'Prawe skrzydło': 'Prawy pomocnik',
    'Cofnięty napastnik': 'Środkowy napastnik',
    'Środkowy napastnik': 'Środkowy napastnik',
}


def normalize_position_detailed(pos_text: str) -> Optional[str]:
    """
    Standaryzuje szczegółową pozycję na polską nazwę.
    Zwraca None jeśli nie udało się zmapować.
    """
    if not pos_text:
        return None
    pos_text = pos_text.strip()
    if pos_text in POSITION_DETAILED_MAP:
        return POSITION_DETAILED_MAP[pos_text]
    # Fallback - zwróć oryginalny tekst
    return pos_text


# Mapowanie pozycji z angielskiego na polski
POSITION_MAP = {
    'Goalkeeper': 'Bramkarz',
    'Centre-Back': 'Obronca',
    'Left-Back': 'Obronca',
    'Right-Back': 'Obronca',
    'Defensive Midfield': 'Pomocnik',
    'Central Midfield': 'Pomocnik',
    'Attacking Midfield': 'Pomocnik',
    'Left Midfield': 'Pomocnik',
    'Right Midfield': 'Pomocnik',
    'Left Winger': 'Pomocnik',
    'Right Winger': 'Pomocnik',
    'Second Striker': 'Napastnik',
    'Centre-Forward': 'Napastnik',
    # Polish variants
    'Bramkarz': 'Bramkarz',
    'Obrońca': 'Obronca',
    'Środkowy obrońca': 'Obronca',
    'Lewy obrońca': 'Obronca',
    'Prawy obrońca': 'Obronca',
    'Pomocnik': 'Pomocnik',
    'Środkowy pomocnik': 'Pomocnik',
    'Defensywny pomocnik': 'Pomocnik',
    'Ofensywny pomocnik': 'Pomocnik',
    'Lewy pomocnik': 'Pomocnik',
    'Prawy pomocnik': 'Pomocnik',
    'Lewe skrzydło': 'Pomocnik',
    'Prawe skrzydło': 'Pomocnik',
    'Napastnik': 'Napastnik',
    'Środkowy napastnik': 'Napastnik',
}

# Mapowanie narodowości na kody ISO
NATIONALITY_CODES = {
    'Polska': 'POL',
    'Poland': 'POL',
    'Brazylia': 'BRA',
    'Brazil': 'BRA',
    'Argentyna': 'ARG',
    'Argentina': 'ARG',
    'Hiszpania': 'ESP',
    'Spain': 'ESP',
    'Portugalia': 'POR',
    'Portugal': 'POR',
    'Niemcy': 'GER',
    'Germany': 'GER',
    'Francja': 'FRA',
    'France': 'FRA',
    'Włochy': 'ITA',
    'Italy': 'ITA',
    'Anglia': 'ENG',
    'England': 'ENG',
    'Holandia': 'NED',
    'Netherlands': 'NED',
    'Belgia': 'BEL',
    'Belgium': 'BEL',
    'Chorwacja': 'CRO',
    'Croatia': 'CRO',
    'Serbia': 'SRB',
    'Ukraina': 'UKR',
    'Ukraine': 'UKR',
    'Czechy': 'CZE',
    'Czech Republic': 'CZE',
    'Słowacja': 'SVK',
    'Slovakia': 'SVK',
    'Słowenia': 'SLO',
    'Slovenia': 'SLO',
    'Austria': 'AUT',
    'Szwajcaria': 'SUI',
    'Switzerland': 'SUI',
    'Grecja': 'GRE',
    'Greece': 'GRE',
    'Turcja': 'TUR',
    'Turkey': 'TUR',
    'Rumunia': 'ROU',
    'Romania': 'ROU',
    'Węgry': 'HUN',
    'Hungary': 'HUN',
    'Bułgaria': 'BUL',
    'Bulgaria': 'BUL',
    'Szwecja': 'SWE',
    'Sweden': 'SWE',
    'Norwegia': 'NOR',
    'Norway': 'NOR',
    'Dania': 'DEN',
    'Denmark': 'DEN',
    'Finlandia': 'FIN',
    'Finland': 'FIN',
    'Islandia': 'ISL',
    'Iceland': 'ISL',
    'Walia': 'WAL',
    'Wales': 'WAL',
    'Szkocja': 'SCO',
    'Scotland': 'SCO',
    'Irlandia': 'IRL',
    'Ireland': 'IRL',
    'Rosja': 'RUS',
    'Russia': 'RUS',
    'USA': 'USA',
    'United States': 'USA',
    'Meksyk': 'MEX',
    'Mexico': 'MEX',
    'Kolumbia': 'COL',
    'Colombia': 'COL',
    'Chile': 'CHI',
    'Urugwaj': 'URU',
    'Uruguay': 'URU',
    'Paragwaj': 'PAR',
    'Paraguay': 'PAR',
    'Peru': 'PER',
    'Ekwador': 'ECU',
    'Ecuador': 'ECU',
    'Wenezuela': 'VEN',
    'Venezuela': 'VEN',
    'Boliwia': 'BOL',
    'Bolivia': 'BOL',
    'Japonia': 'JPN',
    'Japan': 'JPN',
    'Korea Południowa': 'KOR',
    'South Korea': 'KOR',
    'Chiny': 'CHN',
    'China': 'CHN',
    'Australia': 'AUS',
    'Nowa Zelandia': 'NZL',
    'New Zealand': 'NZL',
    'RPA': 'RSA',
    'South Africa': 'RSA',
    'Nigeria': 'NGA',
    'Ghana': 'GHA',
    'Senegal': 'SEN',
    'Kamerun': 'CMR',
    'Cameroon': 'CMR',
    'Wybrzeże Kości Słoniowej': 'CIV',
    'Ivory Coast': 'CIV',
    'Maroko': 'MAR',
    'Morocco': 'MAR',
    'Tunezja': 'TUN',
    'Tunisia': 'TUN',
    'Algieria': 'ALG',
    'Algeria': 'ALG',
    'Egipt': 'EGY',
    'Egypt': 'EGY',
    'Gruzja': 'GEO',
    'Georgia': 'GEO',
    'Armenia': 'ARM',
    'Azerbejdżan': 'AZE',
    'Azerbaijan': 'AZE',
    'Kosowo': 'KOS',
    'Kosovo': 'KOS',
    'Czarnogóra': 'MNE',
    'Montenegro': 'MNE',
    'Macedonia Północna': 'MKD',
    'North Macedonia': 'MKD',
    'Bośnia i Hercegowina': 'BIH',
    'Bosnia and Herzegovina': 'BIH',
    'Albania': 'ALB',
    'Mołdawia': 'MDA',
    'Moldova': 'MDA',
    'Litwa': 'LTU',
    'Lithuania': 'LTU',
    'Łotwa': 'LVA',
    'Latvia': 'LVA',
    'Estonia': 'EST',
    'Białoruś': 'BLR',
    'Belarus': 'BLR',
}


def normalize_name(name: str) -> str:
    """
    Normalizuje nazwisko - usuwa polskie znaki i konwertuje na lowercase.
    """
    # Mapowanie polskich znaków
    polish_chars = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
        'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    }

    result = name
    for polish, latin in polish_chars.items():
        result = result.replace(polish, latin)

    # Normalizacja Unicode (usuwa akcenty)
    result = unicodedata.normalize('NFKD', result)
    result = ''.join(c for c in result if not unicodedata.combining(c))

    return result.lower().strip()


def parse_position(position_str: str) -> str:
    """
    Mapuje pozycję z Transfermarkt na jedną z 4 kategorii.
    """
    position_str = position_str.strip()

    # Sprawdź bezpośrednie mapowanie
    if position_str in POSITION_MAP:
        return POSITION_MAP[position_str]

    # Próbuj dopasować częściowo
    position_lower = position_str.lower()

    if 'goalkeeper' in position_lower or 'bramkarz' in position_lower:
        return 'Bramkarz'
    if 'back' in position_lower or 'obrońca' in position_lower or 'obranca' in position_lower:
        return 'Obronca'
    if 'forward' in position_lower or 'striker' in position_lower or 'napastnik' in position_lower:
        return 'Napastnik'

    # Domyślnie pomocnik
    return 'Pomocnik'


def parse_market_value(value_str: str) -> Optional[int]:
    """
    Parsuje wartość rynkową z formatu Transfermarkt (np. "€1.5m") na liczbę w EUR.
    """
    if not value_str:
        return None

    # Usuń białe znaki i znak euro
    value_str = value_str.strip().replace('€', '').replace(' ', '')

    if not value_str or value_str == '-':
        return None

    try:
        # Sprawdź sufiksy
        multiplier = 1
        if value_str.endswith('m') or value_str.endswith('M') or value_str.endswith('mln'):
            multiplier = 1_000_000
            value_str = re.sub(r'[mM]|mln', '', value_str)
        elif value_str.endswith('k') or value_str.endswith('K') or value_str.endswith('tys.'):
            multiplier = 1_000
            value_str = re.sub(r'[kK]|tys\.?', '', value_str)

        # Zamień przecinek na kropkę
        value_str = value_str.replace(',', '.')

        return int(float(value_str) * multiplier)
    except (ValueError, TypeError):
        return None


def get_nationality_code(nationality: str) -> Optional[str]:
    """
    Zwraca 3-literowy kod ISO dla danej narodowości.
    """
    return NATIONALITY_CODES.get(nationality.strip())


def validate_player(player: Player) -> bool:
    """
    Sprawdza czy zawodnik ma wszystkie wymagane dane.
    """
    if not player.name or not player.name.strip():
        return False
    if not player.nationality:
        return False
    if not player.position:
        return False
    return True


def calculate_age(birth_date: Optional[date]) -> Optional[int]:
    """
    Oblicza wiek na podstawie daty urodzenia.
    """
    if not birth_date:
        return None

    today = date.today()
    age = today.year - birth_date.year

    # Sprawdź czy urodziny już były w tym roku
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1

    return age

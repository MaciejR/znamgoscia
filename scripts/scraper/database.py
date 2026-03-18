"""
Moduł do zapisywania danych w Supabase
"""

import os
from typing import List, Dict, Any, Optional
from datetime import date
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Tworzy klienta Supabase"""
    url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    # Nowe klucze API (2024/2025)
    key = os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables")

    return create_client(url, key)


class DatabaseManager:
    """Zarządza operacjami na bazie danych"""

    def __init__(self):
        self.client = get_supabase_client()

    def upsert_club(self, club_data: Dict[str, Any]) -> Optional[int]:
        """
        Dodaje lub aktualizuje klub w bazie.
        Zwraca ID klubu.
        """
        try:
            # Sprawdź czy klub istnieje
            existing = self.client.table('clubs').select('id').eq(
                'transfermarkt_id', club_data.get('transfermarkt_id')
            ).execute()

            if existing.data:
                # Aktualizuj
                result = self.client.table('clubs').update(club_data).eq(
                    'transfermarkt_id', club_data.get('transfermarkt_id')
                ).execute()
                return existing.data[0]['id']
            else:
                # Dodaj nowy
                result = self.client.table('clubs').insert(club_data).execute()
                return result.data[0]['id'] if result.data else None

        except Exception as e:
            print(f"Error upserting club: {e}")
            return None

    def upsert_player(self, player_data: Dict[str, Any]) -> Optional[int]:
        """
        Dodaje lub aktualizuje zawodnika w bazie.
        Zwraca ID zawodnika.
        """
        try:
            # Konwertuj datę na string jeśli potrzeba
            if 'birth_date' in player_data and isinstance(player_data['birth_date'], date):
                player_data['birth_date'] = player_data['birth_date'].isoformat()

            # Usuń pola, które nie są w bazie
            player_data = {k: v for k, v in player_data.items()
                          if k not in ['player_url', 'club']}

            # Sprawdź czy zawodnik istnieje
            existing = self.client.table('players').select('id').eq(
                'transfermarkt_id', player_data.get('transfermarkt_id')
            ).execute()

            if existing.data:
                # Aktualizuj
                result = self.client.table('players').update(player_data).eq(
                    'transfermarkt_id', player_data.get('transfermarkt_id')
                ).execute()
                return existing.data[0]['id']
            else:
                # Dodaj nowy
                result = self.client.table('players').insert(player_data).execute()
                return result.data[0]['id'] if result.data else None

        except Exception as e:
            print(f"Error upserting player: {e}")
            return None

    # Cache: whether the 'league' column exists in career_history (None = unknown)
    _league_col_exists: bool | None = None

    def _has_league_column(self) -> bool:
        """Check once whether career_history.league column exists."""
        if self.__class__._league_col_exists is None:
            try:
                self.client.table('career_history').select('league').limit(1).execute()
                self.__class__._league_col_exists = True
            except Exception:
                self.__class__._league_col_exists = False
        return self.__class__._league_col_exists

    def add_career_entry(self, career_data: Dict[str, Any]) -> bool:
        """
        Dodaje wpis w historii kariery. Jeśli wpis istnieje i nie ma ligi, aktualizuje ją.
        Obsługuje wpisy z club_name=None (np. z leistungsdaten – tylko info o lidze).
        Gracefully handles missing 'league' column (migration 003 not yet applied).
        """
        try:
            club_name = career_data.get('club_name')
            season_start = career_data.get('season_start')
            player_id = career_data.get('player_id')

            has_league = self._has_league_column()

            # Strip league from data if column doesn't exist yet
            if not has_league:
                career_data = {k: v for k, v in career_data.items() if k != 'league'}

            select_cols = 'id, league' if has_league else 'id'
            query = self.client.table('career_history').select(select_cols).eq('player_id', player_id)

            if club_name is None:
                # Duplikat szukamy po player_id + league (nie ma club_name)
                league = career_data.get('league')
                if not league and has_league:
                    return True  # Nic sensownego do zapisania
                if has_league:
                    existing = query.is_('club_name', 'null').eq('league', league).execute()
                else:
                    return True  # Without league column, can't deduplicate league-only entries
            else:
                existing = query.eq('club_name', club_name).eq('season_start', season_start).execute()

            if not existing.data:
                self.client.table('career_history').insert(career_data).execute()
            elif has_league and career_data.get('league') and not existing.data[0].get('league'):
                # Uzupełnij brakującą ligę dla istniejącego wpisu
                self.client.table('career_history').update(
                    {'league': career_data['league']}
                ).eq('id', existing.data[0]['id']).execute()

            return True
        except Exception as e:
            print(f"Error adding career entry: {e}")
            return False

    def get_all_clubs(self) -> List[Dict[str, Any]]:
        """Pobiera wszystkie kluby"""
        result = self.client.table('clubs').select('*').execute()
        return result.data or []

    def get_all_active_players(self) -> List[Dict[str, Any]]:
        """Pobiera wszystkich aktywnych zawodników"""
        result = self.client.table('players').select('*').eq('is_active', True).execute()
        return result.data or []

    def get_random_player_for_daily(
        self,
        exclude_days: int = 30,
        min_appearances: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Pobiera losowego zawodnika, który nie był w ostatnich N dniach.
        min_appearances – minimalna łączna liczba występów w karierze (None = brak filtru).
        Domyślną wartość można ustawić przez zmienną środowiskową MIN_DAILY_APPEARANCES.
        """
        import random

        if min_appearances is None:
            env_val = os.environ.get('MIN_DAILY_APPEARANCES')
            min_appearances = int(env_val) if env_val and env_val.isdigit() else 10

        try:
            # Pobierz ID zawodników z ostatnich dni
            recent = self.client.table('daily_players').select('player_id').order(
                'date', desc=True
            ).limit(exclude_days).execute()

            recent_ids = {r['player_id'] for r in (recent.data or [])}

            # Pobierz wszystkich aktywnych zawodników
            all_players = self.client.table('players').select('*').eq('is_active', True).execute().data or []

            # Odfiltruj tych, którzy byli niedawno
            available = [p for p in all_players if p['id'] not in recent_ids]

            # Filtruj po minimalnej liczbie występów (tylko gdy próg > 0)
            if min_appearances > 0 and available:
                player_ids = [p['id'] for p in available]
                career_rows = self.client.table('career_history').select(
                    'player_id, appearances'
                ).in_('player_id', player_ids).execute().data or []

                appearances_by_player: Dict[int, int] = {}
                for row in career_rows:
                    pid = row['player_id']
                    apps = row.get('appearances') or 0
                    appearances_by_player[pid] = appearances_by_player.get(pid, 0) + apps

                eligible = [
                    p for p in available
                    if appearances_by_player.get(p['id'], 0) >= min_appearances
                ]

                # Fallback: jeśli filtr wyklucza wszystkich, ignoruj próg
                if eligible:
                    available = eligible
                else:
                    print(f"Warning: no players meet min_appearances={min_appearances}, ignoring filter")

            if not available:
                # Ostateczny fallback: dowolny aktywny zawodnik
                available = all_players

            return random.choice(available) if available else None

        except Exception as e:
            print(f"Error getting random player: {e}")
            return None

    def set_daily_player(self, player_id: int, for_date: Optional[date] = None) -> bool:
        """
        Ustawia zawodnika dnia.
        """
        try:
            target_date = for_date or date.today()

            # Sprawdź czy już istnieje
            existing = self.client.table('daily_players').select('id').eq(
                'date', target_date.isoformat()
            ).execute()

            if existing.data:
                # Aktualizuj
                self.client.table('daily_players').update({
                    'player_id': player_id
                }).eq('date', target_date.isoformat()).execute()
            else:
                # Dodaj nowy
                self.client.table('daily_players').insert({
                    'date': target_date.isoformat(),
                    'player_id': player_id
                }).execute()

            return True

        except Exception as e:
            print(f"Error setting daily player: {e}")
            return False

    def get_club_by_tm_id(self, tm_id: str) -> Optional[Dict[str, Any]]:
        """Pobiera klub po ID Transfermarkt"""
        if not tm_id:
            return None
        result = self.client.table('clubs').select('*').eq('transfermarkt_id', tm_id).execute()
        return result.data[0] if result.data else None

    def get_player_by_tm_id(self, tm_id: str) -> Optional[Dict[str, Any]]:
        """Pobiera zawodnika po ID Transfermarkt"""
        if not tm_id:
            return None
        result = self.client.table('players').select('id, transfermarkt_id').eq('transfermarkt_id', tm_id).execute()
        return result.data[0] if result.data else None

    def get_daily_player(self, for_date: Optional[date] = None) -> Optional[Dict[str, Any]]:
        """
        Pobiera zawodnika dnia.
        """
        try:
            target_date = for_date or date.today()

            result = self.client.table('daily_players').select(
                '*, players(*)'
            ).eq('date', target_date.isoformat()).execute()

            if result.data:
                return result.data[0]
            return None

        except Exception as e:
            print(f"Error getting daily player: {e}")
            return None

    def mark_players_inactive(self, active_tm_ids: List[str]) -> int:
        """
        Oznacza zawodników jako nieaktywnych, jeśli nie są na liście.
        Zwraca liczbę dezaktywowanych.
        """
        try:
            # Pobierz wszystkich aktywnych
            all_active = self.client.table('players').select('id', 'transfermarkt_id').eq(
                'is_active', True
            ).execute()

            count = 0
            for player in (all_active.data or []):
                if player.get('transfermarkt_id') not in active_tm_ids:
                    self.client.table('players').update({
                        'is_active': False
                    }).eq('id', player['id']).execute()
                    count += 1

            return count

        except Exception as e:
            print(f"Error marking players inactive: {e}")
            return 0

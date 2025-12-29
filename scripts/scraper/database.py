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

    def add_career_entry(self, career_data: Dict[str, Any]) -> bool:
        """
        Dodaje wpis w historii kariery.
        """
        try:
            # Sprawdź czy wpis już istnieje
            existing = self.client.table('career_history').select('id').eq(
                'player_id', career_data.get('player_id')
            ).eq(
                'club_name', career_data.get('club_name')
            ).eq(
                'season_start', career_data.get('season_start')
            ).execute()

            if not existing.data:
                self.client.table('career_history').insert(career_data).execute()

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

    def get_random_player_for_daily(self, exclude_days: int = 30) -> Optional[Dict[str, Any]]:
        """
        Pobiera losowego zawodnika, który nie był w ostatnich N dniach.
        """
        try:
            # Pobierz ID zawodników z ostatnich dni
            recent = self.client.table('daily_players').select('player_id').order(
                'date', desc=True
            ).limit(exclude_days).execute()

            recent_ids = [r['player_id'] for r in (recent.data or [])]

            # Pobierz losowego zawodnika
            query = self.client.table('players').select('*').eq('is_active', True)

            if recent_ids:
                # Supabase nie ma not in, więc filtrujemy po stronie klienta
                all_players = query.execute()
                available = [p for p in (all_players.data or []) if p['id'] not in recent_ids]
            else:
                available = query.execute().data or []

            if not available:
                # Jeśli wszyscy byli ostatnio, wybierz kogokolwiek
                available = self.client.table('players').select('*').eq('is_active', True).execute().data or []

            if available:
                import random
                return random.choice(available)

            return None

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

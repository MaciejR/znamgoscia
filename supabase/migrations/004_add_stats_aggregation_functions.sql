-- Funkcja agregująca statystyki w bazie danych
-- Zastępuje pobieranie całej tabeli game_stats do pamięci JS

-- Statystyki dla konkretnego dnia
CREATE OR REPLACE FUNCTION get_daily_stats(target_date DATE)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalGames', COUNT(*),
    'wonGames', COUNT(*) FILTER (WHERE won),
    'winRate', CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE won))::numeric / COUNT(*) * 100)
      ELSE 0
    END,
    'avgGuesses', CASE
      WHEN COUNT(*) FILTER (WHERE won) > 0
      THEN ROUND(AVG(guesses_count) FILTER (WHERE won), 1)
      ELSE 0
    END,
    'distribution', (
      SELECT json_agg(cnt ORDER BY bucket)
      FROM (
        SELECT
          bucket,
          COALESCE(COUNT(*) FILTER (WHERE won AND guesses_count = bucket), 0) AS cnt
        FROM generate_series(1, 8) AS bucket
        LEFT JOIN game_stats gs ON gs.date = target_date AND gs.won AND gs.guesses_count = bucket
        GROUP BY bucket
      ) d
    )
  ) INTO result
  FROM game_stats
  WHERE date = target_date;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

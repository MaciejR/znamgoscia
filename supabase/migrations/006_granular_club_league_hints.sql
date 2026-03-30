-- Granularne śledzenie klubów i lig w podpowiedziach
-- Zamiast binarnego "ma wspólny klub" → przechowujemy KTÓRE kluby/ligi się pokrywają

-- Nowe kolumny
ALTER TABLE daily_hints
  ADD COLUMN IF NOT EXISTS matching_clubs TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS matching_leagues TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Zaktualizowana funkcja precompute z granularnymi klubami/ligami
CREATE OR REPLACE FUNCTION precompute_daily_hints(
    target_date DATE,
    answer_player_id INTEGER,
    min_appearances INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
    answer RECORD;
    answer_clubs TEXT[];
    answer_leagues TEXT[];
    inserted_count INTEGER;
BEGIN
    -- Usuń stare podpowiedzi dla tej daty
    DELETE FROM daily_hints WHERE date = target_date;

    -- Pobierz dane odpowiedzi
    SELECT * INTO answer FROM players WHERE id = answer_player_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- Pobierz kluby i ligi odpowiedzi
    SELECT
        COALESCE(array_agg(DISTINCT lower(club_name)) FILTER (WHERE club_name IS NOT NULL), ARRAY[]::TEXT[]),
        COALESCE(array_agg(DISTINCT lower(league)) FILTER (WHERE league IS NOT NULL), ARRAY[]::TEXT[])
    INTO answer_clubs, answer_leagues
    FROM career_history
    WHERE player_id = answer_player_id;

    -- Jeden INSERT...SELECT z granularnymi klubami/ligami
    WITH candidates AS (
        SELECT
            p.id,
            p.nationality,
            p.is_active,
            p.position,
            p.position_detailed,
            p.age,
            array_agg(DISTINCT lower(ch.club_name)) FILTER (WHERE ch.club_name IS NOT NULL) AS clubs,
            array_agg(DISTINCT lower(ch.league)) FILTER (WHERE ch.league IS NOT NULL) AS leagues
        FROM players p
        LEFT JOIN career_history ch ON ch.player_id = p.id
        WHERE p.id != answer_player_id
          AND p.age IS NOT NULL
          AND p.position_detailed IS NOT NULL
          AND p.nationality IS NOT NULL
        GROUP BY p.id
        HAVING COALESCE(SUM(ch.appearances), 0) >= min_appearances
    ),
    with_attrs AS (
        SELECT
            c.id AS player_id,
            ARRAY_REMOVE(ARRAY[
                CASE WHEN lower(c.nationality) = lower(answer.nationality) THEN 'nationality' END,
                CASE WHEN c.is_active = answer.is_active THEN 'career_status' END,
                CASE WHEN lower(c.position) = lower(answer.position) THEN 'position' END,
                CASE WHEN c.position_detailed IS NOT NULL AND answer.position_detailed IS NOT NULL
                     AND lower(c.position_detailed) = lower(answer.position_detailed)
                     THEN 'position_detailed' END,
                CASE WHEN c.clubs IS NOT NULL AND answer_clubs != ARRAY[]::TEXT[]
                     AND c.clubs && answer_clubs THEN 'club_history' END,
                CASE WHEN c.leagues IS NOT NULL AND answer_leagues != ARRAY[]::TEXT[]
                     AND c.leagues && answer_leagues THEN 'league_history' END,
                CASE WHEN c.age IS NOT NULL AND answer.age IS NOT NULL
                     AND ABS(c.age - answer.age) <= 3 THEN 'age' END
            ], NULL) AS matching_attrs,
            -- Granularne: konkretne wspólne kluby i ligi
            COALESCE(
                (SELECT array_agg(x) FROM unnest(c.clubs) x WHERE x = ANY(answer_clubs)),
                ARRAY[]::TEXT[]
            ) AS common_clubs,
            COALESCE(
                (SELECT array_agg(x) FROM unnest(c.leagues) x WHERE x = ANY(answer_leagues)),
                ARRAY[]::TEXT[]
            ) AS common_leagues
        FROM candidates c
    )
    INSERT INTO daily_hints (date, player_id, matching_attributes, matching_clubs, matching_leagues)
    SELECT target_date, player_id, matching_attrs, common_clubs, common_leagues
    FROM with_attrs
    WHERE array_length(matching_attrs, 1) > 0;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

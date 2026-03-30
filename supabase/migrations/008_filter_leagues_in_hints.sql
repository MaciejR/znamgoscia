-- Filtrowanie lig w prekomputowanych hintach:
-- Pomijamy puchary krajowe (ale nie międzynarodowe) i rozgrywki młodzieżowe poniżej U-19

CREATE OR REPLACE FUNCTION is_league_included(league_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
    IF league_name IS NULL OR league_name = '' THEN
        RETURN FALSE;
    END IF;

    -- Rozgrywki młodzieżowe poniżej U-19
    IF league_name ~* '\mU[- ]?(1[0-8]|[1-9])\M' THEN
        RETURN FALSE;
    END IF;

    -- Puchary krajowe (ale nie międzynarodowe)
    IF league_name ~* '(puchar|cup|pokal|copa|coppa|coupe|tac[aą]|taça)' THEN
        -- Zachowaj międzynarodowe
        IF league_name ~* '(liga mistrz|liga europ|liga konferencji|champions league|europa league|conference league|uefa|puchar zdobywc|superpuchar europ|intercontinental|puchar intertoto)' THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Zaktualizowana funkcja precompute z filtrowaniem lig
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
    DELETE FROM daily_hints WHERE date = target_date;

    SELECT * INTO answer FROM players WHERE id = answer_player_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    SELECT
        COALESCE(array_agg(DISTINCT lower(club_name)) FILTER (WHERE club_name IS NOT NULL), ARRAY[]::TEXT[]),
        COALESCE(array_agg(DISTINCT lower(league)) FILTER (WHERE league IS NOT NULL AND is_league_included(league)), ARRAY[]::TEXT[])
    INTO answer_clubs, answer_leagues
    FROM career_history
    WHERE player_id = answer_player_id;

    WITH candidates AS (
        SELECT
            p.id,
            p.nationality,
            p.is_active,
            p.position,
            p.position_detailed,
            p.age,
            array_agg(DISTINCT lower(ch.club_name)) FILTER (WHERE ch.club_name IS NOT NULL) AS clubs,
            array_agg(DISTINCT lower(ch.league)) FILTER (WHERE ch.league IS NOT NULL AND is_league_included(ch.league)) AS leagues
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

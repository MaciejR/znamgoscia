-- Tabela precomputowanych podpowiedzi dziennych
-- Generowana przez cron razem z wyborem daily playera

CREATE TABLE IF NOT EXISTS daily_hints (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id),
    matching_attributes TEXT[] NOT NULL,  -- np. {'nationality', 'position', 'club_history'}
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_hints_date ON daily_hints(date);

-- RLS
ALTER TABLE daily_hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on daily_hints"
    ON daily_hints FOR SELECT
    USING (true);

-- Funkcja do precomputowania podpowiedzi dla danego dnia
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
    inserted_count INTEGER := 0;
    candidate RECORD;
    matching_attrs TEXT[];
BEGIN
    -- Usuń stare podpowiedzi dla tej daty
    DELETE FROM daily_hints WHERE date = target_date;

    -- Pobierz dane odpowiedzi
    SELECT * INTO answer FROM players WHERE id = answer_player_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- Pobierz kluby i ligi odpowiedzi
    SELECT
        array_agg(DISTINCT lower(club_name)) FILTER (WHERE club_name IS NOT NULL),
        array_agg(DISTINCT lower(league)) FILTER (WHERE league IS NOT NULL)
    INTO answer_clubs, answer_leagues
    FROM career_history
    WHERE player_id = answer_player_id;

    answer_clubs := COALESCE(answer_clubs, ARRAY[]::TEXT[]);
    answer_leagues := COALESCE(answer_leagues, ARRAY[]::TEXT[]);

    -- Iteruj po kandydatach z min. liczbą występów, kompletne dane
    FOR candidate IN
        SELECT
            p.id,
            p.nationality,
            p.is_active,
            p.position,
            p.position_detailed,
            p.birth_date,
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
    LOOP
        matching_attrs := ARRAY[]::TEXT[];

        -- Nationality
        IF lower(candidate.nationality) = lower(answer.nationality) THEN
            matching_attrs := array_append(matching_attrs, 'nationality');
        END IF;

        -- Career status
        IF candidate.is_active = answer.is_active THEN
            matching_attrs := array_append(matching_attrs, 'career_status');
        END IF;

        -- Position
        IF lower(candidate.position) = lower(answer.position) THEN
            matching_attrs := array_append(matching_attrs, 'position');
        END IF;

        -- Position detailed
        IF candidate.position_detailed IS NOT NULL AND answer.position_detailed IS NOT NULL
           AND lower(candidate.position_detailed) = lower(answer.position_detailed) THEN
            matching_attrs := array_append(matching_attrs, 'position_detailed');
        END IF;

        -- Club history
        IF candidate.clubs IS NOT NULL AND answer_clubs != ARRAY[]::TEXT[]
           AND candidate.clubs && answer_clubs THEN
            matching_attrs := array_append(matching_attrs, 'club_history');
        END IF;

        -- League history
        IF candidate.leagues IS NOT NULL AND answer_leagues != ARRAY[]::TEXT[]
           AND candidate.leagues && answer_leagues THEN
            matching_attrs := array_append(matching_attrs, 'league_history');
        END IF;

        -- Age (±3 lata)
        IF candidate.age IS NOT NULL AND answer.age IS NOT NULL
           AND ABS(candidate.age - answer.age) <= 3 THEN
            matching_attrs := array_append(matching_attrs, 'age');
        END IF;

        -- Dodaj tylko jeśli ma przynajmniej 1 pasujący atrybut
        IF array_length(matching_attrs, 1) > 0 THEN
            INSERT INTO daily_hints (date, player_id, matching_attributes)
            VALUES (target_date, candidate.id, matching_attrs);
            inserted_count := inserted_count + 1;
        END IF;
    END LOOP;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

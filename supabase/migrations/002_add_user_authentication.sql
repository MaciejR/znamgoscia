-- Add User Authentication Support
-- Enables login, registration, and user-specific statistics tracking

-- Rozszerz tabelę game_stats o user_id (opcjonalne - dla zalogowanych użytkowników)
ALTER TABLE game_stats ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indeks dla szybkiego wyszukiwania statystyk użytkownika
CREATE INDEX IF NOT EXISTS idx_game_stats_user ON game_stats(user_id);

-- Tabela profilów użytkowników (dodatkowe dane poza auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indeks dla wyszukiwania po username
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Tabela statystyk użytkownika (agregowane)
CREATE TABLE IF NOT EXISTS user_statistics (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    guess_distribution INTEGER[] DEFAULT ARRAY[0,0,0,0,0,0,0,0], -- indeksy 0-7 dla prób 1-8
    last_played_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Funkcja do automatycznego tworzenia profilu użytkownika po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NULL),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );

    INSERT INTO public.user_statistics (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger do tworzenia profilu przy nowym użytkowniku
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger dla updated_at w user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger dla updated_at w user_statistics
CREATE TRIGGER update_user_statistics_updated_at
    BEFORE UPDATE ON user_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;

-- Polityki RLS dla user_profiles
-- Wszyscy mogą czytać publiczne profile
CREATE POLICY "Allow public read access on user_profiles"
    ON user_profiles FOR SELECT
    USING (true);

-- Użytkownicy mogą aktualizować tylko swoje profile
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Polityki RLS dla user_statistics
-- Użytkownicy mogą czytać tylko swoje statystyki
CREATE POLICY "Users can read own statistics"
    ON user_statistics FOR SELECT
    USING (auth.uid() = user_id);

-- Użytkownicy mogą aktualizować tylko swoje statystyki
CREATE POLICY "Users can update own statistics"
    ON user_statistics FOR UPDATE
    USING (auth.uid() = user_id);

-- Polityki RLS dla game_stats z user_id
-- Aktualizuj istniejącą politykę insert aby obsługiwać user_id
DROP POLICY IF EXISTS "Allow public insert on game_stats" ON game_stats;
CREATE POLICY "Allow authenticated and anonymous insert on game_stats"
    ON game_stats FOR INSERT
    WITH CHECK (
        -- Pozwól na insert jeśli user_id jest null (gość)
        -- lub user_id pasuje do zalogowanego użytkownika
        user_id IS NULL OR user_id = auth.uid()
    );

-- Użytkownicy mogą czytać swoje statystyki
CREATE POLICY "Users can read own game stats"
    ON game_stats FOR SELECT
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Funkcja do aktualizacji user_statistics na podstawie game_stats
CREATE OR REPLACE FUNCTION update_user_statistics_from_game()
RETURNS TRIGGER AS $$
DECLARE
    last_date DATE;
    last_won BOOLEAN;
BEGIN
    -- Tylko dla zalogowanych użytkowników
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Pobierz ostatnią datę i wynik
    SELECT last_played_date, (SELECT won FROM game_stats
                              WHERE user_id = NEW.user_id
                              AND date = last_played_date
                              LIMIT 1)
    INTO last_date, last_won
    FROM user_statistics
    WHERE user_id = NEW.user_id;

    -- Aktualizuj statystyki
    UPDATE user_statistics
    SET
        games_played = games_played + 1,
        games_won = games_won + CASE WHEN NEW.won THEN 1 ELSE 0 END,
        current_streak = CASE
            -- Jeśli wygrał i poprzednia gra była wczoraj i wygrał
            WHEN NEW.won AND last_date = NEW.date - INTERVAL '1 day' AND last_won THEN current_streak + 1
            -- Jeśli wygrał i to pierwsza gra
            WHEN NEW.won AND last_date IS NULL THEN 1
            -- Jeśli wygrał po przerwie
            WHEN NEW.won THEN 1
            -- Jeśli przegrał
            ELSE 0
        END,
        max_streak = GREATEST(
            max_streak,
            CASE
                WHEN NEW.won AND last_date = NEW.date - INTERVAL '1 day' AND last_won THEN current_streak + 1
                WHEN NEW.won THEN 1
                ELSE current_streak
            END
        ),
        guess_distribution = CASE
            WHEN NEW.won AND NEW.guesses_count >= 1 AND NEW.guesses_count <= 8 THEN
                guess_distribution[:NEW.guesses_count-1] ||
                ARRAY[guess_distribution[NEW.guesses_count] + 1] ||
                guess_distribution[NEW.guesses_count+1:]
            ELSE guess_distribution
        END,
        last_played_date = NEW.date,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger do automatycznej aktualizacji user_statistics
DROP TRIGGER IF EXISTS on_game_stats_insert ON game_stats;
CREATE TRIGGER on_game_stats_insert
    AFTER INSERT ON game_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics_from_game();

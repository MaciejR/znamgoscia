-- Ekstra Typ - Initial Database Schema
-- Polish Football Quiz Game

-- Tabela klubów
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_short VARCHAR(10),                    -- np. "LEG", "LPO"
    league VARCHAR(50) NOT NULL,               -- "Ekstraklasa", "I Liga", "Zagraniczna"
    country VARCHAR(50) DEFAULT 'Polska',
    logo_url TEXT,
    transfermarkt_id VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela zawodników
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_normalized VARCHAR(100) NOT NULL,     -- bez polskich znaków, lowercase
    birth_date DATE,
    age INTEGER,                               -- wyliczane przy imporcie
    nationality VARCHAR(50) NOT NULL,
    nationality_code VARCHAR(3),               -- kod ISO, np. "POL", "BRA"
    position VARCHAR(20) NOT NULL,             -- "Bramkarz", "Obronca", "Pomocnik", "Napastnik"
    position_detailed VARCHAR(50),             -- np. "Środkowy obrońca", "Lewy skrzydłowy"
    current_club_id INTEGER REFERENCES clubs(id),
    jersey_number INTEGER,
    market_value INTEGER,                      -- w EUR
    photo_url TEXT,
    transfermarkt_id VARCHAR(20) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indeks dla szybkiego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_players_name_normalized ON players(name_normalized);
CREATE INDEX IF NOT EXISTS idx_players_current_club ON players(current_club_id);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);

-- Historia kariery zawodnika
CREATE TABLE IF NOT EXISTS career_history (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id),
    club_name VARCHAR(100),                    -- dla klubów spoza bazy
    season_start INTEGER,                      -- np. 2020
    season_end INTEGER,                        -- np. 2023, NULL = obecnie
    appearances INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_player ON career_history(player_id);
CREATE INDEX IF NOT EXISTS idx_career_club ON career_history(club_id);

-- Codzienny zawodnik
CREATE TABLE IF NOT EXISTS daily_players (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    player_id INTEGER REFERENCES players(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_players(date);

-- Statystyki gry (opcjonalne, dla anonimowych statystyk)
CREATE TABLE IF NOT EXISTS game_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    guesses_count INTEGER NOT NULL,            -- ile prób potrzebował
    won BOOLEAN NOT NULL,
    session_id VARCHAR(100),                   -- hash dla anonimowości
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_stats_date ON game_stats(date);
CREATE INDEX IF NOT EXISTS idx_game_stats_session ON game_stats(session_id);

-- View dla łatwego pobierania danych zawodnika
CREATE OR REPLACE VIEW players_with_club AS
SELECT
    p.*,
    c.name as club_name,
    c.name_short as club_short,
    c.league as club_league,
    c.logo_url as club_logo
FROM players p
LEFT JOIN clubs c ON p.current_club_id = c.id
WHERE p.is_active = TRUE;

-- Row Level Security (RLS)
-- Włącz RLS dla wszystkich tabel
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

-- Publiczny odczyt dla wszystkich tabel
CREATE POLICY "Allow public read access on clubs"
    ON clubs FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on players"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on career_history"
    ON career_history FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on daily_players"
    ON daily_players FOR SELECT
    USING (true);

-- Dla game_stats pozwalamy na insert (anonimowe statystyki)
CREATE POLICY "Allow public read access on game_stats"
    ON game_stats FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert on game_stats"
    ON game_stats FOR INSERT
    WITH CHECK (true);

-- Funkcja do aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger dla updated_at
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

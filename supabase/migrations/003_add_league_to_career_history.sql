-- Dodaj kolumnę league do career_history
-- Potrzebna do sprawdzania "league_history" w mechanice gry
ALTER TABLE career_history ADD COLUMN IF NOT EXISTS league VARCHAR(50);

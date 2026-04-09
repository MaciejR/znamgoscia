-- Przemapowanie pozycji skrzydłowych na napastników
-- Aktualizacja position_detailed oraz position (podstawowa)

-- Lewy/Prawy pomocnik → Lewy/Prawy napastnik
UPDATE players SET position_detailed = 'Lewy napastnik', position = 'Napastnik' WHERE position_detailed = 'Lewy pomocnik';
UPDATE players SET position_detailed = 'Prawy napastnik', position = 'Napastnik' WHERE position_detailed = 'Prawy pomocnik';

-- Aktualizacja podstawowej pozycji dla graczy którzy już mają position_detailed = Lewy/Prawy napastnik
-- (z poprzedniej migracji 007 dla Lewe/Prawe skrzydło)
UPDATE players SET position = 'Napastnik' WHERE position_detailed = 'Lewy napastnik' AND position != 'Napastnik';
UPDATE players SET position = 'Napastnik' WHERE position_detailed = 'Prawy napastnik' AND position != 'Napastnik';

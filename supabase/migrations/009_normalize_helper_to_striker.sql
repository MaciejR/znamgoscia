-- Lewy/Prawy pomocnik -> Lewy/Prawy napastnik (standaryzacja position_detailed)
UPDATE players SET position_detailed = 'Lewy napastnik' WHERE position_detailed = 'Lewy pomocnik';
UPDATE players SET position_detailed = 'Prawy napastnik' WHERE position_detailed = 'Prawy pomocnik';

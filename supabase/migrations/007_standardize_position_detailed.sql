-- Standaryzacja position_detailed
UPDATE players SET position_detailed = 'Lewy napastnik' WHERE position_detailed = 'Lewe skrzydło';
UPDATE players SET position_detailed = 'Prawy napastnik' WHERE position_detailed = 'Prawe skrzydło';
UPDATE players SET position_detailed = 'Środkowy napastnik' WHERE position_detailed = 'Cofnięty napastnik';

-- Standaryzacja position_detailed: angielskie nazwy → polskie
UPDATE players SET position_detailed = 'Bramkarz' WHERE position_detailed = 'Goalkeeper';
UPDATE players SET position_detailed = 'Środkowy obrońca' WHERE position_detailed = 'Centre-Back';
UPDATE players SET position_detailed = 'Lewy obrońca' WHERE position_detailed = 'Left-Back';
UPDATE players SET position_detailed = 'Prawy obrońca' WHERE position_detailed = 'Right-Back';
UPDATE players SET position_detailed = 'Defensywny pomocnik' WHERE position_detailed = 'Defensive Midfield';
UPDATE players SET position_detailed = 'Środkowy pomocnik' WHERE position_detailed = 'Central Midfield';
UPDATE players SET position_detailed = 'Ofensywny pomocnik' WHERE position_detailed = 'Attacking Midfield';
UPDATE players SET position_detailed = 'Lewy pomocnik' WHERE position_detailed = 'Left Midfield';
UPDATE players SET position_detailed = 'Prawy pomocnik' WHERE position_detailed = 'Right Midfield';
UPDATE players SET position_detailed = 'Lewy pomocnik' WHERE position_detailed IN ('Left Winger', 'Lewe skrzydło');
UPDATE players SET position_detailed = 'Prawy pomocnik' WHERE position_detailed IN ('Right Winger', 'Prawe skrzydło');
UPDATE players SET position_detailed = 'Środkowy napastnik' WHERE position_detailed IN ('Second Striker', 'Centre-Forward', 'Cofnięty napastnik');

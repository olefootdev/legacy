-- Reset da Liga Global: zera stats/pontos de todos os times.
-- Mantém registros (nome, manager_id, club_name, overall, jogadores).
-- Prepara para nova temporada.
UPDATE public.global_league_teams SET
  points = 0,
  matches_played = 0,
  wins = 0,
  draws = 0,
  losses = 0,
  goals_for = 0,
  goals_against = 0,
  goal_difference = 0;

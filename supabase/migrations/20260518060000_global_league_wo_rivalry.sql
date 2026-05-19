-- Adiciona colunas para WO (available_player_count) e Rivalidade (rivalry_encounters)
-- na tabela global_league_teams.

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS available_player_count integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS rivalry_encounters jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN global_league_teams.available_player_count IS
  'Jogadores disponíveis (synced pelo cliente). Edge Function usa para WO (<11 = derrota 3x0).';

COMMENT ON COLUMN global_league_teams.rivalry_encounters IS
  'Confrontos na temporada: {opponentTeamId: count}. 3+ = clássico (probabilidades aumentadas).';

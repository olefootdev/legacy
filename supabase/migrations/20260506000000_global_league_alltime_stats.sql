-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: estatísticas ALL-TIME
--
-- Adiciona colunas all_time_* em global_league_teams para acumular pontos,
-- vitórias, gols etc. ao longo de todas as temporadas. Diferente das colunas
-- `points`/`wins`/etc. (que zeram a cada temporada para reorganização de
-- divisões via promoção/rebaixamento), as all_time_* JAMAIS zeram.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS all_time_points INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_matches_played INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_wins INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_draws INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_losses INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_goals_for INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_goals_against INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_seasons_played INTEGER DEFAULT 0 NOT NULL;

-- Backfill: copia os valores atuais (que ainda não foram zerados) como base
-- inicial. Times que já passaram por reset perdem histórico anterior, mas a
-- partir daqui o all-time acumula corretamente.
UPDATE global_league_teams
SET
  all_time_points = COALESCE(points, 0),
  all_time_matches_played = COALESCE(matches_played, 0),
  all_time_wins = COALESCE(wins, 0),
  all_time_draws = COALESCE(draws, 0),
  all_time_losses = COALESCE(losses, 0),
  all_time_goals_for = COALESCE(goals_for, 0),
  all_time_goals_against = COALESCE(goals_against, 0)
WHERE all_time_points = 0 AND points > 0;

CREATE INDEX IF NOT EXISTS idx_global_teams_all_time_points
  ON global_league_teams (all_time_points DESC);

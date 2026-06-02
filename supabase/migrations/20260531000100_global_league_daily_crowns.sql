-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: histórico de COROAS DO DIA
--
-- Cada vez que o mata-mata diário define um campeão, grava-se uma linha aqui.
-- Alimenta o widget "Campeão de Hoje" na home, a página /liga-global/coroas
-- e o ranking de coroas da season. Leitura pública; escrita só service_role
-- (a Edge Function global-league-tick é a única autoridade).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_crowns (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES global_league_teams(id) ON DELETE CASCADE,
  manager_id      TEXT NOT NULL,
  club_name       TEXT NOT NULL,
  club_short      TEXT NOT NULL,

  -- Contexto da conquista
  daily_date      TEXT NOT NULL,               -- 'YYYY-MM-DD' BRT do dia conquistado
  season_id       TEXT NOT NULL,               -- season da liga no momento
  competition_id  TEXT,                         -- competição (ciclo) no momento
  bracket_size    INTEGER NOT NULL,             -- nº de times no mata-mata (2,4,8,16,32)
  final_round_id  TEXT,                         -- round_id da final
  runner_up_team_id   TEXT,                     -- vice (derrotado na final)
  runner_up_club_name TEXT,

  -- Placar da final (inclui pênaltis se houve)
  final_score_home    INTEGER,
  final_score_away    INTEGER,
  final_went_to_pens  BOOLEAN NOT NULL DEFAULT FALSE,

  crowned_at_ms   BIGINT NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_crowns_manager
  ON daily_crowns (manager_id, crowned_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_daily_crowns_recent
  ON daily_crowns (crowned_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_daily_crowns_season
  ON daily_crowns (season_id, crowned_at_ms DESC);

-- Um campeão por dia (BRT). Protege contra dupla coroação por ticks concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_crowns_per_day
  ON daily_crowns (daily_date);

ALTER TABLE daily_crowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON daily_crowns;
CREATE POLICY "Allow public read access" ON daily_crowns FOR SELECT USING (true);

COMMENT ON TABLE daily_crowns IS
  'Histórico de campeões do mata-mata diário da Liga Global (Coroas do Dia). 1 linha por Dia Olefoot.';

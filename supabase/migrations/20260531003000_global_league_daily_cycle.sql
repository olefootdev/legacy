-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: CICLO DIÁRIO com COROAS (Fase A)
--
-- Adiciona a camada "Dia Olefoot" SOBRE a liga nonstop existente, sem
-- alterar o loop de 5/5min que já roda em produção:
--
--   • 00:00–19:00 BRT  → fase "qualifying": cada partida de LIGA também
--     soma daily_points. A liga nonstop continua dando densidade o dia todo.
--   • 19:00 BRT        → fase "knockout": top N (maior potência de 2 ≤ 32)
--     por daily_points entram num mata-mata (round_type='daily_ko'), com
--     pênaltis decidindo empates.
--   • Final            → fase "crowned": campeão do dia recebe 1 Coroa
--     (season_crowns + all_time_crowns). Mais coroas na season = título
--     paralelo ao campeão de divisão.
--   • 00:00 BRT seguinte → daily_* zeram, volta a "qualifying".
--
-- daily_* são ORTOGONAIS ao ciclo de season: NÃO zeram no soft-reset de
-- promoção/rebaixamento; só zeram na virada do Dia Olefoot. A coluna
-- season_crowns acompanha a competição (zera no hard-reset); all_time_crowns
-- jamais zera.
--
-- Migration ADITIVA e idempotente (IF NOT EXISTS). Não destrói dados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Pontuação diária + coroas em global_league_teams ────────────────────
ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS daily_points          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_matches_played  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_wins            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_draws           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_losses          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_goals_for       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_goals_against   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_goal_difference INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_crowns         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_time_crowns       INTEGER NOT NULL DEFAULT 0;

-- Ranking da corrida diária (top N por daily_points, depois saldo, depois pró)
CREATE INDEX IF NOT EXISTS idx_global_teams_daily_rank
  ON global_league_teams (
    daily_points DESC,
    daily_goal_difference DESC,
    daily_goals_for DESC
  );

CREATE INDEX IF NOT EXISTS idx_global_teams_season_crowns
  ON global_league_teams (season_crowns DESC);

-- ── 2. Estado da fase diária em global_league_state ────────────────────────
ALTER TABLE global_league_state
  ADD COLUMN IF NOT EXISTS daily_date         TEXT,    -- 'YYYY-MM-DD' em BRT
  ADD COLUMN IF NOT EXISTS daily_phase        TEXT NOT NULL DEFAULT 'qualifying',
  ADD COLUMN IF NOT EXISTS daily_ko_season_id TEXT,    -- season_id dos rounds daily_ko do dia
  ADD COLUMN IF NOT EXISTS daily_ko_size      INTEGER, -- tamanho do bracket gerado (2,4,8,16,32)
  ADD COLUMN IF NOT EXISTS daily_qualify_hour INTEGER NOT NULL DEFAULT 19, -- hora BRT do corte
  ADD COLUMN IF NOT EXISTS daily_ko_max_size  INTEGER NOT NULL DEFAULT 32; -- teto do bracket

-- Constraint da fase diária (drop+recreate para idempotência)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_daily_phase'
  ) THEN
    ALTER TABLE global_league_state
      ADD CONSTRAINT valid_daily_phase
      CHECK (daily_phase IN ('qualifying', 'knockout', 'crowned'));
  END IF;
END$$;

-- ── 3. Pênaltis nas fixtures (decidem empate no mata-mata) ──────────────────
ALTER TABLE global_league_fixtures
  ADD COLUMN IF NOT EXISTS penalty_score_home INTEGER,
  ADD COLUMN IF NOT EXISTS penalty_score_away INTEGER,
  ADD COLUMN IF NOT EXISTS went_to_penalties  BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. round_type aceita 'daily_ko' ────────────────────────────────────────
-- A constraint original só aceita ('playoff','league'). Reabrimos para incluir
-- o mata-mata diário. drop+recreate preservando os valores existentes.
ALTER TABLE global_league_rounds DROP CONSTRAINT IF EXISTS valid_round_type;
ALTER TABLE global_league_rounds
  ADD CONSTRAINT valid_round_type
  CHECK (round_type IN ('playoff', 'league', 'daily_ko'));

-- ── 5. event_type aceita eventos de pênalti e coroação ─────────────────────
ALTER TABLE global_league_events DROP CONSTRAINT IF EXISTS valid_event_type;
ALTER TABLE global_league_events
  ADD CONSTRAINT valid_event_type
  CHECK (event_type IN (
    'goal', 'yellow_card', 'red_card', 'injury', 'substitution',
    'pressure', 'miss', 'walkover', 'penalty', 'crown'
  ));

COMMENT ON COLUMN global_league_teams.daily_points IS
  'Pontos acumulados no Dia Olefoot corrente (qualifying). Zera na virada do dia (BRT), NÃO no soft-reset de season.';
COMMENT ON COLUMN global_league_teams.season_crowns IS
  'Coroas (campeão do mata-mata diário) ganhas nesta competição/season. Mais coroas = título paralelo no fim.';
COMMENT ON COLUMN global_league_teams.all_time_crowns IS
  'Total histórico de Coroas do Dia. Jamais zera.';
COMMENT ON COLUMN global_league_state.daily_phase IS
  'Fase do Dia Olefoot: qualifying (00–19h BRT) | knockout (mata-mata) | crowned (campeão definido, aguarda meia-noite).';

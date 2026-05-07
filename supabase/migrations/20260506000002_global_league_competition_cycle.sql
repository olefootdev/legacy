-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: ciclo de "Competição" longa (carry-over de pontos)
--
-- Etapa 3. Em vez de pontos zerarem ao fim de cada season (~110min), os pontos
-- agora acumulam por TODA a competição (default 7 dias). Promoção/rebaixamento
-- entre seasons preserva pontos (soft mode). Reset hard só ao fim do ciclo.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE global_league_state
  ADD COLUMN IF NOT EXISTS competition_started_at TIMESTAMPTZ
    DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS competition_duration_days INTEGER
    DEFAULT 7 NOT NULL,
  ADD COLUMN IF NOT EXISTS competition_id TEXT
    DEFAULT ('competition_' || extract(epoch from now())::bigint::text) NOT NULL;

COMMENT ON COLUMN global_league_state.competition_started_at IS
  'Início da competição atual. Pontos acumulam até completion_started_at + duration_days.';
COMMENT ON COLUMN global_league_state.competition_duration_days IS
  'Duração de uma competição em dias (default 7). Ao fim, zera pontos da temporada (all-time intacto).';
COMMENT ON COLUMN global_league_state.competition_id IS
  'ID da competição atual. Muda ao fim do ciclo.';

-- Inicializa para o registro existente
UPDATE global_league_state
SET competition_started_at = COALESCE(competition_started_at, NOW()),
    competition_duration_days = COALESCE(competition_duration_days, 7),
    competition_id = COALESCE(competition_id, 'competition_' || extract(epoch from now())::bigint::text)
WHERE id = 'current';

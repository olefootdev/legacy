-- Migration: position_knowledge
-- Adiciona coluna JSONB para persistir o DNA de lenda evoluído por jogador.
-- Aplicada em: players (elenco normal) e legacy_players (lendas).

-- ── players ──────────────────────────────────────────────────────────────────
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS position_knowledge JSONB DEFAULT NULL;

COMMENT ON COLUMN public.players.position_knowledge IS
  'DNA de lenda evoluído: actionWeights, traits, sessionsCompleted, legendSource. Atualizado pós-partida pelo syncPlayerToSupabase.';

-- ── legacy_players ────────────────────────────────────────────────────────────
ALTER TABLE public.legacy_players
  ADD COLUMN IF NOT EXISTS position_knowledge JSONB DEFAULT NULL;

COMMENT ON COLUMN public.legacy_players.position_knowledge IS
  'DNA de lenda evoluído: actionWeights, traits, sessionsCompleted, legendSource. Atualizado por syncLegacyPlayerPositionKnowledge.';

-- Índice GIN para queries futuras sobre traits/actionWeights (opcional mas útil).
CREATE INDEX IF NOT EXISTS idx_players_position_knowledge
  ON public.players USING GIN (position_knowledge)
  WHERE position_knowledge IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legacy_players_position_knowledge
  ON public.legacy_players USING GIN (position_knowledge)
  WHERE position_knowledge IS NOT NULL;

-- ============================================================================
-- Persistência cross-browser dos marcos da Liga Global já reclamados
-- ============================================================================
-- Cada manager pode bater 20 marcos no total (4 categorias × 5 thresholds):
--   matches | goals | points | wins  → 10 / 50 / 100 / 300 / 1000
-- IDs estáveis: `gl_<category>_<threshold>` (ex.: `gl_matches_10`).
--
-- Persistir cross-browser garante que o EXP é pago só 1× — sem isso, logar
-- noutro device pagaria de novo todos os marcos que o time já atingiu.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists global_league_milestones_claimed jsonb;

-- Sem índices: campo é lido só pelo próprio user_id (já PK).
-- RLS herdada do owner da tabela.

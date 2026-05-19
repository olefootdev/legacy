-- ============================================================================
-- PERSISTIR FINANCE CROSS-BROWSER
-- ============================================================================
-- Antes: finance (ole/EXP, broCents, expLifetimeEarned, expHistory) vivia
-- APENAS no localStorage. Resultado: logout → localStorage limpo → user
-- volta com 0 EXP, perde tudo que jogou.
--
-- Agora: persiste em manager_game_state.finance (jsonb). Hidratação usa
-- MAX(expLifetimeEarned) — monotônico, jamais regredir.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists finance jsonb;

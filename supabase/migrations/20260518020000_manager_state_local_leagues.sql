-- ============================================================================
-- LIGA CLASSIC + FAST LIGA — placar acumulado por manager cross-browser
-- ============================================================================
-- Cada manager tem 2 leagues locais cumulativas (sem temporadas):
--   • classic → soma pontos por toda partida do modo CLASSIC (2D tático)
--   • fast    → soma pontos por toda partida do modo QUICK (rápida)
--
-- Schema do JSON (LocalLeaguesState em src/match/localLeagues.ts):
--   {
--     "classic": { "played": int, "wins": int, "draws": int, "losses": int,
--                  "goalsFor": int, "goalsAgainst": int, "points": int,
--                  "recentForm": ["W"|"D"|"L"], "bestStreak": int,
--                  "currentStreak": int },
--     "fast": { ... mesmo shape ... }
--   }
--
-- Persistir cross-browser garante que a Liga Classic e a Fast Liga não
-- zeram quando o manager loga em outro device.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists local_leagues jsonb;

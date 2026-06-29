-- #4 — WO (walkover) visível na Liga Global.
-- A edge function global-league-tick JÁ decide o WO (elenco < 11 → 0×3) e já
-- insere o evento `walkover` em global_league_events. Estas colunas deixam o
-- WO explícito NA PRÓPRIA fixture, pro client mostrar o selo "WO" no resultado
-- (antes o manager via só "0×3" sem saber que foi por ausência).
ALTER TABLE global_league_fixtures
  ADD COLUMN IF NOT EXISTS wo_home BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wo_away BOOLEAN NOT NULL DEFAULT FALSE;

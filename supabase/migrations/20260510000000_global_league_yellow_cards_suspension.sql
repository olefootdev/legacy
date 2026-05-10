-- Adiciona acúmulo de cartões amarelos e suspensões por time na Liga Global.
-- yellow_card_count: contador de amarelos na competição atual (zera após suspensão).
-- suspension_rounds_remaining: rodadas de suspensão pendentes (penaliza OVR efetivo em -5).

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS yellow_card_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_rounds_remaining INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN global_league_teams.yellow_card_count IS
  'Amarelos acumulados na competição atual. Zera ao atingir 3 (gera 1 rodada de suspensão).';
COMMENT ON COLUMN global_league_teams.suspension_rounds_remaining IS
  'Rodadas de suspensão pendentes. Enquanto > 0, OVR efetivo é reduzido em 5 pontos.';

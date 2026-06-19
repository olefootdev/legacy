-- Ledger de prêmio EXP do MATA-MATA DIÁRIO da Liga Global (Coroa do Dia).
-- A Edge `global-league-tick` insere 1 linha por (time, fase): ao CLASSIFICAR
-- pro bracket e ao VENCER cada fase (oitavas/quartas/semi/final). O cliente lê
-- os prêmios NÃO reclamados do seu manager_id, credita EXP localmente e marca
-- claimed=true (idempotente). Mesmo padrão de global_league_season_champions.
--
-- Tabela de prêmios (definidos no código da Edge, fáceis de tunar):
--   qualified (classificou): 100.000
--   r16  (venceu oitavas) : 100.000
--   qf   (venceu quartas) : 250.000
--   sf   (venceu semi)    : 500.000
--   final (venceu final/campeão): 2.500.000
--   → total do campeão: 3.450.000 EXP

CREATE TABLE IF NOT EXISTS global_league_ko_prizes (
  id text PRIMARY KEY,                 -- koprize_<daily_date>_<stage>_<team_id>
  competition_id text,
  season_id text,                      -- dko_<daily_date>
  daily_date text NOT NULL,
  team_id text NOT NULL,
  manager_id text,                     -- email do manager (match no cliente)
  club_name text,
  stage text NOT NULL,                 -- qualified | r16 | qf | sf | final
  prize_exp integer NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  crowned_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lookup do cliente: prêmios não-reclamados por manager.
CREATE INDEX IF NOT EXISTS idx_ko_prizes_manager_unclaimed
  ON global_league_ko_prizes (manager_id, claimed);

COMMENT ON TABLE global_league_ko_prizes IS
  'Prêmios EXP do mata-mata diário da Liga Global (classificação + vitória por fase). Ledger de prêmio (claimed).';

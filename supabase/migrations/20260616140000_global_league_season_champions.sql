-- Hall de Campeões + ledger de prêmio da Liga Global sazonal.
-- A Edge `global-league-tick` insere 1 linha por divisão (D1/D2/D3) quando a
-- temporada termina (líder cravou 1000 pts). O cliente lê os campeões NÃO
-- reclamados do seu manager_id, credita OLE/EXP localmente e marca claimed=true
-- (idempotente). Também serve de Hall de Campeões pra UI futura.

CREATE TABLE IF NOT EXISTS global_league_season_champions (
  id text PRIMARY KEY,                 -- champ_<competition_id>_<season_id>_d<div>
  competition_id text,
  season_id text,
  division integer NOT NULL,
  team_id text NOT NULL,
  manager_id text,                     -- email do manager (match no cliente)
  club_name text,
  points integer NOT NULL DEFAULT 0,
  prize_ole integer NOT NULL DEFAULT 0,
  prize_exp integer NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  crowned_at_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lookup do cliente: campeões não-reclamados por manager.
CREATE INDEX IF NOT EXISTS idx_season_champions_manager_unclaimed
  ON global_league_season_champions (manager_id, claimed);

COMMENT ON TABLE global_league_season_champions IS
  'Campeões de temporada por divisão (Liga Global). Ledger de prêmio (claimed) + Hall de Campeões.';

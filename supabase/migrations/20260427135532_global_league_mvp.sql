-- ============================================
-- GLOBAL LEAGUE MVP - TABELAS SUPABASE
-- ============================================

-- 1. Tabela de Times
CREATE TABLE IF NOT EXISTS global_league_teams (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL UNIQUE,
  club_name TEXT NOT NULL,
  club_short TEXT NOT NULL,
  overall INTEGER NOT NULL,

  -- Divisão atual
  division INTEGER,
  "position" INTEGER,
  previous_position INTEGER,

  -- Estatísticas dos Playoffs
  playoff_points INTEGER DEFAULT 0,
  playoff_matches_played INTEGER DEFAULT 0,
  playoff_wins INTEGER DEFAULT 0,
  playoff_draws INTEGER DEFAULT 0,
  playoff_losses INTEGER DEFAULT 0,
  playoff_goals_for INTEGER DEFAULT 0,
  playoff_goals_against INTEGER DEFAULT 0,

  -- Estatísticas da Liga Oficial
  points INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  goal_difference INTEGER DEFAULT 0,

  -- Forma recente (JSON array)
  recent_form JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_division CHECK (division IS NULL OR (division >= 1 AND division <= 3)),
  CONSTRAINT valid_overall CHECK (overall >= 40 AND overall <= 99)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_global_teams_manager ON global_league_teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_global_teams_division ON global_league_teams(division);
CREATE INDEX IF NOT EXISTS idx_global_teams_points ON global_league_teams(points DESC);
CREATE INDEX IF NOT EXISTS idx_global_teams_playoff_points ON global_league_teams(playoff_points DESC);

-- 2. Tabela de Rodadas
CREATE TABLE IF NOT EXISTS global_league_rounds (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  round_type TEXT NOT NULL,
  phase TEXT,
  is_returning BOOLEAN DEFAULT FALSE,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- Timestamps
  scheduled_kickoff_ms BIGINT NOT NULL,
  actual_kickoff_ms BIGINT,
  finished_at_ms BIGINT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_round_type CHECK (round_type IN ('playoff', 'league')),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'live', 'finished')),
  CONSTRAINT unique_round_per_season UNIQUE (season_id, round_number, round_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_global_rounds_season ON global_league_rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_global_rounds_status ON global_league_rounds(status);
CREATE INDEX IF NOT EXISTS idx_global_rounds_kickoff ON global_league_rounds(scheduled_kickoff_ms);

-- 3. Tabela de Partidas
CREATE TABLE IF NOT EXISTS global_league_fixtures (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES global_league_rounds(id) ON DELETE CASCADE,
  division TEXT NOT NULL,

  -- Times
  home_team_id TEXT NOT NULL REFERENCES global_league_teams(id) ON DELETE CASCADE,
  away_team_id TEXT NOT NULL REFERENCES global_league_teams(id) ON DELETE CASCADE,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_overall INTEGER NOT NULL,
  away_overall INTEGER NOT NULL,

  -- Placar
  score_home INTEGER DEFAULT 0,
  score_away INTEGER DEFAULT 0,
  current_minute INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- Timestamps
  kickoff_ms BIGINT,
  finished_at_ms BIGINT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_fixture_status CHECK (status IN ('scheduled', 'live', 'finished')),
  CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_global_fixtures_round ON global_league_fixtures(round_id);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_home_team ON global_league_fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_away_team ON global_league_fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_division ON global_league_fixtures(division);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_status ON global_league_fixtures(status);

-- 4. Tabela de Eventos
CREATE TABLE IF NOT EXISTS global_league_events (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES global_league_fixtures(id) ON DELETE CASCADE,

  -- Tipo de evento
  event_type TEXT NOT NULL,

  -- Detalhes
  minute INTEGER NOT NULL,
  side TEXT NOT NULL,
  player_name TEXT,
  player_id TEXT,
  "text" TEXT NOT NULL,
  highlight BOOLEAN DEFAULT FALSE,

  -- Timestamp
  timestamp_ms BIGINT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_event_type CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'injury', 'substitution', 'pressure', 'miss')),
  CONSTRAINT valid_side CHECK (side IN ('home', 'away')),
  CONSTRAINT valid_minute CHECK (minute >= 0 AND minute <= 90)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_global_events_fixture ON global_league_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_global_events_type ON global_league_events(event_type);
CREATE INDEX IF NOT EXISTS idx_global_events_minute ON global_league_events(minute);

-- 5. Tabela de Estado da Liga (singleton)
CREATE TABLE IF NOT EXISTS global_league_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  season_id TEXT NOT NULL,
  season_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_teams',

  -- Configurações
  min_teams_required INTEGER DEFAULT 32,
  teams_per_division INTEGER DEFAULT 11,
  promotion_percentage DECIMAL(3,2) DEFAULT 0.10,
  relegation_percentage DECIMAL(3,2) DEFAULT 0.10,

  -- Rodadas atuais
  current_playoff_round INTEGER,
  current_league_round INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_league_status CHECK (status IN ('waiting_teams', 'playoffs', 'active', 'season_ended')),
  CONSTRAINT singleton_check CHECK (id = 'current')
);

-- Inserir estado inicial
INSERT INTO global_league_state (id, season_id, season_name, status)
VALUES ('current', 'season_2026', 'OLEFOOT LIGA GLOBAL 2026', 'waiting_teams')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ============================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas
DROP TRIGGER IF EXISTS update_global_teams_updated_at ON global_league_teams;
CREATE TRIGGER update_global_teams_updated_at
  BEFORE UPDATE ON global_league_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_rounds_updated_at ON global_league_rounds;
CREATE TRIGGER update_global_rounds_updated_at
  BEFORE UPDATE ON global_league_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_fixtures_updated_at ON global_league_fixtures;
CREATE TRIGGER update_global_fixtures_updated_at
  BEFORE UPDATE ON global_league_fixtures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_state_updated_at ON global_league_state;
CREATE TRIGGER update_global_state_updated_at
  BEFORE UPDATE ON global_league_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Classificação dos Playoffs
CREATE OR REPLACE VIEW v_playoff_standings AS
SELECT
  id,
  manager_id,
  club_name,
  club_short,
  overall,
  playoff_points,
  playoff_matches_played,
  playoff_wins,
  playoff_draws,
  playoff_losses,
  playoff_goals_for,
  playoff_goals_against,
  (playoff_goals_for - playoff_goals_against) AS playoff_goal_difference,
  ROW_NUMBER() OVER (
    ORDER BY
      playoff_points DESC,
      playoff_wins DESC,
      (playoff_goals_for - playoff_goals_against) DESC,
      playoff_goals_for DESC,
      club_name ASC
  ) AS playoff_position
FROM global_league_teams
ORDER BY playoff_position;

-- View: Classificação por Divisão
CREATE OR REPLACE VIEW v_division_standings AS
SELECT
  id,
  manager_id,
  club_name,
  club_short,
  overall,
  division,
  points,
  matches_played,
  wins,
  draws,
  losses,
  goals_for,
  goals_against,
  goal_difference,
  recent_form,
  "position",
  previous_position,
  ROW_NUMBER() OVER (
    PARTITION BY division
    ORDER BY
      points DESC,
      wins DESC,
      goal_difference DESC,
      goals_for DESC,
      club_name ASC
  ) AS calculated_position
FROM global_league_teams
WHERE division IS NOT NULL
ORDER BY division, calculated_position;

-- View: Próximas Rodadas
CREATE OR REPLACE VIEW v_upcoming_rounds AS
SELECT
  r.id,
  r.season_id,
  r.round_number,
  r.round_type,
  r.status,
  r.scheduled_kickoff_ms,
  COUNT(f.id) AS total_fixtures,
  COUNT(CASE WHEN f.status = 'finished' THEN 1 END) AS finished_fixtures
FROM global_league_rounds r
LEFT JOIN global_league_fixtures f ON f.round_id = r.id
WHERE r.status IN ('scheduled', 'live')
GROUP BY r.id, r.season_id, r.round_number, r.round_type, r.status, r.scheduled_kickoff_ms
ORDER BY r.scheduled_kickoff_ms ASC;

-- ============================================
-- FUNÇÕES ÚTEIS
-- ============================================

-- Função: Obter times de uma divisão
CREATE OR REPLACE FUNCTION get_division_teams(div INTEGER)
RETURNS TABLE (
  id TEXT,
  club_name TEXT,
  points INTEGER,
  team_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.club_name,
    t.points,
    t."position" as team_position
  FROM global_league_teams t
  WHERE t.division = div
  ORDER BY t."position" ASC;
END;
$$ LANGUAGE plpgsql;

-- Função: Obter estatísticas da liga
CREATE OR REPLACE FUNCTION get_league_stats()
RETURNS TABLE (
  total_teams INTEGER,
  teams_in_playoffs INTEGER,
  teams_in_league INTEGER,
  total_goals INTEGER,
  total_matches INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_teams,
    COUNT(CASE WHEN division IS NULL THEN 1 END)::INTEGER AS teams_in_playoffs,
    COUNT(CASE WHEN division IS NOT NULL THEN 1 END)::INTEGER AS teams_in_league,
    SUM(goals_for)::INTEGER AS total_goals,
    SUM(matches_played)::INTEGER AS total_matches
  FROM global_league_teams;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE global_league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_state ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow public read access" ON global_league_teams;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_rounds;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_fixtures;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_events;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_state;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_teams;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_teams;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_rounds;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_rounds;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_fixtures;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_fixtures;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_events;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_state;

-- Política: Todos podem ler
CREATE POLICY "Allow public read access" ON global_league_teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_rounds FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_fixtures FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_state FOR SELECT USING (true);

-- Política: Apenas autenticados podem inserir/atualizar
CREATE POLICY "Allow authenticated insert" ON global_league_teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON global_league_teams FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON global_league_rounds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON global_league_rounds FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON global_league_fixtures FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON global_league_fixtures FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON global_league_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON global_league_state FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE global_league_teams IS 'Times cadastrados na Liga Global MVP';
COMMENT ON TABLE global_league_rounds IS 'Rodadas dos playoffs e da liga oficial';
COMMENT ON TABLE global_league_fixtures IS 'Partidas de cada rodada';
COMMENT ON TABLE global_league_events IS 'Eventos que acontecem durante as partidas';
COMMENT ON TABLE global_league_state IS 'Estado global da liga (singleton)';

COMMENT ON VIEW v_playoff_standings IS 'Classificação dos playoffs ordenada por pontos';
COMMENT ON VIEW v_division_standings IS 'Classificação por divisão ordenada por pontos';
COMMENT ON VIEW v_upcoming_rounds IS 'Próximas rodadas agendadas ou em andamento';

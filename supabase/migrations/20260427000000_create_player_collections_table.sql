-- Cria tabela para armazenar coleções de jogadores
CREATE TABLE IF NOT EXISTS player_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_player_collections_collection_id ON player_collections(collection_id);
CREATE INDEX idx_player_collections_active ON player_collections(is_active);

CREATE OR REPLACE FUNCTION update_player_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_collections_updated_at
  BEFORE UPDATE ON player_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_player_collections_updated_at();

ALTER TABLE player_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem fazer tudo em player_collections"
  ON player_collections
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Todos podem ler coleções ativas"
  ON player_collections
  FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON TABLE player_collections IS 'Coleções de jogadores para organização e categorização';

-- Insere coleções iniciais
INSERT INTO player_collections (collection_id, name, description)
VALUES
  ('genesis', 'Genesis', 'Coleção inicial do Olefoot'),
  ('legends', 'Legends', 'Lendas do futebol mundial'),
  ('brasil', 'Brasil', 'Jogadores brasileiros históricos')
ON CONFLICT (collection_id) DO NOTHING;

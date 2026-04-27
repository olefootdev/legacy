-- Cria tabela de vocabulário de futebol (biblioteca global de comandos)
-- Separada de manager_learned_phrases (frases aprendidas por usuário)

CREATE TABLE IF NOT EXISTS football_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT NOT NULL UNIQUE,
  stem TEXT NOT NULL,
  intent TEXT NOT NULL,
  canonical_phrase TEXT NOT NULL,
  confirm_count INTEGER NOT NULL DEFAULT 1,
  region TEXT DEFAULT 'BR',
  language_type TEXT DEFAULT 'popular',
  context TEXT DEFAULT 'torcida',
  formality_level INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_football_vocabulary_phrase ON football_vocabulary(phrase);
CREATE INDEX idx_football_vocabulary_intent ON football_vocabulary(intent);
CREATE INDEX idx_football_vocabulary_active ON football_vocabulary(is_active);
CREATE INDEX idx_football_vocabulary_region ON football_vocabulary(region);

CREATE OR REPLACE FUNCTION update_football_vocabulary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER football_vocabulary_updated_at
  BEFORE UPDATE ON football_vocabulary
  FOR EACH ROW
  EXECUTE FUNCTION update_football_vocabulary_updated_at();

ALTER TABLE football_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem fazer tudo em football_vocabulary"
  ON football_vocabulary
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Todos podem ler frases ativas"
  ON football_vocabulary
  FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON TABLE football_vocabulary IS 'Biblioteca global de vocabulário de futebol PT-BR para comandos de voz';

-- Tabela de frases aprendidas para reconhecimento de voz
-- Baseada no vocabulário do futebol brasileiro

CREATE TABLE IF NOT EXISTS learned_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT NOT NULL,
  intent TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.0,
  language TEXT DEFAULT 'pt-BR',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_learned_phrases_phrase ON learned_phrases(phrase);
CREATE INDEX idx_learned_phrases_intent ON learned_phrases(intent);
CREATE INDEX idx_learned_phrases_active ON learned_phrases(is_active);
CREATE INDEX idx_learned_phrases_language ON learned_phrases(language);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_learned_phrases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER learned_phrases_updated_at
  BEFORE UPDATE ON learned_phrases
  FOR EACH ROW
  EXECUTE FUNCTION update_learned_phrases_updated_at();

-- Popular com frases do vocabulário mapeadas para VoiceIntent

-- INDIVIDUAL - Ações ofensivas
INSERT INTO learned_phrases (phrase, intent, category, confidence) VALUES
  ('invade a área', 'invade_box', 'individual', 1.0),
  ('invade a grande área', 'invade_box', 'individual', 1.0),
  ('vai pra pequena', 'hold_small_area', 'creative', 0.95),
  ('vai até a pequena', 'break_line', 'creative', 0.95),
  ('quebra a linha', 'break_line', 'creative', 1.0),
  ('quebra a zona', 'break_zone', 'creative', 1.0),
  ('corre pelas costas', 'run_behind', 'creative', 1.0),
  ('corre por trás', 'run_behind', 'creative', 0.95),

  ('tenta o drible', 'dribble_attempt', 'individual', 1.0),
  ('passa por ele', 'dribble_attempt', 'individual', 0.95),
  ('dribla', 'dribble_attempt', 'individual', 1.0),
  ('finta', 'dribble_attempt', 'individual', 0.95),
  ('faz a finta', 'dribble_attempt', 'individual', 0.95),
  ('caneta', 'dribble_attempt', 'individual', 0.9),
  ('chapéu', 'dribble_attempt', 'individual', 0.9),
  ('elástico', 'dribble_attempt', 'individual', 0.9),
  ('pedalada', 'dribble_attempt', 'individual', 0.9),

  ('chuta', 'take_shot', 'individual', 1.0),
  ('finaliza', 'take_shot', 'individual', 1.0),
  ('atira', 'take_shot', 'individual', 0.95),
  ('manda ver', 'take_shot', 'individual', 0.9),
  ('enche o pé', 'take_shot', 'individual', 0.95),
  ('bomba', 'take_shot', 'individual', 0.9),
  ('canhão', 'take_shot', 'individual', 0.9),
  ('fuzila', 'take_shot', 'individual', 0.9),
  ('bate pronto', 'take_shot', 'individual', 0.95),
  ('de primeira', 'take_shot', 'individual', 0.95),

  ('cruza', 'cross_ball', 'individual', 1.0),
  ('cruza a bola', 'cross_ball', 'individual', 1.0),
  ('bola centrada', 'cross_ball', 'individual', 0.95),
  ('levanta', 'cross_ball', 'individual', 0.9),
  ('alça', 'cross_ball', 'individual', 0.9),
  ('chuveirinho', 'cross_ball', 'individual', 0.9),

  ('passa', 'pass_to_player', 'individual', 1.0),
  ('toca', 'quick_pass', 'individual', 1.0),
  ('toca rápido', 'quick_pass', 'individual', 1.0),
  ('toque', 'quick_pass', 'individual', 0.95),
  ('açúcar', 'pass_to_player', 'individual', 0.9),
  ('açucarada', 'pass_to_player', 'individual', 0.9),
  ('bandeja', 'pass_to_player', 'individual', 0.9),

  ('segura a bola', 'hold_ball', 'individual', 1.0),
  ('segura', 'hold_ball', 'individual', 0.95),
  ('protege', 'hold_ball', 'individual', 0.9),
  ('mata a bola', 'hold_ball', 'individual', 0.9),
  ('amortece', 'hold_ball', 'individual', 0.9),

  ('troca de lado', 'switch_play', 'individual', 1.0),
  ('inverte', 'switch_play', 'individual', 0.95),
  ('abre o jogo', 'switch_play', 'individual', 0.95),
  ('estica', 'switch_play', 'individual', 0.9),
  ('lança', 'switch_play', 'individual', 0.9),

  ('espera a chegada', 'wait_support', 'creative', 1.0),
  ('espera apoio', 'wait_support', 'creative', 0.95),
  ('aguarda', 'wait_support', 'creative', 0.9),

  ('se vira', 'free_play', 'creative', 1.0),
  ('improvisa', 'free_play', 'creative', 0.95),
  ('joga o fino', 'free_play', 'creative', 0.9),

-- INDIVIDUAL - Ações defensivas
  ('marca', 'mark_player', 'individual', 1.0),
  ('cola', 'mark_player', 'individual', 0.95),
  ('gruda', 'mark_player', 'individual', 0.95),
  ('carrapato', 'mark_player', 'individual', 0.9),
  ('perdigueiro', 'mark_player', 'individual', 0.9),

  ('segura ele', 'block_advance', 'individual', 1.0),
  ('bloqueia', 'block_advance', 'individual', 0.95),
  ('anteparo', 'block_advance', 'individual', 0.9),
  ('fecha', 'block_advance', 'individual', 0.9),

  ('entra com tudo', 'aggressive_tackle', 'aggressive', 1.0),
  ('entra duro', 'aggressive_tackle', 'aggressive', 0.95),
  ('carrinho', 'aggressive_tackle', 'aggressive', 0.95),
  ('bote', 'aggressive_tackle', 'aggressive', 0.9),
  ('desarma', 'aggressive_tackle', 'aggressive', 0.9),

  ('faz falta', 'tactical_foul', 'aggressive', 1.0),
  ('falta tática', 'tactical_foul', 'aggressive', 1.0),
  ('mata a jogada', 'tactical_foul', 'aggressive', 0.95),
  ('para o jogo', 'tactical_foul', 'aggressive', 0.9),

-- COLETIVO - Time todo
  ('pressiona alto', 'team_press_high', 'collective', 1.0),
  ('pressão alta', 'team_press_high', 'collective', 1.0),
  ('marca na saída', 'team_press_high', 'collective', 0.95),
  ('sufoca', 'team_press_high', 'collective', 0.9),

  ('recua', 'team_retreat', 'collective', 1.0),
  ('volta pra defesa', 'team_retreat', 'collective', 1.0),
  ('defende', 'team_retreat', 'collective', 0.95),
  ('fecha atrás', 'team_retreat', 'collective', 0.95),
  ('retranca', 'team_retreat', 'collective', 0.9),
  ('ferrolho', 'team_retreat', 'collective', 0.9),

  ('segura o jogo', 'team_hold_possession', 'collective', 1.0),
  ('mata o jogo', 'team_hold_possession', 'collective', 1.0),
  ('toca a bola', 'team_hold_possession', 'collective', 0.95),
  ('roda a bola', 'team_hold_possession', 'collective', 0.95),
  ('valoriza a posse', 'team_hold_possession', 'collective', 0.95),
  ('tabela', 'team_hold_possession', 'collective', 0.9),
  ('triangula', 'team_hold_possession', 'collective', 0.9),

  ('sobe o time', 'team_high_line', 'collective', 1.0),
  ('linha alta', 'team_high_line', 'collective', 1.0),
  ('compacta', 'team_high_line', 'collective', 0.95),
  ('estica o time', 'stretch_team', 'creative', 0.95),

  ('atacantes pressionam', 'forwards_press_defenders', 'collective', 1.0),
  ('atacantes marcam', 'forwards_press_defenders', 'collective', 0.95),

  ('meias fecham', 'midfielders_compact', 'collective', 1.0),
  ('fecha o meio', 'midfielders_compact', 'collective', 0.95),
  ('compacta o meio', 'midfielders_compact', 'collective', 0.95),

  ('laterais cruzam', 'laterals_cross', 'collective', 1.0),
  ('laterais sobem', 'laterals_cross', 'collective', 0.95),

  ('sobe o lateral esquerdo', 'left_back_overlap', 'tactical', 1.0),
  ('lateral esquerdo sobe', 'left_back_overlap', 'tactical', 0.95),

-- FÍSICO / MENTAL
  ('poupa', 'spare_player', 'meta', 1.0),
  ('economiza', 'spare_player', 'meta', 0.95),
  ('guarda energia', 'spare_player', 'meta', 0.9),

  ('acalma', 'calm_team', 'meta', 1.0),
  ('acalma o time', 'calm_team', 'meta', 1.0),
  ('tranquiliza', 'calm_team', 'meta', 0.95),
  ('respira', 'calm_team', 'meta', 0.9),

-- CRIATIVOS (exclusivos de voz)
  ('pisa no acelerador', 'pedal_to_metal', 'creative', 1.0),
  ('acelera', 'pedal_to_metal', 'creative', 0.95),
  ('arranca', 'pedal_to_metal', 'creative', 0.9),
  ('arrancada', 'pedal_to_metal', 'creative', 0.9),

-- Variações regionais e gírias
  ('bica', 'take_shot', 'individual', 0.85),
  ('bicuda', 'take_shot', 'individual', 0.85),
  ('petardo', 'take_shot', 'individual', 0.85),
  ('torpedo', 'take_shot', 'individual', 0.85),
  ('tijolada', 'take_shot', 'individual', 0.85),

  ('costura', 'dribble_attempt', 'individual', 0.85),
  ('samba', 'dribble_attempt', 'individual', 0.85),
  ('ginga', 'dribble_attempt', 'individual', 0.85),

  ('abre a defesa', 'switch_play', 'individual', 0.85),
  ('espalha', 'switch_play', 'individual', 0.8),

  ('encaixa a marcação', 'mark_player', 'individual', 0.85),
  ('encaixota', 'team_retreat', 'collective', 0.85),
  ('encurrala', 'team_press_high', 'collective', 0.85);

-- RLS (Row Level Security) - apenas admins podem modificar
ALTER TABLE learned_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem fazer tudo em learned_phrases"
  ON learned_phrases
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Todos podem ler frases ativas"
  ON learned_phrases
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Função para buscar frases por similaridade (fuzzy matching)
CREATE OR REPLACE FUNCTION search_learned_phrases(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  phrase TEXT,
  intent TEXT,
  category TEXT,
  confidence DECIMAL,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lp.id,
    lp.phrase,
    lp.intent,
    lp.category,
    lp.confidence,
    similarity(lp.phrase, p_query) AS similarity
  FROM learned_phrases lp
  WHERE lp.is_active = true
    AND similarity(lp.phrase, p_query) > 0.3
  ORDER BY similarity DESC, lp.confidence DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Função para incrementar contador de uso
CREATE OR REPLACE FUNCTION increment_phrase_usage(p_phrase_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE learned_phrases
  SET usage_count = usage_count + 1
  WHERE id = p_phrase_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE learned_phrases IS 'Biblioteca de frases reconhecidas para comandos de voz em partidas ao vivo';
COMMENT ON COLUMN learned_phrases.phrase IS 'Frase em português brasileiro';
COMMENT ON COLUMN learned_phrases.intent IS 'VoiceIntent mapeado (ex: take_shot, dribble_attempt)';
COMMENT ON COLUMN learned_phrases.category IS 'Categoria do comando (individual, collective, creative, etc)';
COMMENT ON COLUMN learned_phrases.confidence IS 'Confiança do mapeamento (0.0 a 1.0)';
COMMENT ON COLUMN learned_phrases.usage_count IS 'Contador de quantas vezes a frase foi usada';

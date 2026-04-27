-- Popula tabela football_vocabulary com comandos iniciais PT-BR
-- Executar via Supabase SQL Editor ou migration

INSERT INTO football_vocabulary (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level, is_active)
VALUES
  -- CHUTE / FINALIZAÇÃO
  ('chuta', 'chut', 'take_shot', 'chutar', 10, 'BR', 'popular', 'torcida', 3, true),
  ('manda bala', 'mand bal', 'take_shot', 'chutar', 8, 'BR', 'giria', 'torcida', 1, true),
  ('bate', 'bate', 'take_shot', 'chutar', 7, 'BR', 'popular', 'torcida', 3, true),
  ('finaliza', 'final', 'take_shot', 'finalizar', 6, 'BR', 'tecnico', 'comentarista', 4, true),
  ('mete o pé', 'mete pé', 'take_shot', 'chutar forte', 5, 'BR', 'giria', 'torcida', 1, true),

  -- DRIBLE
  ('dribla', 'dribl', 'dribble_attempt', 'driblar', 9, 'BR', 'popular', 'torcida', 3, true),
  ('passa por ele', 'pass por ele', 'dribble_attempt', 'driblar', 7, 'BR', 'popular', 'torcida', 2, true),
  ('faz a finta', 'faz fint', 'dribble_attempt', 'fintar', 6, 'BR', 'popular', 'torcida', 3, true),
  ('dá um drible', 'dá um dribl', 'dribble_attempt', 'driblar', 5, 'BR', 'popular', 'torcida', 2, true),

  -- CRUZAMENTO
  ('cruza', 'cruz', 'cross_ball', 'cruzar', 8, 'BR', 'popular', 'torcida', 3, true),
  ('manda na área', 'mand na área', 'cross_ball', 'cruzar', 7, 'BR', 'popular', 'torcida', 2, true),
  ('bota na área', 'bota na área', 'cross_ball', 'cruzar', 6, 'BR', 'giria', 'torcida', 1, true),

  -- PASSE
  ('passa', 'pass', 'pass_to_player', 'passar', 10, 'BR', 'popular', 'torcida', 3, true),
  ('toca', 'toca', 'quick_pass', 'tocar', 9, 'BR', 'popular', 'torcida', 3, true),
  ('dá um passe', 'dá um pass', 'pass_to_player', 'passar', 7, 'BR', 'popular', 'torcida', 3, true),
  ('tabela', 'tabel', 'quick_pass', 'fazer tabela', 6, 'BR', 'tecnico', 'treinador', 4, true),

  -- SEGURAR BOLA
  ('segura', 'segur', 'hold_ball', 'segurar', 8, 'BR', 'popular', 'torcida', 3, true),
  ('protege', 'prote', 'hold_ball', 'proteger', 7, 'BR', 'tecnico', 'treinador', 4, true),
  ('fica com ela', 'fica com ela', 'hold_ball', 'segurar bola', 6, 'BR', 'popular', 'torcida', 2, true),

  -- MARCAÇÃO
  ('marca', 'marc', 'mark_player', 'marcar', 9, 'BR', 'popular', 'torcida', 3, true),
  ('pega ele', 'pega ele', 'mark_player', 'marcar', 7, 'BR', 'giria', 'torcida', 1, true),
  ('cola nele', 'cola nele', 'mark_player', 'marcar de perto', 6, 'BR', 'giria', 'torcida', 1, true),

  -- PRESSÃO
  ('pressiona', 'press', 'team_press_high', 'pressionar', 8, 'BR', 'tecnico', 'treinador', 4, true),
  ('bota pressão', 'bota press', 'team_press_high', 'pressionar', 7, 'BR', 'popular', 'torcida', 2, true),
  ('vai pra cima', 'vai pra cima', 'team_press_high', 'pressionar', 6, 'BR', 'giria', 'torcida', 1, true),

  -- RECUAR
  ('recua', 'recu', 'team_retreat', 'recuar', 8, 'BR', 'tecnico', 'treinador', 4, true),
  ('volta', 'volt', 'team_retreat', 'voltar', 7, 'BR', 'popular', 'torcida', 3, true),
  ('defende', 'defen', 'team_retreat', 'defender', 6, 'BR', 'popular', 'torcida', 3, true),

  -- POSSE
  ('toca a bola', 'toca a bola', 'team_hold_possession', 'manter posse', 7, 'BR', 'tecnico', 'treinador', 4, true),
  ('fica com a bola', 'fica com a bola', 'team_hold_possession', 'manter posse', 6, 'BR', 'popular', 'torcida', 2, true),
  ('roda a bola', 'roda a bola', 'team_hold_possession', 'circular bola', 5, 'BR', 'tecnico', 'treinador', 4, true),

  -- CORRIDA
  ('corre', 'corr', 'run_behind', 'correr', 8, 'BR', 'popular', 'torcida', 3, true),
  ('vai', 'vai', 'run_behind', 'ir', 7, 'BR', 'popular', 'torcida', 2, true),
  ('pique', 'piqu', 'run_behind', 'dar pique', 6, 'BR', 'giria', 'torcida', 1, true),

  -- SUBSTITUIÇÃO
  ('troca', 'troc', 'player_substitution', 'substituir', 7, 'BR', 'popular', 'torcida', 3, true),
  ('tira ele', 'tira ele', 'player_substitution', 'substituir', 6, 'BR', 'giria', 'torcida', 1, true),
  ('bota outro', 'bota outr', 'player_substitution', 'substituir', 5, 'BR', 'giria', 'torcida', 1, true),

  -- FORMAÇÃO
  ('muda formação', 'muda form', 'formation_change', 'mudar formação', 6, 'BR', 'tecnico', 'treinador', 4, true),
  ('troca esquema', 'troc esqu', 'formation_change', 'mudar esquema', 5, 'BR', 'tecnico', 'treinador', 4, true)

ON CONFLICT (phrase) DO NOTHING;

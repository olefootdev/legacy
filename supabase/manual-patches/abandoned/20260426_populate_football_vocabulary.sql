-- Popula tabela learned_phrases com vocabulário do futebol brasileiro
-- Baseado no PDF "Vocabulário do futebol" (725 verbetes)
--
-- IMPORTANTE: Esta migração ADICIONA frases à tabela existente learned_phrases
-- que já tem a estrutura: phrase, stem, intent, canonical_phrase, confirm_count,
-- region, language_type, context, formality_level

-- Função auxiliar para gerar stem (remove artigos, preposições)
CREATE OR REPLACE FUNCTION generate_stem(p_phrase TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(
    lower(p_phrase),
    '\m(o|a|os|as|um|uma|de|da|do|das|dos|para|pro|pra|com|no|na|nos|nas)\M',
    '',
    'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Popular com frases do vocabulário do futebol
-- Categoria: INDIVIDUAL OFENSIVO

INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level)
VALUES
  -- Chute / Finalização
  ('chuta', generate_stem('chuta'), 'take_shot', 'chuta', 10, 'BR', 'popular', 'torcida', 3),
  ('finaliza', generate_stem('finaliza'), 'take_shot', 'finaliza', 10, 'BR', 'tecnico', 'comentarista', 4),
  ('atira', generate_stem('atira'), 'take_shot', 'chuta', 5, 'BR', 'informal', 'torcida', 2),
  ('manda ver', generate_stem('manda ver'), 'take_shot', 'chuta', 8, 'BR', 'giria', 'torcida', 1),
  ('enche o pé', generate_stem('enche o pé'), 'take_shot', 'chuta forte', 8, 'BR', 'giria', 'torcida', 1),
  ('bomba', generate_stem('bomba'), 'take_shot', 'chuta forte', 6, 'BR', 'giria', 'torcida', 1),
  ('canhão', generate_stem('canhão'), 'take_shot', 'chuta forte', 5, 'BR', 'informal', 'torcida', 2),
  ('fuzila', generate_stem('fuzila'), 'take_shot', 'chuta forte', 5, 'BR', 'informal', 'comentarista', 3),
  ('bate pronto', generate_stem('bate pronto'), 'take_shot', 'chuta de primeira', 7, 'BR', 'tecnico', 'comentarista', 4),
  ('de primeira', generate_stem('de primeira'), 'take_shot', 'chuta de primeira', 9, 'BR', 'popular', 'jogador', 3),
  ('bica', generate_stem('bica'), 'take_shot', 'chuta', 4, 'BR', 'giria', 'torcida', 1),
  ('bicuda', generate_stem('bicuda'), 'take_shot', 'chuta', 4, 'BR', 'giria', 'torcida', 1),
  ('petardo', generate_stem('petardo'), 'take_shot', 'chuta forte', 4, 'BR', 'informal', 'comentarista', 3),
  ('torpedo', generate_stem('torpedo'), 'take_shot', 'chuta forte', 4, 'BR', 'informal', 'comentarista', 3),
  ('tijolada', generate_stem('tijolada'), 'take_shot', 'chuta forte', 4, 'BR', 'giria', 'torcida', 1),

  -- Drible
  ('dribla', generate_stem('dribla'), 'dribble_attempt', 'dribla', 10, 'BR', 'popular', 'jogador', 3),
  ('tenta o drible', generate_stem('tenta o drible'), 'dribble_attempt', 'dribla', 8, 'BR', 'tecnico', 'treinador', 4),
  ('passa por ele', generate_stem('passa por ele'), 'dribble_attempt', 'dribla', 7, 'BR', 'informal', 'torcida', 2),
  ('finta', generate_stem('finta'), 'dribble_attempt', 'dribla', 8, 'BR', 'tecnico', 'comentarista', 4),
  ('faz a finta', generate_stem('faz a finta'), 'dribble_attempt', 'dribla', 7, 'BR', 'popular', 'jogador', 3),
  ('caneta', generate_stem('caneta'), 'dribble_attempt', 'dribla entre as pernas', 9, 'BR', 'giria', 'torcida', 1),
  ('chapéu', generate_stem('chapéu'), 'dribble_attempt', 'dribla por cima', 8, 'BR', 'popular', 'torcida', 2),
  ('elástico', generate_stem('elástico'), 'dribble_attempt', 'dribla com elástico', 7, 'BR', 'tecnico', 'comentarista', 4),
  ('pedalada', generate_stem('pedalada'), 'dribble_attempt', 'dribla com pedalada', 7, 'BR', 'tecnico', 'comentarista', 4),
  ('costura', generate_stem('costura'), 'dribble_attempt', 'dribla vários', 6, 'BR', 'informal', 'comentarista', 3),
  ('samba', generate_stem('samba'), 'dribble_attempt', 'dribla com ginga', 6, 'BR', 'giria', 'torcida', 1),
  ('ginga', generate_stem('ginga'), 'dribble_attempt', 'dribla com ginga', 6, 'BR', 'popular', 'torcida', 2),

  -- Cruzamento
  ('cruza', generate_stem('cruza'), 'cross_ball', 'cruza', 10, 'BR', 'popular', 'jogador', 3),
  ('cruza a bola', generate_stem('cruza a bola'), 'cross_ball', 'cruza', 9, 'BR', 'popular', 'torcida', 3),
  ('bola centrada', generate_stem('bola centrada'), 'cross_ball', 'cruza', 7, 'BR', 'tecnico', 'comentarista', 4),
  ('levanta', generate_stem('levanta'), 'cross_ball', 'cruza', 8, 'BR', 'informal', 'jogador', 2),
  ('alça', generate_stem('alça'), 'cross_ball', 'cruza alto', 6, 'BR', 'tecnico', 'comentarista', 4),
  ('chuveirinho', generate_stem('chuveirinho'), 'cross_ball', 'cruza alto', 7, 'BR', 'popular', 'torcida', 2),

  -- Passe
  ('passa', generate_stem('passa'), 'pass_to_player', 'passa', 10, 'BR', 'popular', 'jogador', 3),
  ('toca', generate_stem('toca'), 'quick_pass', 'toca rápido', 10, 'BR', 'popular', 'jogador', 3),
  ('toca rápido', generate_stem('toca rápido'), 'quick_pass', 'toca rápido', 9, 'BR', 'popular', 'treinador', 3),
  ('toque', generate_stem('toque'), 'quick_pass', 'toca', 8, 'BR', 'tecnico', 'comentarista', 4),
  ('açúcar', generate_stem('açúcar'), 'pass_to_player', 'passa bem', 6, 'BR', 'giria', 'comentarista', 2),
  ('açucarada', generate_stem('açucarada'), 'pass_to_player', 'passa bem', 6, 'BR', 'informal', 'comentarista', 3),
  ('bandeja', generate_stem('bandeja'), 'pass_to_player', 'passa fácil', 7, 'BR', 'giria', 'torcida', 1),

  -- Segurar bola
  ('segura a bola', generate_stem('segura a bola'), 'hold_ball', 'segura a bola', 10, 'BR', 'popular', 'treinador', 3),
  ('segura', generate_stem('segura'), 'hold_ball', 'segura', 9, 'BR', 'informal', 'torcida', 2),
  ('protege', generate_stem('protege'), 'hold_ball', 'protege a bola', 7, 'BR', 'tecnico', 'treinador', 4),
  ('mata a bola', generate_stem('mata a bola'), 'hold_ball', 'amortece', 7, 'BR', 'popular', 'jogador', 3),
  ('amortece', generate_stem('amortece'), 'hold_ball', 'amortece', 6, 'BR', 'tecnico', 'comentarista', 4),

  -- Trocar de lado
  ('troca de lado', generate_stem('troca de lado'), 'switch_play', 'troca de lado', 10, 'BR', 'tecnico', 'treinador', 4),
  ('inverte', generate_stem('inverte'), 'switch_play', 'inverte o jogo', 8, 'BR', 'tecnico', 'comentarista', 4),
  ('abre o jogo', generate_stem('abre o jogo'), 'switch_play', 'abre o jogo', 9, 'BR', 'popular', 'treinador', 3),
  ('estica', generate_stem('estica'), 'switch_play', 'passa longo', 7, 'BR', 'informal', 'jogador', 2),
  ('lança', generate_stem('lança'), 'switch_play', 'lança', 8, 'BR', 'popular', 'jogador', 3),
  ('abre a defesa', generate_stem('abre a defesa'), 'switch_play', 'abre o jogo', 7, 'BR', 'tecnico', 'treinador', 4),
  ('espalha', generate_stem('espalha'), 'switch_play', 'espalha', 6, 'BR', 'informal', 'jogador', 2),

  -- Invadir área
  ('invade a área', generate_stem('invade a área'), 'invade_box', 'invade a área', 10, 'BR', 'popular', 'torcida', 3),
  ('invade a grande área', generate_stem('invade a grande área'), 'invade_box', 'invade a área', 9, 'BR', 'tecnico', 'comentarista', 4),
  ('vai pra pequena', generate_stem('vai pra pequena'), 'hold_small_area', 'vai pra pequena área', 8, 'BR', 'giria', 'torcida', 1),
  ('vai até a pequena', generate_stem('vai até a pequena'), 'break_line', 'quebra a linha', 7, 'BR', 'informal', 'torcida', 2),

  -- Criativos
  ('quebra a linha', generate_stem('quebra a linha'), 'break_line', 'quebra a linha', 10, 'BR', 'tecnico', 'treinador', 4),
  ('quebra a zona', generate_stem('quebra a zona'), 'break_zone', 'quebra a zona', 9, 'BR', 'tecnico', 'treinador', 4),
  ('corre pelas costas', generate_stem('corre pelas costas'), 'run_behind', 'corre por trás', 9, 'BR', 'popular', 'treinador', 3),
  ('corre por trás', generate_stem('corre por trás'), 'run_behind', 'corre por trás', 8, 'BR', 'informal', 'jogador', 2),
  ('pisa no acelerador', generate_stem('pisa no acelerador'), 'pedal_to_metal', 'acelera', 8, 'BR', 'giria', 'torcida', 1),
  ('acelera', generate_stem('acelera'), 'pedal_to_metal', 'acelera', 9, 'BR', 'popular', 'jogador', 3),
  ('arranca', generate_stem('arranca'), 'pedal_to_metal', 'arranca', 8, 'BR', 'informal', 'torcida', 2),
  ('arrancada', generate_stem('arrancada'), 'pedal_to_metal', 'arranca', 7, 'BR', 'popular', 'comentarista', 3),
  ('espera a chegada', generate_stem('espera a chegada'), 'wait_support', 'espera apoio', 8, 'BR', 'tecnico', 'treinador', 4),
  ('espera apoio', generate_stem('espera apoio'), 'wait_support', 'espera apoio', 9, 'BR', 'popular', 'treinador', 3),
  ('aguarda', generate_stem('aguarda'), 'wait_support', 'aguarda', 7, 'BR', 'tecnico', 'comentarista', 4),
  ('se vira', generate_stem('se vira'), 'free_play', 'improvisa', 8, 'BR', 'giria', 'torcida', 1),
  ('improvisa', generate_stem('improvisa'), 'free_play', 'improvisa', 7, 'BR', 'popular', 'jogador', 3),
  ('joga o fino', generate_stem('joga o fino'), 'free_play', 'joga bem', 6, 'BR', 'giria', 'torcida', 1),

  -- INDIVIDUAL DEFENSIVO
  ('marca', generate_stem('marca'), 'mark_player', 'marca', 10, 'BR', 'popular', 'treinador', 3),
  ('cola', generate_stem('cola'), 'mark_player', 'marca de perto', 8, 'BR', 'giria', 'torcida', 1),
  ('gruda', generate_stem('gruda'), 'mark_player', 'marca de perto', 8, 'BR', 'giria', 'torcida', 1),
  ('carrapato', generate_stem('carrapato'), 'mark_player', 'marca grudado', 6, 'BR', 'giria', 'torcida', 1),
  ('perdigueiro', generate_stem('perdigueiro'), 'mark_player', 'marca implacável', 5, 'BR', 'informal', 'comentarista', 3),
  ('encaixa a marcação', generate_stem('encaixa a marcação'), 'mark_player', 'marca bem', 7, 'BR', 'tecnico', 'treinador', 4),

  ('segura ele', generate_stem('segura ele'), 'block_advance', 'segura', 9, 'BR', 'informal', 'torcida', 2),
  ('bloqueia', generate_stem('bloqueia'), 'block_advance', 'bloqueia', 8, 'BR', 'tecnico', 'treinador', 4),
  ('anteparo', generate_stem('anteparo'), 'block_advance', 'fica na frente', 6, 'BR', 'tecnico', 'comentarista', 4),
  ('fecha', generate_stem('fecha'), 'block_advance', 'fecha', 8, 'BR', 'popular', 'jogador', 3),

  ('entra com tudo', generate_stem('entra com tudo'), 'aggressive_tackle', 'entra duro', 8, 'BR', 'giria', 'torcida', 1),
  ('entra duro', generate_stem('entra duro'), 'aggressive_tackle', 'entra duro', 9, 'BR', 'informal', 'torcida', 2),
  ('carrinho', generate_stem('carrinho'), 'aggressive_tackle', 'carrinho', 9, 'BR', 'popular', 'jogador', 3),
  ('bote', generate_stem('bote'), 'aggressive_tackle', 'bote', 8, 'BR', 'tecnico', 'comentarista', 4),
  ('desarma', generate_stem('desarma'), 'aggressive_tackle', 'desarma', 9, 'BR', 'popular', 'treinador', 3),

  ('faz falta', generate_stem('faz falta'), 'tactical_foul', 'faz falta', 10, 'BR', 'popular', 'treinador', 3),
  ('falta tática', generate_stem('falta tática'), 'tactical_foul', 'falta tática', 9, 'BR', 'tecnico', 'comentarista', 4),
  ('mata a jogada', generate_stem('mata a jogada'), 'tactical_foul', 'para o jogo', 8, 'BR', 'popular', 'treinador', 3),
  ('para o jogo', generate_stem('para o jogo'), 'tactical_foul', 'para o jogo', 8, 'BR', 'informal', 'torcida', 2),

  -- COLETIVO
  ('pressiona alto', generate_stem('pressiona alto'), 'team_press_high', 'pressiona alto', 10, 'BR', 'tecnico', 'treinador', 4),
  ('pressão alta', generate_stem('pressão alta'), 'team_press_high', 'pressiona alto', 9, 'BR', 'popular', 'treinador', 3),
  ('marca na saída', generate_stem('marca na saída'), 'team_press_high', 'marca na saída', 8, 'BR', 'tecnico', 'treinador', 4),
  ('sufoca', generate_stem('sufoca'), 'team_press_high', 'pressiona', 8, 'BR', 'informal', 'torcida', 2),
  ('encurrala', generate_stem('encurrala'), 'team_press_high', 'pressiona', 7, 'BR', 'giria', 'torcida', 1),

  ('recua', generate_stem('recua'), 'team_retreat', 'recua', 10, 'BR', 'popular', 'treinador', 3),
  ('volta pra defesa', generate_stem('volta pra defesa'), 'team_retreat', 'recua', 9, 'BR', 'informal', 'torcida', 2),
  ('defende', generate_stem('defende'), 'team_retreat', 'defende', 9, 'BR', 'popular', 'torcida', 3),
  ('fecha atrás', generate_stem('fecha atrás'), 'team_retreat', 'fecha atrás', 8, 'BR', 'popular', 'treinador', 3),
  ('retranca', generate_stem('retranca'), 'team_retreat', 'retranca', 7, 'BR', 'informal', 'comentarista', 3),
  ('ferrolho', generate_stem('ferrolho'), 'team_retreat', 'retranca', 6, 'BR', 'tecnico', 'comentarista', 4),
  ('encaixota', generate_stem('encaixota'), 'team_retreat', 'fecha atrás', 6, 'BR', 'giria', 'torcida', 1),

  ('segura o jogo', generate_stem('segura o jogo'), 'team_hold_possession', 'segura o jogo', 10, 'BR', 'popular', 'treinador', 3),
  ('mata o jogo', generate_stem('mata o jogo'), 'team_hold_possession', 'mata o jogo', 9, 'BR', 'informal', 'torcida', 2),
  ('toca a bola', generate_stem('toca a bola'), 'team_hold_possession', 'toca a bola', 9, 'BR', 'popular', 'treinador', 3),
  ('roda a bola', generate_stem('roda a bola'), 'team_hold_possession', 'roda a bola', 8, 'BR', 'popular', 'jogador', 3),
  ('valoriza a posse', generate_stem('valoriza a posse'), 'team_hold_possession', 'valoriza a posse', 8, 'BR', 'tecnico', 'comentarista', 4),
  ('tabela', generate_stem('tabela'), 'team_hold_possession', 'faz tabela', 8, 'BR', 'popular', 'jogador', 3),
  ('triangula', generate_stem('triangula'), 'team_hold_possession', 'triangula', 7, 'BR', 'tecnico', 'treinador', 4),

  ('sobe o time', generate_stem('sobe o time'), 'team_high_line', 'sobe o time', 10, 'BR', 'popular', 'treinador', 3),
  ('linha alta', generate_stem('linha alta'), 'team_high_line', 'linha alta', 9, 'BR', 'tecnico', 'treinador', 4),
  ('compacta', generate_stem('compacta'), 'team_high_line', 'compacta', 8, 'BR', 'tecnico', 'treinador', 4),
  ('estica o time', generate_stem('estica o time'), 'stretch_team', 'estica o time', 8, 'BR', 'popular', 'treinador', 3),

  ('atacantes pressionam', generate_stem('atacantes pressionam'), 'forwards_press_defenders', 'atacantes pressionam', 9, 'BR', 'tecnico', 'treinador', 4),
  ('atacantes marcam', generate_stem('atacantes marcam'), 'forwards_press_defenders', 'atacantes marcam', 8, 'BR', 'popular', 'treinador', 3),

  ('meias fecham', generate_stem('meias fecham'), 'midfielders_compact', 'meias fecham', 9, 'BR', 'tecnico', 'treinador', 4),
  ('fecha o meio', generate_stem('fecha o meio'), 'midfielders_compact', 'fecha o meio', 9, 'BR', 'popular', 'treinador', 3),
  ('compacta o meio', generate_stem('compacta o meio'), 'midfielders_compact', 'compacta o meio', 8, 'BR', 'tecnico', 'treinador', 4),

  ('laterais cruzam', generate_stem('laterais cruzam'), 'laterals_cross', 'laterais cruzam', 9, 'BR', 'tecnico', 'treinador', 4),
  ('laterais sobem', generate_stem('laterais sobem'), 'laterals_cross', 'laterais sobem', 8, 'BR', 'popular', 'treinador', 3),

  ('sobe o lateral esquerdo', generate_stem('sobe o lateral esquerdo'), 'left_back_overlap', 'lateral esquerdo sobe', 9, 'BR', 'tecnico', 'treinador', 4),
  ('lateral esquerdo sobe', generate_stem('lateral esquerdo sobe'), 'left_back_overlap', 'lateral esquerdo sobe', 8, 'BR', 'popular', 'treinador', 3),

  -- FÍSICO / MENTAL
  ('poupa', generate_stem('poupa'), 'spare_player', 'poupa', 9, 'BR', 'popular', 'treinador', 3),
  ('economiza', generate_stem('economiza'), 'spare_player', 'economiza', 8, 'BR', 'informal', 'treinador', 3),
  ('guarda energia', generate_stem('guarda energia'), 'spare_player', 'guarda energia', 7, 'BR', 'tecnico', 'treinador', 4),

  ('acalma', generate_stem('acalma'), 'calm_team', 'acalma', 10, 'BR', 'popular', 'treinador', 3),
  ('acalma o time', generate_stem('acalma o time'), 'calm_team', 'acalma o time', 9, 'BR', 'popular', 'treinador', 3),
  ('tranquiliza', generate_stem('tranquiliza'), 'calm_team', 'tranquiliza', 8, 'BR', 'tecnico', 'treinador', 4),
  ('respira', generate_stem('respira'), 'calm_team', 'respira', 7, 'BR', 'informal', 'torcida', 2)

ON CONFLICT (phrase) DO UPDATE SET
  confirm_count = learned_phrases.confirm_count + EXCLUDED.confirm_count,
  updated_at = now();

-- Limpa função auxiliar
DROP FUNCTION IF EXISTS generate_stem(TEXT);

COMMENT ON TABLE learned_phrases IS 'Biblioteca de frases de comandos de voz - inclui vocabulário do futebol brasileiro';

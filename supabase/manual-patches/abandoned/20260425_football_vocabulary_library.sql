-- ============================================================================
-- OLEFOOT — Biblioteca de Vocabulário de Futebol PT-BR
-- ============================================================================
-- Popula a tabela learned_phrases com centenas de variações de comandos
-- de futebol usados no Brasil, Portugal e países lusófonos.
--
-- Estrutura: frase coloquial → frase canônica → intent
-- ============================================================================

-- Limpa dados de teste anteriores (opcional)
-- DELETE FROM learned_phrases WHERE phrase LIKE '%teste%';

-- ============================================================================
-- 1. COMANDOS OFENSIVOS — FINALIZAÇÃO
-- ============================================================================

-- CHUTA / FINALIZA
INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count) VALUES
-- Gírias brasileiras
('manda bala', 'mand bal', 'take_shot', 'chuta', 10),
('mete o pé', 'met pe', 'take_shot', 'chuta', 8),
('bate de primeira', 'bat primeir', 'take_shot', 'chuta', 7),
('arrisca', 'arrisc', 'take_shot', 'chuta', 6),
('manda ver', 'mand ver', 'take_shot', 'chuta', 5),
('solta o pé', 'solt pe', 'take_shot', 'chuta', 5),
('bate forte', 'bat fort', 'take_shot', 'chuta', 4),
('manda pro gol', 'mand gol', 'take_shot', 'chuta', 4),
('bate colocado', 'bat coloc', 'take_shot', 'chuta', 3),
('finaliza aí', 'finaliz ai', 'take_shot', 'chuta', 3),
('manda pra rede', 'mand red', 'take_shot', 'chuta', 3),
('bate no canto', 'bat cant', 'take_shot', 'chuta', 2),
('solta a bomba', 'solt bomb', 'take_shot', 'chuta', 2),
('manda pro ângulo', 'mand angul', 'take_shot', 'chuta', 2),

-- Variações portuguesas
('remata', 'remat', 'take_shot', 'chuta', 4),
('dispara', 'dispar', 'take_shot', 'chuta', 3),
('atira', 'atir', 'take_shot', 'chuta', 3),

-- DRIBLE
('enfia', 'enfi', 'dribble_attempt', 'dribla', 8),
('passa por ele', 'pass el', 'dribble_attempt', 'dribla', 7),
('dá um drible', 'da dribl', 'dribble_attempt', 'dribla', 6),
('faz a finta', 'faz fint', 'dribble_attempt', 'dribla', 5),
('tira ele da jogada', 'tir el jogad', 'dribble_attempt', 'dribla', 4),
('passa pelo marcador', 'pass marcador', 'dribble_attempt', 'dribla', 4),
('dá um lençol', 'da lencol', 'dribble_attempt', 'dribla', 3),
('faz a caneta', 'faz canet', 'dribble_attempt', 'dribla', 3),
('tira ele do lance', 'tir el lanc', 'dribble_attempt', 'dribla', 2),
('deixa ele pra trás', 'deix el tras', 'dribble_attempt', 'dribla', 2),

-- INVADE ÁREA
('vai pra área', 'vai area', 'invade_box', 'invade a area', 9),
('entra na área', 'entr area', 'invade_box', 'invade a area', 8),
('penetra na área', 'penetr area', 'invade_box', 'invade a area', 6),
('vai pra grande área', 'vai grand area', 'invade_box', 'invade a area', 5),
('ataca a área', 'atac area', 'invade_box', 'invade a area', 5),
('invade o retângulo', 'invad retangul', 'invade_box', 'invade a area', 3),
('vai pra pequena', 'vai pequen', 'hold_small_area', 'vai pra pequena e segura', 4),
('fica na pequena', 'fic pequen', 'hold_small_area', 'vai pra pequena e segura', 3),

-- CRUZAMENTO
('levanta a bola', 'levant bol', 'cross_ball', 'cruza', 8),
('põe na área', 'poe area', 'cross_ball', 'cruza', 7),
('manda pro meio', 'mand mei', 'cross_ball', 'cruza', 6),
('cruza rasteiro', 'cruz rasteir', 'cross_ball', 'cruza', 4),
('cruza na medida', 'cruz medid', 'cross_ball', 'cruza', 3),
('bota na cabeça', 'bot cabec', 'cross_ball', 'cruza', 3),
('levanta na área', 'levant area', 'cross_ball', 'cruza', 2),

-- ============================================================================
-- 2. COMANDOS OFENSIVOS — PASSE
-- ============================================================================

-- PASSA
('toca', 'toc', 'pass_to_player', 'passa', 10),
('dá a bola', 'da bol', 'pass_to_player', 'passa', 8),
('aciona', 'acion', 'pass_to_player', 'passa', 7),
('serve', 'serv', 'pass_to_player', 'passa', 6),
('lança', 'lanc', 'pass_to_player', 'passa', 5),
('mete a bola', 'met bol', 'pass_to_player', 'passa', 4),
('entrega', 'entreg', 'pass_to_player', 'passa', 4),
('liga', 'lig', 'pass_to_player', 'passa', 3),
('abre', 'abr', 'pass_to_player', 'passa', 3),

-- TOQUE RÁPIDO
('toca rápido', 'toc rapid', 'quick_pass', 'toca rapido', 8),
('toque de primeira', 'toqu primeir', 'quick_pass', 'toca rapido', 7),
('devolve', 'devolv', 'quick_pass', 'toca rapido', 5),
('tabela', 'tabel', 'quick_pass', 'toca rapido', 5),
('toca de primeira', 'toc primeir', 'quick_pass', 'toca rapido', 4),
('dá um toque', 'da toqu', 'quick_pass', 'toca rapido', 3),

-- TROCA DE LADO
('inverte', 'invert', 'switch_play', 'troca de lado', 8),
('abre o jogo', 'abr jog', 'switch_play', 'troca de lado', 7),
('muda de lado', 'mud lad', 'switch_play', 'troca de lado', 6),
('joga pro outro lado', 'jog outr lad', 'switch_play', 'troca de lado', 4),
('cruza o jogo', 'cruz jog', 'switch_play', 'troca de lado', 3),

-- SEGURA BOLA
('fica com a bola', 'fic bol', 'hold_ball', 'segura a bola', 8),
('guarda', 'guard', 'hold_ball', 'segura a bola', 6),
('protege', 'proteg', 'hold_ball', 'segura a bola', 5),
('não perde', 'nao perd', 'hold_ball', 'segura a bola', 4),
('domina', 'domin', 'hold_ball', 'segura a bola', 3),

-- ============================================================================
-- 3. COMANDOS DEFENSIVOS
-- ============================================================================

-- MARCA
('cola nele', 'col nel', 'mark_player', 'marca', 9),
('pega ele', 'peg el', 'mark_player', 'marca', 8),
('gruda nele', 'grud nel', 'mark_player', 'marca', 7),
('não deixa ele jogar', 'nao deix el jog', 'mark_player', 'marca', 6),
('fecha ele', 'fech el', 'mark_player', 'marca', 5),
('marca em cima', 'marc cim', 'mark_player', 'marca', 4),
('não sai dele', 'nao sai del', 'mark_player', 'marca', 3),

-- SEGURA / BLOQUEIA
('segura ele', 'segur el', 'block_advance', 'segura ele', 8),
('fecha o espaço', 'fech espac', 'block_advance', 'segura ele', 7),
('não deixa passar', 'nao deix pass', 'block_advance', 'segura ele', 6),
('barra ele', 'barr el', 'block_advance', 'segura ele', 5),
('trava', 'trav', 'block_advance', 'segura ele', 4),
('fecha a passagem', 'fech passag', 'block_advance', 'segura ele', 3),

-- ENTRA DURO
('vai com tudo', 'vai tud', 'aggressive_tackle', 'entra duro', 7),
('mete o pé', 'met pe', 'aggressive_tackle', 'entra duro', 6),
('divide forte', 'divid fort', 'aggressive_tackle', 'entra duro', 5),
('vai pra cima', 'vai cim', 'aggressive_tackle', 'entra duro', 4),
('não tem dó', 'nao tem do', 'aggressive_tackle', 'entra duro', 3),

-- FALTA TÁTICA
('para ele', 'par el', 'tactical_foul', 'faz falta', 7),
('comete a falta', 'comet falt', 'tactical_foul', 'faz falta', 6),
('segura com falta', 'segur falt', 'tactical_foul', 'faz falta', 5),
('para o contra-ataque', 'par contr ataq', 'tactical_foul', 'faz falta', 4),
('falta tática', 'falt tatic', 'tactical_foul', 'faz falta', 3),

-- ============================================================================
-- 4. COMANDOS COLETIVOS — PRESSÃO
-- ============================================================================

-- PRESSIONA ALTO
('bota pressão', 'bot pressa', 'team_press_high', 'pressiona alto', 10),
('pressiona', 'pression', 'team_press_high', 'pressiona alto', 9),
('marca alto', 'marc alt', 'team_press_high', 'pressiona alto', 8),
('sufoca', 'sufoc', 'team_press_high', 'pressiona alto', 7),
('vai pra cima', 'vai cim', 'team_press_high', 'pressiona alto', 6),
('não deixa sair', 'nao deix sai', 'team_press_high', 'pressiona alto', 5),
('pressão alta', 'pressa alt', 'team_press_high', 'pressiona alto', 5),
('marca na saída', 'marc said', 'team_press_high', 'pressiona alto', 4),
('aperta', 'apert', 'team_press_high', 'pressiona alto', 4),
('encurrala', 'encurral', 'team_press_high', 'pressiona alto', 3),

-- RECUA
('volta', 'volt', 'team_retreat', 'recua', 9),
('volta pra defesa', 'volt defes', 'team_retreat', 'recua', 8),
('todos atrás', 'tod atras', 'team_retreat', 'recua', 7),
('fecha atrás', 'fech atras', 'team_retreat', 'recua', 6),
('defende', 'defend', 'team_retreat', 'recua', 5),
('recua o bloco', 'recu bloc', 'team_retreat', 'recua', 4),
('volta pro campo', 'volt camp', 'team_retreat', 'recua', 3),

-- SEGURA O JOGO
('mata o jogo', 'mat jog', 'team_hold_possession', 'mata o jogo', 9),
('segura o jogo', 'segur jog', 'team_hold_possession', 'mata o jogo', 8),
('toca a bola', 'toc bol', 'team_hold_possession', 'mata o jogo', 7),
('administra', 'administr', 'team_hold_possession', 'mata o jogo', 6),
('roda a bola', 'rod bol', 'team_hold_possession', 'mata o jogo', 5),
('mantém a posse', 'mant poss', 'team_hold_possession', 'mata o jogo', 4),
('não perde a bola', 'nao perd bol', 'team_hold_possession', 'mata o jogo', 3),

-- SOBE O TIME
('sobe a linha', 'sob linh', 'team_high_line', 'sobe o time', 8),
('linha alta', 'linh alt', 'team_high_line', 'sobe o time', 7),
('compacta', 'compact', 'team_high_line', 'sobe o time', 5),
('sobe o bloco', 'sob bloc', 'team_high_line', 'sobe o time', 4),
('avança', 'avanc', 'team_high_line', 'sobe o time', 3),

-- ============================================================================
-- 5. COMANDOS CRIATIVOS
-- ============================================================================

-- QUEBRA A LINHA
('fura a zaga', 'fur zag', 'break_line', 'quebra a linha', 7),
('vai pelas costas', 'vai cost', 'run_behind', 'corre pelas costas', 8),
('corre por trás', 'corr tras', 'run_behind', 'corre pelas costas', 6),
('ataca o espaço', 'atac espac', 'break_line', 'quebra a linha', 5),
('rompe a defesa', 'romp defes', 'break_line', 'quebra a linha', 4),

-- ACELERA
('pisa no acelerador', 'pis acelerador', 'pedal_to_metal', 'acelera', 8),
('acelera o jogo', 'acel jog', 'pedal_to_metal', 'acelera', 7),
('aumenta o ritmo', 'aument ritm', 'pedal_to_metal', 'acelera', 6),
('joga rápido', 'jog rapid', 'pedal_to_metal', 'acelera', 5),
('toca rápido', 'toc rapid', 'pedal_to_metal', 'acelera', 4),
('vai com tudo', 'vai tud', 'pedal_to_metal', 'acelera', 3),

-- SE VIRA / IMPROVISA
('improvisa', 'improvis', 'free_play', 'se vira', 6),
('joga livre', 'jog livr', 'free_play', 'se vira', 5),
('faz tua jogada', 'faz tu jogad', 'free_play', 'se vira', 4),
('decide', 'decid', 'free_play', 'se vira', 3),

-- ESPERA APOIO
('aguarda', 'aguard', 'wait_support', 'espera a chegada', 6),
('espera o time', 'esper tim', 'wait_support', 'espera a chegada', 5),
('segura até chegar apoio', 'segur ate cheg apoi', 'wait_support', 'espera a chegada', 4),

-- ESTICA O TIME
('abre o time', 'abr tim', 'stretch_team', 'estica o time', 6),
('espalha', 'espalh', 'stretch_team', 'estica o time', 5),
('ocupa os espaços', 'ocup espac', 'stretch_team', 'estica o time', 4),

-- ============================================================================
-- 6. COMANDOS SETORIAIS
-- ============================================================================

-- ATACANTES
('atacantes pressionam', 'atac pression', 'forwards_press_defenders', 'atacantes pressionam', 7),
('frente pressiona', 'frent pression', 'forwards_press_defenders', 'atacantes pressionam', 5),
('pontas marcam', 'pont marc', 'forwards_press_defenders', 'atacantes pressionam', 4),

-- MEIO-CAMPO
('meias fecham', 'mei fech', 'midfielders_compact', 'meias fecham o meio', 7),
('fecha o meio', 'fech mei', 'midfielders_compact', 'meias fecham o meio', 6),
('meio compacto', 'mei compact', 'midfielders_compact', 'meias fecham o meio', 5),
('volantes marcam', 'volant marc', 'midfielders_compact', 'meias fecham o meio', 4),

-- LATERAIS
('laterais sobem', 'later sob', 'laterals_cross', 'laterais cruzam', 6),
('laterais apoiam', 'later apoi', 'laterals_cross', 'laterais cruzam', 5),
('sobe o lateral', 'sob later', 'left_back_overlap', 'sobe o lateral esquerdo', 5),

-- ============================================================================
-- 7. COMANDOS MENTAIS
-- ============================================================================

-- CALMA
('respira', 'respir', 'calm_team', 'acalma o time', 8),
('calma aí', 'calm ai', 'calm_team', 'acalma o time', 7),
('tranquilidade', 'tranquil', 'calm_team', 'acalma o time', 5),
('sem desespero', 'sem desper', 'calm_team', 'acalma o time', 4),
('cabeça fria', 'cabec fri', 'calm_team', 'acalma o time', 3),

-- POUPA
('economiza', 'econom', 'spare_player', 'poupa', 5),
('não força', 'nao forc', 'spare_player', 'poupa', 4),
('desacelera', 'desacel', 'spare_player', 'poupa', 3),

-- ============================================================================
-- 8. VARIAÇÕES REGIONAIS (Portugal, Angola, Moçambique)
-- ============================================================================

-- Portugal
('remata à baliza', 'remat baliz', 'take_shot', 'chuta', 4),
('passa a bola', 'pass bol', 'pass_to_player', 'passa', 5),
('faz o drible', 'faz dribl', 'dribble_attempt', 'dribla', 4),
('marca cerrado', 'marc cerrad', 'mark_player', 'marca', 3),

-- Angola / Moçambique
('manda na baliza', 'mand baliz', 'take_shot', 'chuta', 3),
('toca para', 'toc par', 'pass_to_player', 'passa', 3)

ON CONFLICT (phrase, intent) DO UPDATE SET
  confirm_count = learned_phrases.confirm_count + EXCLUDED.confirm_count,
  updated_at = NOW();

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_learned_phrases_intent ON learned_phrases(intent);
CREATE INDEX IF NOT EXISTS idx_learned_phrases_confirm_count ON learned_phrases(confirm_count DESC);
CREATE INDEX IF NOT EXISTS idx_learned_phrases_phrase_trgm ON learned_phrases USING gin(phrase gin_trgm_ops);

-- ============================================================================
-- ESTATÍSTICAS
-- ============================================================================

-- Total de frases na biblioteca
SELECT COUNT(*) as total_phrases FROM learned_phrases;

-- Top 10 intents mais populares
SELECT intent, COUNT(*) as phrase_count, SUM(confirm_count) as total_confirms
FROM learned_phrases
GROUP BY intent
ORDER BY total_confirms DESC
LIMIT 10;

-- Frases mais confirmadas
SELECT phrase, intent, canonical_phrase, confirm_count
FROM learned_phrases
ORDER BY confirm_count DESC
LIMIT 20;

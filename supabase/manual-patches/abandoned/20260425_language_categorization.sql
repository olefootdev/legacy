-- ============================================================================
-- OLEFOOT — Categorização de Linguagem dos Comandos de Voz
-- ============================================================================
-- Adiciona metadados de linguagem para cada comando:
--   - region: BR, PT, AO, MZ (país/região)
--   - language_type: popular, tecnico, formal, informal, giria
--   - context: torcida, treinador, comentarista, jogador
-- ============================================================================

-- Adiciona colunas de metadados (se não existirem)
ALTER TABLE learned_phrases ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'BR';
ALTER TABLE learned_phrases ADD COLUMN IF NOT EXISTS language_type VARCHAR(20) DEFAULT 'popular';
ALTER TABLE learned_phrases ADD COLUMN IF NOT EXISTS context VARCHAR(30) DEFAULT 'torcida';
ALTER TABLE learned_phrases ADD COLUMN IF NOT EXISTS formality_level INTEGER DEFAULT 3; -- 1=muito informal, 5=muito formal

-- ============================================================================
-- ATUALIZA COMANDOS EXISTENTES COM CATEGORIZAÇÃO
-- ============================================================================

-- ─── LINGUAGEM POPULAR (Torcida / Rua) ─────────────────────────────────────

UPDATE learned_phrases SET
  region = 'BR',
  language_type = 'giria',
  context = 'torcida',
  formality_level = 1
WHERE phrase IN (
  'manda bala',
  'mete o pé',
  'solta o pé',
  'bota pressão',
  'cola nele',
  'gruda nele',
  'vai com tudo',
  'não tem dó',
  'enfia',
  'dá um lençol',
  'faz a caneta',
  'mata o jogo',
  'pisa no acelerador'
);

-- ─── LINGUAGEM TÉCNICA (Treinador Profissional) ────────────────────────────

UPDATE learned_phrases SET
  region = 'BR',
  language_type = 'tecnico',
  context = 'treinador',
  formality_level = 4
WHERE phrase IN (
  'pressiona alto',
  'marca em cima',
  'fecha o espaço',
  'compacta',
  'sobe a linha',
  'recua o bloco',
  'quebra a linha',
  'ocupa os espaços',
  'administra',
  'mantém a posse'
);

-- ─── LINGUAGEM FORMAL (Comentarista / Imprensa) ────────────────────────────

UPDATE learned_phrases SET
  region = 'BR',
  language_type = 'formal',
  context = 'comentarista',
  formality_level = 5
WHERE phrase IN (
  'finaliza',
  'cruza a bola',
  'marca o adversário',
  'recua para defesa',
  'mantém a posse de bola'
);

-- ─── LINGUAGEM INFORMAL (Pelada / Amigos) ──────────────────────────────────

UPDATE learned_phrases SET
  region = 'BR',
  language_type = 'informal',
  context = 'jogador',
  formality_level = 2
WHERE phrase IN (
  'chuta',
  'passa',
  'toca',
  'cruza',
  'marca',
  'recua',
  'vai pra área',
  'dribla'
);

-- ─── PORTUGUÊS DE PORTUGAL ─────────────────────────────────────────────────

UPDATE learned_phrases SET
  region = 'PT',
  language_type = 'formal',
  context = 'comentarista',
  formality_level = 4
WHERE phrase IN (
  'remata',
  'remata à baliza',
  'passa a bola',
  'faz o drible',
  'marca cerrado'
);

-- ============================================================================
-- INSERE NOVOS COMANDOS COM CATEGORIZAÇÃO COMPLETA
-- ============================================================================

-- ─── GÍRIAS BRASILEIRAS (Torcida) ──────────────────────────────────────────

INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level) VALUES
-- Finalização - Gírias
('manda ver', 'mand ver', 'take_shot', 'chuta', 5, 'BR', 'giria', 'torcida', 1),
('bota pra dentro', 'bot dent', 'take_shot', 'chuta', 4, 'BR', 'giria', 'torcida', 1),
('manda pro gol', 'mand gol', 'take_shot', 'chuta', 4, 'BR', 'giria', 'torcida', 1),
('solta a bomba', 'solt bomb', 'take_shot', 'chuta', 3, 'BR', 'giria', 'torcida', 1),
('manda pra rede', 'mand red', 'take_shot', 'chuta', 3, 'BR', 'giria', 'torcida', 1),

-- Pressão - Gírias
('bota pra cima', 'bot cim', 'team_press_high', 'pressiona alto', 5, 'BR', 'giria', 'torcida', 1),
('vai pra cima deles', 'vai cim del', 'team_press_high', 'pressiona alto', 4, 'BR', 'giria', 'torcida', 1),
('não deixa jogar', 'nao deix jog', 'team_press_high', 'pressiona alto', 4, 'BR', 'giria', 'torcida', 1),

-- Marcação - Gírias
('pega ele', 'peg el', 'mark_player', 'marca', 5, 'BR', 'giria', 'torcida', 1),
('não sai dele', 'nao sai del', 'mark_player', 'marca', 4, 'BR', 'giria', 'torcida', 1),
('gruda que nem chiclete', 'grud nem chiclet', 'mark_player', 'marca', 3, 'BR', 'giria', 'torcida', 1)

ON CONFLICT (phrase, intent) DO UPDATE SET
  region = EXCLUDED.region,
  language_type = EXCLUDED.language_type,
  context = EXCLUDED.context,
  formality_level = EXCLUDED.formality_level;

-- ─── LINGUAGEM TÉCNICA (Treinador Profissional) ────────────────────────────

INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level) VALUES
-- Tática defensiva
('fecha o corredor central', 'fech corred centr', 'midfielders_compact', 'meias fecham o meio', 5, 'BR', 'tecnico', 'treinador', 4),
('compacta o bloco defensivo', 'compact bloc defens', 'team_retreat', 'recua', 5, 'BR', 'tecnico', 'treinador', 5),
('sobe a linha de impedimento', 'sob linh imped', 'team_high_line', 'sobe o time', 4, 'BR', 'tecnico', 'treinador', 5),
('marca por zona', 'marc zon', 'team_retreat', 'recua', 4, 'BR', 'tecnico', 'treinador', 4),
('pressão no portador', 'pressa portador', 'team_press_high', 'pressiona alto', 5, 'BR', 'tecnico', 'treinador', 4),

-- Tática ofensiva
('ocupa a meia-lua', 'ocup mei lu', 'invade_box', 'invade a area', 4, 'BR', 'tecnico', 'treinador', 4),
('busca profundidade', 'busc profund', 'run_behind', 'corre pelas costas', 5, 'BR', 'tecnico', 'treinador', 4),
('amplitude pelos lados', 'amplit lad', 'stretch_team', 'estica o time', 4, 'BR', 'tecnico', 'treinador', 5),
('triangulação', 'triangul', 'quick_pass', 'toca rapido', 4, 'BR', 'tecnico', 'treinador', 5),
('jogo de posição', 'jog posic', 'team_hold_possession', 'mata o jogo', 5, 'BR', 'tecnico', 'treinador', 5)

ON CONFLICT (phrase, intent) DO UPDATE SET
  region = EXCLUDED.region,
  language_type = EXCLUDED.language_type,
  context = EXCLUDED.context,
  formality_level = EXCLUDED.formality_level;

-- ─── LINGUAGEM FORMAL (Comentarista) ───────────────────────────────────────

INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level) VALUES
('efetua o arremate', 'efetu arremat', 'take_shot', 'chuta', 3, 'BR', 'formal', 'comentarista', 5),
('realiza o cruzamento', 'realiz cruzament', 'cross_ball', 'cruza', 3, 'BR', 'formal', 'comentarista', 5),
('executa a marcação', 'execut marcac', 'mark_player', 'marca', 3, 'BR', 'formal', 'comentarista', 5),
('conduz a bola', 'conduz bol', 'dribble_attempt', 'dribla', 3, 'BR', 'formal', 'comentarista', 4),
('administra o resultado', 'administr result', 'team_hold_possession', 'mata o jogo', 4, 'BR', 'formal', 'comentarista', 5)

ON CONFLICT (phrase, intent) DO UPDATE SET
  region = EXCLUDED.region,
  language_type = EXCLUDED.language_type,
  context = EXCLUDED.context,
  formality_level = EXCLUDED.formality_level;

-- ─── PORTUGUÊS DE PORTUGAL ─────────────────────────────────────────────────

INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level) VALUES
-- Formal PT
('remata à baliza', 'remat baliz', 'take_shot', 'chuta', 4, 'PT', 'formal', 'comentarista', 5),
('efectua o remate', 'efetu remat', 'take_shot', 'chuta', 3, 'PT', 'formal', 'comentarista', 5),
('cruza para a área', 'cruz area', 'cross_ball', 'cruza', 4, 'PT', 'formal', 'comentarista', 4),
('marca à zona', 'marc zon', 'team_retreat', 'recua', 3, 'PT', 'tecnico', 'treinador', 4),

-- Informal PT
('manda vir', 'mand vir', 'take_shot', 'chuta', 3, 'PT', 'informal', 'torcida', 2),
('atira', 'atir', 'take_shot', 'chuta', 3, 'PT', 'informal', 'torcida', 2),
('passa-lhe', 'pass lh', 'pass_to_player', 'passa', 3, 'PT', 'informal', 'jogador', 2)

ON CONFLICT (phrase, intent) DO UPDATE SET
  region = EXCLUDED.region,
  language_type = EXCLUDED.language_type,
  context = EXCLUDED.context,
  formality_level = EXCLUDED.formality_level;

-- ─── REGIONALISMOS BRASILEIROS ─────────────────────────────────────────────

INSERT INTO learned_phrases (phrase, stem, intent, canonical_phrase, confirm_count, region, language_type, context, formality_level) VALUES
-- Nordeste
('bota pra quebrar', 'bot quebr', 'take_shot', 'chuta', 3, 'BR-NE', 'giria', 'torcida', 1),
('arranca', 'arranc', 'dribble_attempt', 'dribla', 3, 'BR-NE', 'giria', 'torcida', 1),
('bota moral', 'bot moral', 'team_press_high', 'pressiona alto', 2, 'BR-NE', 'giria', 'torcida', 1),

-- Sul
('bah manda', 'bah mand', 'take_shot', 'chuta', 2, 'BR-S', 'giria', 'torcida', 1),
('tchê cruza', 'tche cruz', 'cross_ball', 'cruza', 2, 'BR-S', 'giria', 'torcida', 1),
('capricha', 'caprich', 'take_shot', 'chuta', 2, 'BR-S', 'informal', 'jogador', 2),

-- Rio de Janeiro
('manda brasa', 'mand bras', 'take_shot', 'chuta', 3, 'BR-RJ', 'giria', 'torcida', 1),
('dá um baile', 'da bail', 'dribble_attempt', 'dribla', 3, 'BR-RJ', 'giria', 'torcida', 1),

-- São Paulo
('manda ver mano', 'mand ver man', 'take_shot', 'chuta', 2, 'BR-SP', 'giria', 'torcida', 1),
('quebra ele', 'quebr el', 'dribble_attempt', 'dribla', 2, 'BR-SP', 'giria', 'torcida', 1)

ON CONFLICT (phrase, intent) DO UPDATE SET
  region = EXCLUDED.region,
  language_type = EXCLUDED.language_type,
  context = EXCLUDED.context,
  formality_level = EXCLUDED.formality_level;

-- ============================================================================
-- VIEWS PARA CONSULTA RÁPIDA
-- ============================================================================

-- View: Comandos por tipo de linguagem
CREATE OR REPLACE VIEW v_commands_by_language_type AS
SELECT
  language_type,
  context,
  COUNT(*) as command_count,
  AVG(formality_level) as avg_formality,
  STRING_AGG(DISTINCT region, ', ') as regions
FROM learned_phrases
GROUP BY language_type, context
ORDER BY command_count DESC;

-- View: Exemplos por categoria
CREATE OR REPLACE VIEW v_command_examples AS
SELECT
  language_type,
  context,
  region,
  formality_level,
  phrase,
  canonical_phrase,
  intent,
  confirm_count,
  CASE
    WHEN formality_level = 1 THEN '🔥 Muito Informal (Torcida)'
    WHEN formality_level = 2 THEN '😎 Informal (Pelada)'
    WHEN formality_level = 3 THEN '⚽ Neutro (Jogador)'
    WHEN formality_level = 4 THEN '🎓 Técnico (Treinador)'
    WHEN formality_level = 5 THEN '📺 Formal (Comentarista)'
  END as formality_label,
  CASE
    WHEN region = 'BR' THEN '🇧🇷 Brasil'
    WHEN region = 'PT' THEN '🇵🇹 Portugal'
    WHEN region = 'BR-NE' THEN '🇧🇷 Nordeste'
    WHEN region = 'BR-S' THEN '🇧🇷 Sul'
    WHEN region = 'BR-RJ' THEN '🇧🇷 Rio'
    WHEN region = 'BR-SP' THEN '🇧🇷 São Paulo'
    ELSE region
  END as region_label
FROM learned_phrases
ORDER BY formality_level, confirm_count DESC;

-- ============================================================================
-- CONSULTAS ÚTEIS
-- ============================================================================

-- Comandos por tipo de linguagem
SELECT * FROM v_commands_by_language_type;

-- Top 10 gírias mais usadas
SELECT phrase, canonical_phrase, confirm_count, region
FROM learned_phrases
WHERE language_type = 'giria'
ORDER BY confirm_count DESC
LIMIT 10;

-- Comandos técnicos de treinador
SELECT phrase, canonical_phrase, formality_level
FROM learned_phrases
WHERE context = 'treinador'
ORDER BY formality_level DESC, confirm_count DESC;

-- Comparação BR vs PT
SELECT
  region,
  language_type,
  COUNT(*) as count
FROM learned_phrases
WHERE region IN ('BR', 'PT')
GROUP BY region, language_type
ORDER BY region, count DESC;

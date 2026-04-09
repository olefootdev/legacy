/**
 * Referência única para integrações externas / cópia para prompts e backends.
 * Mantém alinhado com `playerFromPrompt.ts`, `PlayerEntity` e `MERGE_PLAYERS`.
 */

/** Ordem do wizard no Admin (CREATE PLAYER). */
export const CREATE_PLAYER_WIZARD_STEPS = [
  '1. Nome',
  '2. Posição',
  '3. País',
  '4. Tipo, raridade e pé bom',
  '5. Foto',
  '6. Prompt (atributos, estilo de jogo, quem sou eu) — GameSpirit / Gemini',
  '7. Preview',
  '8. Salvar no plantel (MERGE_PLAYERS)',
  '9. Lançar no Mercado (preço BRO + listedOnMarket)',
] as const;

/** Posições aceites no jogo (código curto). */
export const CREATE_PLAYER_POSITION_CODES = [
  'GOL',
  'ZAG',
  'LE',
  'LD',
  'VOL',
  'MC',
  'PE',
  'PD',
  'ATA',
] as const;

export const CREATE_PLAYER_STRONG_FOOT = ['right', 'left', 'both'] as const;

/** Tipo de jogador (passo 4) — `PlayerEntity.creatorType` */
export const CREATE_PLAYER_CREATOR_TYPES = [
  'novo_talento',
  'campeao',
  'amador',
  'olefoot',
  'lenda',
] as const;

/** Raridade (passo 4) — `PlayerEntity.rarity` */
export const CREATE_PLAYER_RARITIES = [
  'normal',
  'premium',
  'bronze',
  'prata',
  'ouro',
  'raro',
  'ultra_raro',
  'epico',
] as const;

export const CREATE_PLAYER_ARCHETYPES = [
  'profissional',
  'novo_talento',
  'lenda',
  'meme',
  'ai_plus',
] as const;

export const CREATE_PLAYER_BEHAVIORS = ['equilibrado', 'ofensivo', 'defensivo', 'criativo'] as const;

export const CREATE_PLAYER_ATTR_KEYS = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
] as const;

/**
 * Campos em `PlayerEntity` tocados pelo fluxo CREATE PLAYER (além do núcleo sempre presente).
 */
export const CREATE_PLAYER_ENTITY_OPTIONAL_FIELDS = [
  'portraitUrl',
  'marketValueBroCents',
  'country',
  'strongFoot',
  'creatorType',
  'rarity',
  'bio',
  'listedOnMarket',
] as const;

/**
 * JSON que o Gemini devolve (após o passo 6). Não incluir name/pos/country/strongFoot/creatorType/rarity — vêm do wizard.
 * Copiar para documentação ou para testes de contrato.
 */
export const CREATE_PLAYER_GEMINI_RESPONSE_SHAPE = `
{
  "archetype": "profissional | novo_talento | lenda | meme | ai_plus",
  "behavior": "equilibrado | ofensivo | defensivo | criativo",
  "attrs": {
    "passe": 40-99,
    "marcacao": 40-99,
    "velocidade": 40-99,
    "drible": 40-99,
    "finalizacao": 40-99,
    "fisico": 40-99,
    "tatico": 40-99,
    "mentalidade": 40-99,
    "confianca": 40-99,
    "fairPlay": 40-99
  },
  "quemSouEu": "string — texto livre, primeira pessoa ou bio",
  "num": "opcional 1-99",
  "fatigue": "opcional 0-100",
  "injuryRisk": "opcional 0-100",
  "evolutionXp": "opcional >=0",
  "outForMatches": "opcional >=0",
  "spiritNotes": "opcional — notas do modelo"
}
`.trim();

/** Ação Redux/local store para persistir jogador. */
export const CREATE_PLAYER_SAVE_ACTION = `dispatch({ type: 'MERGE_PLAYERS', players: { [playerId]: PlayerEntity } })`;

/** Texto completo para colar noutro repo / spec. */
export const CREATE_PLAYER_INTEGRATION_COPYPASTA = `
OLEFOOT — CREATE PLAYER (integração)

Wizard:
${CREATE_PLAYER_WIZARD_STEPS.map((s) => `- ${s}`).join('\n')}

Contexto enviado ao Gemini (fixo, não no JSON de resposta):
- name, pos, country, creatorType, rarity, strongFoot

Resposta JSON do modelo (apenas estes campos dinâmicos):
${CREATE_PLAYER_GEMINI_RESPONSE_SHAPE}

Campos opcionais em PlayerEntity usados neste fluxo:
${CREATE_PLAYER_ENTITY_OPTIONAL_FIELDS.join(', ')}

Gravação:
- ${CREATE_PLAYER_SAVE_ACTION}
- ID sugerido: p-admin-<timestamp>-<random>
- Passo 8: listedOnMarket: false (ou omitir), marketValueBroCents opcional
- Passo 9: MERGE_PLAYERS no mesmo id com marketValueBroCents + listedOnMarket: true

strongFoot: right | left | both
creatorType: novo_talento | campeao | amador | olefoot | lenda
rarity: normal | premium | bronze | prata | ouro | raro | ultra_raro | epico
`.trim();

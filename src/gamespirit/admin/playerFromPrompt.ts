/**
 * Admin — interpretação de prompt natural em ficha de jogador (OLEFOOT).
 * Nome, posição, país, tipo, raridade e pé bom vêm fixos do wizard; o modelo só devolve atributos,
 * estilo de jogo e “quem sou eu”.
 */

import { createPlayer } from '@/entities/player';
import {
  contractFieldsAdminLifetime,
  contractFieldsForManagerProspectTier,
  type ManagerProspectContractGames,
} from '@/playerContracts/playerContracts';
import type {
  PlayerArchetype,
  PlayerAttributes,
  PlayerBehavior,
  PlayerCreatorType,
  PlayerEntity,
  PlayerRarity,
  PlayerStrongFoot,
} from '@/entities/types';

import { requestAdminPlayerFromPrompt } from '@/gamespirit/admin/gameSpiritTeachClient';

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

const ARCHETYPES: PlayerArchetype[] = ['profissional', 'novo_talento', 'lenda', 'meme', 'ai_plus'];
const BEHAVIORS: PlayerBehavior[] = ['equilibrado', 'ofensivo', 'defensivo', 'criativo'];

const POS_ALIASES: Record<string, string> = {
  GK: 'GOL',
  GOL: 'GOL',
  GOLEIRO: 'GOL',
  CB: 'ZAG',
  ZAG: 'ZAG',
  LB: 'LE',
  LE: 'LE',
  RB: 'LD',
  LD: 'LD',
  CDM: 'VOL',
  VOL: 'VOL',
  CM: 'MC',
  MC: 'MC',
  CAM: 'MC',
  LM: 'PE',
  PE: 'PE',
  RM: 'PD',
  PD: 'PD',
  LW: 'PE',
  RW: 'PD',
  ST: 'ATA',
  CF: 'ATA',
  ATA: 'ATA',
};

/** Dados já fixados no Admin antes do prompt (não vêm do modelo). */
export interface PlayerPromptLockedContext {
  name: string;
  pos: string;
  country?: string;
  strongFoot?: PlayerStrongFoot;
  creatorType?: PlayerCreatorType;
  rarity?: PlayerRarity;
  /** Resumo humano para o modelo (coleção / fornecimento); não vai para o JSON do modelo. */
  collectionSummary?: string;
}

/** Rascunho completo para UI + `buildPlayerEntityFromDraft`. */
export interface GameSpiritPlayerDraft {
  name: string;
  pos: string;
  country?: string;
  strongFoot?: PlayerStrongFoot;
  creatorType?: PlayerCreatorType;
  rarity?: PlayerRarity;
  num?: number;
  /** “Quem sou eu” (texto livre) */
  bio?: string;
  archetype?: string;
  behavior?: string;
  attrs?: Partial<PlayerAttributes>;
  fatigue?: number;
  injuryRisk?: number;
  evolutionXp?: number;
  outForMatches?: number;
  spiritNotes?: string;
}

function normalizePos(raw: string): string {
  const u = raw.trim().toUpperCase().replace(/\s+/g, '');
  return POS_ALIASES[u] ?? u;
}

function normalizeArchetype(raw: string | undefined): PlayerArchetype {
  const t = (raw ?? '').toLowerCase().trim().replace(/\s+/g, '_');
  if (ARCHETYPES.includes(t as PlayerArchetype)) return t as PlayerArchetype;
  return 'novo_talento';
}

function normalizeBehavior(raw: string | undefined): PlayerBehavior {
  const t = (raw ?? '').toLowerCase().trim();
  if (BEHAVIORS.includes(t as PlayerBehavior)) return t as PlayerBehavior;
  return 'equilibrado';
}

function normalizeStrongFoot(raw: string | undefined): PlayerStrongFoot | undefined {
  const t = (raw ?? '').toLowerCase().trim();
  if (t === 'right' || t === 'direito' || t === 'd') return 'right';
  if (t === 'left' || t === 'esquerdo' || t === 'e') return 'left';
  if (t === 'both' || t === 'ambidestro' || t === 'ambos') return 'both';
  return undefined;
}

/** Aceita número ou string numérica vinda do JSON do modelo. */
function toAttrNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.trim().replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Mapeia chaves comuns em PT/EN (modelos variam) → PlayerAttributes. */
const ATTR_ALIASES: Record<string, keyof PlayerAttributes> = {
  passe: 'passe',
  pass: 'passe',
  passing: 'passe',
  marcacao: 'marcacao',
  marking: 'marcacao',
  defesa: 'marcacao',
  defense: 'marcacao',
  velocidade: 'velocidade',
  pace: 'velocidade',
  speed: 'velocidade',
  drible: 'drible',
  dribble: 'drible',
  dribbling: 'drible',
  finalizacao: 'finalizacao',
  finalização: 'finalizacao',
  finishing: 'finalizacao',
  shot: 'finalizacao',
  shooting: 'finalizacao',
  fisico: 'fisico',
  físico: 'fisico',
  physical: 'fisico',
  tatico: 'tatico',
  tático: 'tatico',
  tactical: 'tatico',
  mentalidade: 'mentalidade',
  mentality: 'mentalidade',
  confianca: 'confianca',
  confiança: 'confianca',
  confidence: 'confianca',
  fairplay: 'fairPlay',
  fair_play: 'fairPlay',
  fairPlay: 'fairPlay',
  marcação: 'marcacao',
};

function normalizeAttrsSource(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const a =
    parsed.attrs ??
    parsed.attributes ??
    parsed.atributos ??
    parsed.stats ??
    parsed.ficha;
  if (a && typeof a === 'object' && !Array.isArray(a)) return a as Record<string, unknown>;
  return null;
}

function clampAttrs(partial: Partial<PlayerAttributes> | undefined): Partial<PlayerAttributes> {
  if (!partial || typeof partial !== 'object') return {};
  const keys: (keyof PlayerAttributes)[] = [
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
  ];
  const out: Partial<PlayerAttributes> = {};
  for (const k of keys) {
    const v = toAttrNumber(partial[k]);
    if (v !== undefined) out[k] = clamp(Math.round(v), 40, 99);
  }
  return out;
}

function resolveAttrColumnKey(rawKey: string): keyof PlayerAttributes | undefined {
  const nk = rawKey.trim().toLowerCase().replace(/\s+/g, '_');
  return ATTR_ALIASES[nk] ?? ATTR_ALIASES[rawKey.trim()];
}

/** Extrai attrs do JSON do modelo, incluindo chaves alternativas e strings numéricas. */
function extractAttrsFromParsed(parsed: Record<string, unknown>): Partial<PlayerAttributes> {
  const src = normalizeAttrsSource(parsed);
  const bag: Record<string, unknown> = {};
  const rows = src ?? parsed;
  for (const [rawKey, val] of Object.entries(rows)) {
    if (src == null) {
      const skip = new Set([
        'archetype',
        'behavior',
        'quemSouEu',
        'bio',
        'num',
        'fatigue',
        'injuryRisk',
        'evolutionXp',
        'outForMatches',
        'spiritNotes',
        'name',
        'pos',
        'country',
        'strongFoot',
        'creatorType',
        'rarity',
        'attrs',
        'attributes',
        'atributos',
        'stats',
        'ficha',
      ]);
      if (skip.has(rawKey)) continue;
    }
    const key = resolveAttrColumnKey(rawKey);
    if (key) bag[key] = val;
  }
  return clampAttrs(bag as Partial<PlayerAttributes>);
}

/** Modelos por vezes embrulham o JSON num objeto extra. */
function unwrapModelJson(parsed: Record<string, unknown>): Record<string, unknown> {
  const inner = parsed.player ?? parsed.jogador ?? parsed.result ?? parsed.data ?? parsed.payload;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) return inner as Record<string, unknown>;
  return parsed;
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

export type InterpretPlayerPromptResult =
  | { ok: true; draft: GameSpiritPlayerDraft }
  | { ok: false; error: string };

function mergeLockedWithParsed(
  locked: PlayerPromptLockedContext,
  parsed: Record<string, unknown>,
): GameSpiritPlayerDraft {
  const quem =
    typeof parsed.quemSouEu === 'string'
      ? parsed.quemSouEu.trim()
      : typeof parsed.bio === 'string'
        ? parsed.bio.trim()
        : undefined;

  return {
    name: locked.name.trim(),
    pos: normalizePos(locked.pos),
    country: locked.country?.trim() || undefined,
    strongFoot: locked.strongFoot,
    creatorType: locked.creatorType,
    rarity: locked.rarity,
    num: typeof parsed.num === 'number' ? clamp(Math.round(parsed.num), 1, 99) : undefined,
    bio: quem || undefined,
    archetype: typeof parsed.archetype === 'string' ? parsed.archetype : undefined,
    behavior: typeof parsed.behavior === 'string' ? parsed.behavior : undefined,
    attrs: extractAttrsFromParsed(parsed),
    fatigue: typeof parsed.fatigue === 'number' ? clamp(parsed.fatigue, 0, 100) : undefined,
    injuryRisk: typeof parsed.injuryRisk === 'number' ? clamp(parsed.injuryRisk, 0, 100) : undefined,
    evolutionXp: typeof parsed.evolutionXp === 'number' ? Math.max(0, Math.round(parsed.evolutionXp)) : undefined,
    outForMatches:
      typeof parsed.outForMatches === 'number' ? Math.max(0, Math.round(parsed.outForMatches)) : undefined,
    spiritNotes: typeof parsed.spiritNotes === 'string' ? parsed.spiritNotes.trim() : undefined,
  };
}

/**
 * Converte o JSON devolvido pelo olefoot-server (OpenAI) em `GameSpiritPlayerDraft`.
 */
export function parsePlayerPromptAssistantJson(
  locked: PlayerPromptLockedContext,
  assistantText: string,
): InterpretPlayerPromptResult {
  try {
    const parsed = JSON.parse(stripJsonFence(assistantText)) as Record<string, unknown>;
    const draft = mergeLockedWithParsed(locked, unwrapModelJson(parsed));
    return { ok: true, draft };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'JSON do modelo inválido.',
    };
  }
}

/**
 * Interpreta o prompt (atributos / estilo / quem sou eu) dados o contexto fixo.
 * Usa POST `/api/admin/player-from-prompt` no olefoot-server (OPENAI_API_KEY em `server/.env`).
 */
export async function interpretPlayerPromptGameSpirit(
  userPrompt: string,
  locked: PlayerPromptLockedContext,
): Promise<InterpretPlayerPromptResult> {
  const trimmed = userPrompt.trim();
  if (!trimmed) {
    return { ok: false, error: 'Escreve um prompt com atributos, estilo de jogo e quem sou eu.' };
  }

  if (!locked.name.trim()) {
    return { ok: false, error: 'Nome em falta (passo 1).' };
  }
  if (!locked.pos.trim()) {
    return { ok: false, error: 'Posição em falta (passo 2).' };
  }

  const server = await requestAdminPlayerFromPrompt({
    userPrompt: trimmed,
    locked: {
      name: locked.name.trim(),
      pos: locked.pos.trim(),
      country: locked.country?.trim(),
      strongFoot: locked.strongFoot,
      creatorType: locked.creatorType,
      rarity: locked.rarity,
      collectionSummary: locked.collectionSummary?.trim(),
    },
  });

  if (server.ok === false) {
    const hint =
      server.status === 503
        ? ' Configura OPENAI_API_KEY em server/.env e corre npm run dev:server na raiz do projecto.'
        : '';
    return { ok: false, error: `${server.error}${hint}` };
  }

  return parsePlayerPromptAssistantJson(locked, server.rawAssistant);
}

export { normalizeStrongFoot };

/** Contrato ao gravar jogador pelo Admin (vitalício só para catálogo/admin). */
export type AdminPlayerContractChoice =
  | { lifetime: true }
  | { matches: ManagerProspectContractGames };

export function buildPlayerEntityFromDraft(
  draft: GameSpiritPlayerDraft,
  opts: {
    id: string;
    num: number;
    portraitUrl?: string;
    marketValueBroCents?: number;
    listedOnMarket?: boolean;
    collectionId?: string;
    cardSupply?: number;
    /** Omitir = 70 jogos (amistosos + oficiais). */
    adminContract?: AdminPlayerContractChoice;
  },
): PlayerEntity {
  const ac = opts.adminContract;
  const contract =
    ac && 'lifetime' in ac && (ac as { lifetime?: boolean }).lifetime === true
      ? contractFieldsAdminLifetime()
      : contractFieldsForManagerProspectTier(
          ((ac && 'matches' in ac ? ac.matches : 70) as ManagerProspectContractGames),
        );
  return createPlayer({
    id: opts.id,
    num: opts.num,
    name: draft.name.trim(),
    pos: normalizePos(draft.pos),
    archetype: normalizeArchetype(draft.archetype),
    behavior: normalizeBehavior(draft.behavior),
    attrs: draft.attrs,
    fatigue: draft.fatigue,
    injuryRisk: draft.injuryRisk,
    evolutionXp: draft.evolutionXp,
    outForMatches: draft.outForMatches,
    portraitUrl: opts.portraitUrl,
    marketValueBroCents: opts.marketValueBroCents,
    country: draft.country,
    strongFoot: draft.strongFoot,
    creatorType: draft.creatorType,
    rarity: draft.rarity,
    collectionId: opts.collectionId,
    cardSupply: opts.cardSupply,
    bio: draft.bio,
    listedOnMarket: opts.listedOnMarket,
    ...contract,
  });
}

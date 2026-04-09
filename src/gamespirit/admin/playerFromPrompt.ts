/**
 * Admin — interpretação de prompt natural em ficha de jogador (OLEFOOT).
 * Nome, posição, país, tipo, raridade e pé bom vêm fixos do wizard; o modelo só devolve atributos,
 * estilo de jogo e “quem sou eu”.
 */

import { createPlayer } from '@/entities/player';
import type {
  PlayerArchetype,
  PlayerAttributes,
  PlayerBehavior,
  PlayerCreatorType,
  PlayerEntity,
  PlayerRarity,
  PlayerStrongFoot,
} from '@/entities/types';

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const;

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
  /** Resumo humano para o Gemini (coleção / fornecimento); não vai para o JSON do modelo. */
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
    const v = partial[k];
    if (typeof v === 'number') out[k] = clamp(Math.round(v), 40, 99);
  }
  return out;
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

function getGeminiKey(): string {
  const k =
    typeof process !== 'undefined' && process.env && typeof process.env.GEMINI_API_KEY === 'string'
      ? process.env.GEMINI_API_KEY
      : '';
  return (k || '').trim();
}

/** JSON que o Gemini deve devolver (nome/posição já fixados no cliente). */
const SYSTEM_INSTRUCTION = `És o GameSpirit de OLEFOOT. O administrador JÁ definiu nome, posição, país, tipo de jogador, raridade e pé bom noutro ecrã.
Recebes um prompt sobre atributos, estilo de jogo e personalidade (“quem sou eu”) e devolves APENAS um objeto JSON válido (sem markdown), com esta forma:

{
  "archetype": string opcional — um de: profissional, novo_talento, lenda, meme, ai_plus,
  "behavior": string opcional — um de: equilibrado, ofensivo, defensivo, criativo,
  "attrs": objeto opcional com números 40–99: passe, marcacao, velocidade, drible, finalizacao, fisico, tatico, mentalidade, confianca, fairPlay,
  "quemSouEu": string opcional — texto em primeira pessoa ou biografia curta do jogador,
  "num": number opcional 1–99 só se o prompt mencionar número da camisa,
  "fatigue": number opcional 0–100,
  "injuryRisk": number opcional 0–100,
  "evolutionXp": number opcional ≥0,
  "outForMatches": number opcional ≥0,
  "spiritNotes": string opcional — 1–2 frases em português sobre o que inferiste
}

NÃO incluas "name", "pos", "country", "strongFoot", "creatorType" nem "rarity" no JSON — isso já está fixo. Omite chaves que não consigas inferir.`;

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
    attrs: clampAttrs(parsed.attrs as Partial<PlayerAttributes>),
    fatigue: typeof parsed.fatigue === 'number' ? clamp(parsed.fatigue, 0, 100) : undefined,
    injuryRisk: typeof parsed.injuryRisk === 'number' ? clamp(parsed.injuryRisk, 0, 100) : undefined,
    evolutionXp: typeof parsed.evolutionXp === 'number' ? Math.max(0, Math.round(parsed.evolutionXp)) : undefined,
    outForMatches:
      typeof parsed.outForMatches === 'number' ? Math.max(0, Math.round(parsed.outForMatches)) : undefined,
    spiritNotes: typeof parsed.spiritNotes === 'string' ? parsed.spiritNotes.trim() : undefined,
  };
}

/**
 * Interpreta o prompt (atributos / estilo / quem sou eu) dados o contexto fixo.
 */
export async function interpretPlayerPromptGameSpirit(
  userPrompt: string,
  locked: PlayerPromptLockedContext,
): Promise<InterpretPlayerPromptResult> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        'GEMINI_API_KEY não configurada. Adiciona a chave ao ficheiro .env na raiz do projecto (variável GEMINI_API_KEY) e reinicia o servidor Vite.',
    };
  }

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

  const colLine = locked.collectionSummary?.trim()
    ? `- Coleção / fornecimento: ${locked.collectionSummary.trim()}\n`
    : '';
  const ctxBlock = `Dados já fixados pelo admin (não alteres):\n- Nome: ${locked.name.trim()}\n- Posição: ${normalizePos(locked.pos)}\n- País: ${locked.country?.trim() || '—'}\n- Tipo de jogador: ${locked.creatorType ?? '—'}\n- Raridade: ${locked.rarity ?? '—'}\n- Pé bom: ${locked.strongFoot ?? '—'}\n${colLine}`;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    let lastErr: string | undefined;
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: `${ctxBlock}\nPrompt do administrador (atributos, estilo, quem sou eu):\n---\n${trimmed}\n---\nResponde só com o JSON definido nas instruções.`,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.35,
          },
        });
        const text = response.text;
        if (!text) {
          lastErr = 'Resposta vazia do modelo.';
          continue;
        }
        const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
        const draft = mergeLockedWithParsed(locked, parsed);
        return { ok: true, draft };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return { ok: false, error: lastErr ?? 'Falha ao contactar o modelo.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export { normalizeStrongFoot };

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
  },
): PlayerEntity {
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
  });
}

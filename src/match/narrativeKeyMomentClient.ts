/**
 * Narração de momentos-chave (gols e cartões vermelhos).
 *
 * Migrado de OpenAI live (custo linear com usuários) pra catálogo offline
 * (custo zero em runtime). O catálogo é hidratado do Supabase ao montar a
 * partida; se o fetch falhar, `narrativeCatalogFallback` cobre.
 */

import {
  hydrateNarrativeCatalog,
  pickNarrative,
  type NarrativeCategory,
  type NarrativeContext,
} from '@/gamespirit/narrativeCatalog';

export type NarrativeMomentKind = 'goal_home' | 'goal_away' | 'red_home' | 'red_away';

export interface NarrativeMomentRequest {
  kind: NarrativeMomentKind;
  player?: string;
  minute: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  buildUp?: 'positional' | 'counter';
  recentLines?: string[]; // mantido pra compat, não usado mais
}

function kindToCategory(kind: NarrativeMomentKind): {
  category: NarrativeCategory;
  ctx: NarrativeContext;
} {
  if (kind === 'goal_home' || kind === 'goal_away') {
    return { category: 'goal', ctx: { intensity: 'normal' } };
  }
  return { category: 'foul_red', ctx: { intensity: 'dangerous' } };
}

/** Hidrata o catálogo na montagem da partida. Call once. */
export async function prepareKeyMomentNarration(): Promise<void> {
  await hydrateNarrativeCatalog();
}

/**
 * Retorna narração síncrona — zero I/O após hidratação inicial.
 * Compat com o fetch anterior: mantém assinatura Promise pra não mexer em callers.
 */
export async function fetchKeyMomentNarration(req: NarrativeMomentRequest): Promise<string | null> {
  try {
    const { category, ctx } = kindToCategory(req.kind);
    const vars: Record<string, string | number> = {
      minute: req.minute,
      player: req.player ?? (req.kind.startsWith('goal_home') ? req.homeTeam : req.awayTeam),
      opponent: req.kind.endsWith('home') ? req.awayTeam : req.homeTeam,
      home: req.homeTeam,
      away: req.awayTeam,
      score: `${req.homeScore}×${req.awayScore}`,
    };
    const seed = req.minute * 31 + (req.kind === 'goal_home' ? 1 : req.kind === 'goal_away' ? 2 : req.kind === 'red_home' ? 3 : 4);
    return pickNarrative(category, { ...ctx, vars }, seed);
  } catch {
    return null;
  }
}

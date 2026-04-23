/**
 * Runtime do catálogo narrativo.
 *
 * Fluxo:
 *   1. `hydrateNarrativeCatalog()` na montagem da partida — 1 fetch Supabase
 *      (fallback in-memory se offline).
 *   2. `pickNarrative(category, context, seed)` a cada beat — zero I/O.
 *      Determinístico via seed pra suportar lockstep multiplayer futuro.
 *   3. Variáveis do template são preenchidas via token replacement:
 *      "{player} chuta" + { player: 'Adrien' } → "Adrien chuta".
 */

import { getSupabase } from '@/supabase/client';
import { FALLBACK_CATALOG } from './narrativeCatalogFallback';

// ─── Tipos ────────────────────────────────────────────────────────────────

export type NarrativeCategory =
  | 'goal' | 'shot_saved' | 'shot_missed'
  | 'foul_yellow' | 'foul_red'
  | 'substitution' | 'momentum_shift' | 'pressure_moment'
  | 'half_time' | 'full_time';

export type NarrativeIntensity = string; // live com string livre pra evolução

export type PersonaVibe = 'analytical' | 'visceral' | 'poetic' | 'casual';

export interface NarrativeTemplate {
  id: string;
  category: NarrativeCategory;
  intensity: NarrativeIntensity;
  context_tags: string[];
  template: string;
  variables: Record<string, string[]>;
  persona_vibe: PersonaVibe;
}

export interface NarrativeContext {
  intensity?: NarrativeIntensity;
  contextTags?: string[];
  preferredVibe?: PersonaVibe;
  /** Variáveis pra preencher o template — {player}, {minute}, etc. */
  vars?: Record<string, string | number>;
}

// ─── Estado ───────────────────────────────────────────────────────────────

let catalog: NarrativeTemplate[] = FALLBACK_CATALOG;
let hydrated = false;

// ─── Hidratação ───────────────────────────────────────────────────────────

/**
 * Carrega o catálogo do Supabase. Chama uma vez por partida (ao montar).
 * Se o fetch falhar, mantém o FALLBACK_CATALOG.
 */
export async function hydrateNarrativeCatalog(force = false): Promise<void> {
  if (hydrated && !force) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_narrative_templates', {
      p_category: null,
      p_limit: 2000,
    });
    if (error || !Array.isArray(data) || data.length === 0) {
      console.warn('[narrativeCatalog] usando fallback:', error?.message ?? 'catálogo vazio');
      return;
    }
    catalog = data as NarrativeTemplate[];
    hydrated = true;
    console.log(`[narrativeCatalog] hidratado com ${catalog.length} templates`);
  } catch (err) {
    console.warn('[narrativeCatalog] fetch falhou, fallback:', err);
  }
}

export function getCatalogSize(): number {
  return catalog.length;
}

// ─── Seleção determinística ───────────────────────────────────────────────

/**
 * Escolhe um template para a categoria + contexto.
 * `seed` garante que clientes diferentes escolham o MESMO template pra o
 * mesmo evento (crítico pra lockstep multiplayer futuro).
 */
export function pickNarrative(
  category: NarrativeCategory,
  ctx: NarrativeContext = {},
  seed: number = Date.now(),
): string {
  const candidates = candidatesFor(category, ctx);
  if (candidates.length === 0) {
    // último recurso — retorna categoria como texto bruto.
    return `${category}`;
  }
  const picked = pickDeterministic(candidates, seed);
  return fillTemplate(picked.template, picked.variables, ctx.vars ?? {}, seed);
}

function candidatesFor(
  category: NarrativeCategory,
  ctx: NarrativeContext,
): NarrativeTemplate[] {
  let pool = catalog.filter((t) => t.category === category);

  if (ctx.intensity) {
    const byIntensity = pool.filter((t) => t.intensity === ctx.intensity);
    if (byIntensity.length > 0) pool = byIntensity;
  }
  if (ctx.preferredVibe) {
    const byVibe = pool.filter((t) => t.persona_vibe === ctx.preferredVibe);
    if (byVibe.length > 0) pool = byVibe;
  }
  if (ctx.contextTags && ctx.contextTags.length > 0) {
    const tagSet = new Set(ctx.contextTags);
    const scored = pool.map((t) => ({
      t,
      score: t.context_tags.filter((ct) => tagSet.has(ct)).length,
    }));
    const maxScore = Math.max(0, ...scored.map((s) => s.score));
    if (maxScore > 0) {
      pool = scored.filter((s) => s.score === maxScore).map((s) => s.t);
    }
  }
  return pool;
}

function pickDeterministic<T>(arr: T[], seed: number): T {
  if (arr.length === 1) return arr[0]!;
  // hash simples — não precisa ser criptográfico, só estável.
  let h = seed >>> 0;
  h = (h ^ 0x9e3779b9) * 2654435769;
  h = (h >>> 0) ^ (h >>> 16);
  const idx = (h >>> 0) % arr.length;
  return arr[idx]!;
}

function fillTemplate(
  template: string,
  templateVars: Record<string, string[]>,
  contextVars: Record<string, string | number>,
  seed: number,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    // 1. Variável do contexto (motor) tem prioridade — nomes, minuto, etc.
    if (key in contextVars) return String(contextVars[key]);
    // 2. Variável do template (alternativas criadas pelo LLM).
    const alts = templateVars[key];
    if (alts && alts.length > 0) {
      return pickDeterministic(alts, seed + key.length);
    }
    // 3. Desconhecida — deixa placeholder visível pra debug.
    return match;
  });
}

// ─── Feedback opcional (thumbs up/down) ───────────────────────────────────

export async function rateNarrativeTemplate(id: string, positive: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc('rate_narrative_template', { p_id: id, p_positive: positive });
}

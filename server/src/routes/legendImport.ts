import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';

/**
 * Olefoot Legend Creator — endpoint de importação
 *
 * Recebe o payload `legend.json` gerado pela skill `olefoot-legend-creator`
 * e cria 3 rows em `legacy_players` (uma por fase: revelacao/consolidacao/expansao).
 *
 * Auth: header `X-Admin-Token` (mesmo padrão dos outros endpoints admin).
 * Idempotente: rows usam id determinístico `legacy-<slug>-<phase>`, então
 * re-importar atualiza em vez de duplicar.
 *
 * POST /api/admin/legend-import
 * Body: { slug, payload: <legend.json> }
 * Response: { ok: true, ids: [string,string,string] } | { error }
 */

type Phase = 'revelacao' | 'consolidacao' | 'expansao';

const VALID_PHASES: readonly Phase[] = ['revelacao', 'consolidacao', 'expansao'];

const PHASE_LABEL: Record<Phase, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

interface LegendPhasePayload {
  phase: Phase;
  title?: string;
  yearStart?: number;
  yearEnd?: number;
  mainClub?: string;
  narrativeTitle?: string;
  narrative?: string;
  entity: {
    name: string;
    num?: number;
    pos: string;
    archetype?: string;
    zone?: string;
    behavior?: string;
    country?: string;
    strongFoot?: string;
    creatorType?: string;
    age?: number;
    bio?: string;
    attrs: Record<string, number>;
    mintOverall?: number;
    evolutionRate?: number;
    rarity?: string;
    cardSupply?: number;
    isLegacy?: boolean;
    legacyTaughtAttributes?: string[];
    legacyTeamBooster?: Record<string, number>;
    agentProfileEnabled?: boolean;
    agentProfile?: unknown;
    marketValueBroCents?: number;
  };
}

interface LegendImportPayload {
  playerName?: string;
  shortName?: string;
  collectionId: string;
  collectionKind?: string;
  sources?: string[];
  inconsistencies?: string[];
  phases: LegendPhasePayload[];
}

const ATTR_KEYS = [
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

function validateAttrs(a: unknown): Record<string, number> | null {
  if (!a || typeof a !== 'object') return null;
  const out: Record<string, number> = {};
  for (const k of ATTR_KEYS) {
    const v = (a as Record<string, unknown>)[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 99) return null;
    out[k] = Math.round(v);
  }
  return out;
}

function normalizeStrongFoot(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === 'direito' || s === 'right') return 'right';
  if (s === 'esquerdo' || s === 'left') return 'left';
  if (s === 'ambidestro' || s === 'both' || s === 'ambos') return 'both';
  return null;
}

function validatePayload(raw: unknown): { ok: true; payload: LegendImportPayload } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'payload must be object' };
  const p = raw as LegendImportPayload;

  if (typeof p.collectionId !== 'string' || !p.collectionId.trim()) {
    return { ok: false, reason: 'collectionId required' };
  }
  if (!Array.isArray(p.phases) || p.phases.length === 0) {
    return { ok: false, reason: 'phases[] required' };
  }
  if (p.phases.length > 5) {
    return { ok: false, reason: 'too many phases (max 5)' };
  }

  const seenPhases = new Set<string>();
  for (const [i, ph] of p.phases.entries()) {
    if (!ph || typeof ph !== 'object') {
      return { ok: false, reason: `phases[${i}] must be object` };
    }
    if (!VALID_PHASES.includes(ph.phase)) {
      return { ok: false, reason: `phases[${i}].phase invalid (got ${ph.phase})` };
    }
    if (seenPhases.has(ph.phase)) {
      return { ok: false, reason: `duplicate phase ${ph.phase}` };
    }
    seenPhases.add(ph.phase);
    if (!ph.entity || typeof ph.entity !== 'object') {
      return { ok: false, reason: `phases[${i}].entity required` };
    }
    if (typeof ph.entity.name !== 'string' || !ph.entity.name.trim()) {
      return { ok: false, reason: `phases[${i}].entity.name required` };
    }
    if (typeof ph.entity.pos !== 'string' || !ph.entity.pos.trim()) {
      return { ok: false, reason: `phases[${i}].entity.pos required` };
    }
    if (!validateAttrs(ph.entity.attrs)) {
      return { ok: false, reason: `phases[${i}].entity.attrs invalid (must have all 10 keys, 0-99)` };
    }
  }

  return { ok: true, payload: p };
}

function buildLegacyRow(slug: string, payload: LegendImportPayload, phase: LegendPhasePayload) {
  const e = phase.entity;
  const phaseLabel = PHASE_LABEL[phase.phase];
  const displayName = `${e.name.trim()} — ${phaseLabel}`;
  const attrs = validateAttrs(e.attrs)!;

  return {
    id: `legacy-${slug}-${phase.phase}`,
    name: displayName,
    pos: e.pos.trim().toUpperCase(),
    pos_original: e.pos.trim().toUpperCase(),
    attributes: attrs,
    taught_attributes: Array.isArray(e.legacyTaughtAttributes) ? e.legacyTaughtAttributes : [],
    team_booster: e.legacyTeamBooster ?? {},
    price_bro_cents: Number.isFinite(e.marketValueBroCents) ? Math.round(e.marketValueBroCents!) : 0,
    listed_on_market: false,
    country: e.country?.trim() || null,
    age: Number.isFinite(e.age) ? Math.round(e.age!) : null,
    strong_foot: normalizeStrongFoot(e.strongFoot),
    creator_label: e.creatorType?.trim() || 'lenda',
    rarity_label: e.rarity?.trim() || 'ultra_raro',
    bio: e.bio?.trim() || null,
    card_supply: Number.isFinite(e.cardSupply) ? Math.round(e.cardSupply!) : 1,
    evolution_rate: Number.isFinite(e.evolutionRate) ? e.evolutionRate : 1,
    agent_profile: e.agentProfile ?? null,
    agent_profile_enabled: e.agentProfileEnabled !== false,
    collection_id: payload.collectionId.trim(),
    phase: phase.phase,
    mint_overall: Number.isFinite(e.mintOverall) ? Math.round(e.mintOverall!) : null,
    narrative_title: phase.narrativeTitle?.trim() || null,
    year_start: Number.isFinite(phase.yearStart) ? Math.round(phase.yearStart!) : null,
    year_end: Number.isFinite(phase.yearEnd) ? Math.round(phase.yearEnd!) : null,
    main_club: phase.mainClub?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export const legendImportRoutes = new Hono();

legendImportRoutes.post('/legend-import', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin not configured' }, 503);

  let body: { slug?: string; payload?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const slug = body.slug?.trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return c.json({ error: 'slug required (kebab-case)' }, 400);
  }

  const validation = validatePayload(body.payload);
  if (!validation.ok) {
    return c.json({ error: `payload invalid: ${validation.reason}` }, 400);
  }

  const rows = validation.payload.phases.map((ph) => buildLegacyRow(slug, validation.payload, ph));

  const { data, error } = await sb
    .from('legacy_players')
    .upsert(rows, { onConflict: 'id' })
    .select('id, name, phase, collection_id, mint_overall, price_bro_cents');

  if (error) {
    console.error('[legend-import] upsert error:', error.message);
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    ok: true,
    slug,
    collectionId: validation.payload.collectionId,
    inserted: data ?? [],
  });
});

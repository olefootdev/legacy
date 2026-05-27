import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';

/**
 * Olefoot Legend Creator — endpoint de importação (Panini-tier)
 *
 * Pipeline real: skill → CLI → POST → legacy_players + legacy_player_lots
 *
 * Por fase, o admin define:
 *   - tier 1/2/3 (default supply + preço Panini)
 *   - collection_code (sigla, ex: BR-95), collection_title (ex: Campeão Brasileiro 1995)
 *   - currency (USDT | OLEFOOT), price_unit_cents, initial_supply (override de tier)
 *   - payment_split (kinds: player|olefoot|community|facilitator, soma 100)
 *   - beneficiary_user_id (atleta real, vinculado a auth.users)
 *
 * Cria 1 row em legacy_players + 1 lote inicial em legacy_player_lots por fase.
 *
 * Auth: header X-Admin-Token. Idempotente via id determinístico legacy-<slug>-<phase>.
 *
 * POST /api/admin/legend-import
 */

type Phase = 'revelacao' | 'consolidacao' | 'expansao';
type Currency = 'USDT' | 'OLEFOOT';
type Tier = 1 | 2 | 3;

const VALID_PHASES: readonly Phase[] = ['revelacao', 'consolidacao', 'expansao'];
const PHASE_LABEL: Record<Phase, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

/** Defaults Panini-tier por tier (admin pode override). */
const TIER_DEFAULTS: Record<Tier, { supply: number; priceUsdtCents: number; priceOleUnits: number; phase: Phase }> = {
  1: { supply: 10_000, priceUsdtCents: 100, priceOleUnits: 100_000, phase: 'revelacao' },     // $1 / 100k OLE
  2: { supply: 5_000, priceUsdtCents: 200, priceOleUnits: 250_000, phase: 'consolidacao' },   // $2 / 250k OLE
  3: { supply: 2_500, priceUsdtCents: 500, priceOleUnits: 1_000_000, phase: 'expansao' },     // $5 / 1M OLE
};

interface SplitEntry {
  kind: 'player' | 'olefoot' | 'community' | 'facilitator';
  user_id: string | null;
  label?: string;
  percent: number;
}

interface LegendPhasePayload {
  phase: Phase;
  yearStart?: number;
  yearEnd?: number;
  mainClub?: string;
  narrativeTitle?: string;
  narrative?: string;
  /** Tier 1/2/3 — determina supply/price default. */
  tier?: Tier;
  /** Sigla curta (ex: BR-95). Cross-lenda. */
  collectionCode?: string;
  /** Título legível (ex: Campeão Brasileiro 1995). */
  collectionTitle?: string;
  /** Override do tier default. */
  currency?: Currency;
  priceUnitCents?: number;
  initialSupply?: number;
  /** Split de pagamento desta fase (kinds: player|olefoot|community|facilitator). */
  paymentSplit?: SplitEntry[];
  /** Atleta real (uuid de auth.users). */
  beneficiaryUserId?: string;
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
    /** Mini-texto de apoio (até 200 chars). Subtítulo emocional do card. */
    tagline?: string;
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
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
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

function inferTierFromPhase(phase: Phase): Tier {
  if (phase === 'revelacao') return 1;
  if (phase === 'consolidacao') return 2;
  return 3;
}

function validateSplit(split: unknown): { ok: true; entries: SplitEntry[] } | { ok: false; reason: string } {
  if (split === undefined || split === null) return { ok: true, entries: [] };
  if (!Array.isArray(split)) return { ok: false, reason: 'paymentSplit must be array' };
  let sum = 0;
  let facilitatorCount = 0;
  const entries: SplitEntry[] = [];
  for (const [i, raw] of split.entries()) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: `paymentSplit[${i}] must be object` };
    const e = raw as Record<string, unknown>;
    const kind = typeof e.kind === 'string' ? e.kind : '';
    if (!['player', 'olefoot', 'community', 'facilitator'].includes(kind)) {
      return { ok: false, reason: `paymentSplit[${i}].kind invalid: ${kind}` };
    }
    const pct = typeof e.percent === 'number' ? e.percent : Number(e.percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { ok: false, reason: `paymentSplit[${i}].percent invalid` };
    }
    if (kind === 'facilitator') facilitatorCount++;
    sum += pct;
    entries.push({
      kind: kind as SplitEntry['kind'],
      user_id: typeof e.user_id === 'string' ? e.user_id : null,
      label: typeof e.label === 'string' ? e.label : undefined,
      percent: pct,
    });
  }
  if (facilitatorCount > 5) return { ok: false, reason: `max 5 facilitators (got ${facilitatorCount})` };
  if (Math.abs(sum - 100) > 0.01) return { ok: false, reason: `percent sum must be 100 (got ${sum})` };
  return { ok: true, entries };
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
  if (p.phases.length > 5) return { ok: false, reason: 'too many phases (max 5)' };

  const seen = new Set<string>();
  for (const [i, ph] of p.phases.entries()) {
    if (!ph || typeof ph !== 'object') return { ok: false, reason: `phases[${i}] must be object` };
    if (!VALID_PHASES.includes(ph.phase)) return { ok: false, reason: `phases[${i}].phase invalid` };
    if (seen.has(ph.phase)) return { ok: false, reason: `duplicate phase ${ph.phase}` };
    seen.add(ph.phase);
    if (!ph.entity || typeof ph.entity !== 'object') return { ok: false, reason: `phases[${i}].entity required` };
    if (typeof ph.entity.name !== 'string' || !ph.entity.name.trim()) {
      return { ok: false, reason: `phases[${i}].entity.name required` };
    }
    if (typeof ph.entity.pos !== 'string' || !ph.entity.pos.trim()) {
      return { ok: false, reason: `phases[${i}].entity.pos required` };
    }
    if (!validateAttrs(ph.entity.attrs)) {
      return { ok: false, reason: `phases[${i}].entity.attrs invalid (need 10 keys, 0-99)` };
    }
    if (ph.currency && !['USDT', 'OLEFOOT'].includes(ph.currency)) {
      return { ok: false, reason: `phases[${i}].currency must be USDT|OLEFOOT` };
    }
    if (ph.tier !== undefined && ![1, 2, 3].includes(ph.tier)) {
      return { ok: false, reason: `phases[${i}].tier must be 1|2|3` };
    }
    const sv = validateSplit(ph.paymentSplit);
    if (!sv.ok) return { ok: false, reason: `phases[${i}].${sv.reason}` };
  }
  return { ok: true, payload: p };
}

interface ResolvedPricing {
  tier: Tier;
  currency: Currency;
  priceUnitCents: number;
  initialSupply: number;
}

function resolvePricing(ph: LegendPhasePayload): ResolvedPricing {
  const tier: Tier = ph.tier ?? inferTierFromPhase(ph.phase);
  const currency: Currency = ph.currency ?? 'OLEFOOT';
  const defaults = TIER_DEFAULTS[tier];
  const priceUnitCents = Number.isFinite(ph.priceUnitCents)
    ? Math.max(1, Math.round(ph.priceUnitCents!))
    : currency === 'USDT' ? defaults.priceUsdtCents : defaults.priceOleUnits;
  const initialSupply = Number.isFinite(ph.initialSupply)
    ? Math.max(1, Math.round(ph.initialSupply!))
    : defaults.supply;
  return { tier, currency, priceUnitCents, initialSupply };
}

function buildLegacyRow(slug: string, payload: LegendImportPayload, ph: LegendPhasePayload, pricing: ResolvedPricing, split: SplitEntry[]) {
  const e = ph.entity;
  const displayName = `${e.name.trim()} — ${PHASE_LABEL[ph.phase]}`;
  const attrs = validateAttrs(e.attrs)!;

  return {
    id: `legacy-${slug}-${ph.phase}`,
    name: displayName,
    pos: e.pos.trim().toUpperCase(),
    pos_original: e.pos.trim().toUpperCase(),
    attributes: attrs,
    taught_attributes: Array.isArray(e.legacyTaughtAttributes) ? e.legacyTaughtAttributes : [],
    team_booster: e.legacyTeamBooster ?? {},
    // price_bro_cents mantido por backwards-compat (frontend antigo lê dele); espelha price_unit_cents quando OLEFOOT.
    price_bro_cents: pricing.currency === 'OLEFOOT' ? pricing.priceUnitCents : 0,
    price_unit_cents: pricing.priceUnitCents,
    currency: pricing.currency,
    collection_code: ph.collectionCode?.trim() || null,
    collection_title: ph.collectionTitle?.trim() || null,
    tier: pricing.tier,
    listed_on_market: false,
    country: e.country?.trim() || null,
    age: Number.isFinite(e.age) ? Math.round(e.age!) : null,
    strong_foot: normalizeStrongFoot(e.strongFoot),
    creator_label: e.creatorType?.trim() || 'lenda',
    rarity_label: e.rarity?.trim() || 'ultra_raro',
    bio: e.bio?.trim() || null,
    tagline: e.tagline?.trim()?.slice(0, 200) || null,
    card_supply: pricing.initialSupply,
    evolution_rate: Number.isFinite(e.evolutionRate) ? e.evolutionRate : 1,
    agent_profile: e.agentProfile ?? null,
    agent_profile_enabled: e.agentProfileEnabled !== false,
    collection_id: payload.collectionId.trim(),
    phase: ph.phase,
    mint_overall: Number.isFinite(e.mintOverall) ? Math.round(e.mintOverall!) : null,
    narrative_title: ph.narrativeTitle?.trim() || null,
    year_start: Number.isFinite(ph.yearStart) ? Math.round(ph.yearStart!) : null,
    year_end: Number.isFinite(ph.yearEnd) ? Math.round(ph.yearEnd!) : null,
    main_club: ph.mainClub?.trim() || null,
    payment_split: split.length > 0 ? split : null,
    beneficiary_user_id: ph.beneficiaryUserId ?? null,
    updated_at: new Date().toISOString(),
  };
}

function buildInitialLot(playerId: string, pricing: ResolvedPricing) {
  return {
    legacy_player_id: playerId,
    lot_number: 1,
    supply: pricing.initialSupply,
    sold: 0,
    price_unit_cents: pricing.priceUnitCents,
    currency: pricing.currency,
    status: 'open' as const,
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

  const cards: Record<string, unknown>[] = [];
  const lots: Record<string, unknown>[] = [];
  for (const ph of validation.payload.phases) {
    const pricing = resolvePricing(ph);
    const sv = validateSplit(ph.paymentSplit);
    const splitEntries = sv.ok ? sv.entries : [];
    const row = buildLegacyRow(slug, validation.payload, ph, pricing, splitEntries);
    cards.push(row);
    lots.push(buildInitialLot(row.id, pricing));
  }

  // 1. Upsert cards
  const { data: insertedCards, error: cardErr } = await sb
    .from('legacy_players')
    .upsert(cards, { onConflict: 'id' })
    .select('id, name, phase, collection_id, collection_code, tier, mint_overall, currency, price_unit_cents, card_supply');

  if (cardErr) {
    console.error('[legend-import] cards upsert error:', cardErr.message);
    return c.json({ error: cardErr.message }, 500);
  }

  // 2. Inserir lotes iniciais (só se ainda não existir lote 1 — preserva histórico)
  const lotIds: Array<{ legacy_player_id: string; lot_number: number; lot_id: string | null }> = [];
  for (const lot of lots) {
    const { data: existing } = await sb
      .from('legacy_player_lots')
      .select('lot_id')
      .eq('legacy_player_id', lot.legacy_player_id as string)
      .eq('lot_number', 1)
      .maybeSingle();

    if (existing) {
      // Lote 1 já existe — atualiza supply/preço se card foi reconfigurado
      const { error: updErr } = await sb
        .from('legacy_player_lots')
        .update({
          supply: lot.supply,
          price_unit_cents: lot.price_unit_cents,
          currency: lot.currency,
        })
        .eq('lot_id', existing.lot_id);
      if (updErr) {
        console.warn('[legend-import] lot update warning:', updErr.message);
      }
      lotIds.push({ legacy_player_id: lot.legacy_player_id as string, lot_number: 1, lot_id: existing.lot_id });
    } else {
      const { data: created, error: lotErr } = await sb
        .from('legacy_player_lots')
        .insert(lot)
        .select('lot_id, legacy_player_id, lot_number')
        .single();
      if (lotErr) {
        console.error('[legend-import] lot insert error:', lotErr.message);
        return c.json({ error: `lot insert failed: ${lotErr.message}` }, 500);
      }
      lotIds.push({ legacy_player_id: created.legacy_player_id, lot_number: 1, lot_id: created.lot_id });
    }
  }

  return c.json({
    ok: true,
    slug,
    collectionId: validation.payload.collectionId,
    inserted: insertedCards ?? [],
    lots: lotIds,
  });
});

/**
 * POST /api/admin/legend-portrait
 * Upload da imagem do card de uma fase. Salva no bucket `legacy-player-portraits`
 * e atualiza `legacy_players.portrait_storage_path` + `portrait_public_url`.
 *
 * Body (multipart/form-data):
 *   - legacyPlayerId: string (id da row, ex: legacy-marcelo-goncalves-revelacao)
 *   - file: image file (jpeg/png/webp/gif, max 5MB)
 *
 * Response: { ok: true, url: string, path: string }
 */
legendImportRoutes.post('/legend-portrait', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin not configured' }, 503);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'multipart/form-data required' }, 400);
  }

  const legacyPlayerId = form.get('legacyPlayerId');
  const file = form.get('file');
  if (typeof legacyPlayerId !== 'string' || !legacyPlayerId.trim()) {
    return c.json({ error: 'legacyPlayerId required' }, 400);
  }
  if (!(file instanceof File)) {
    return c.json({ error: 'file required' }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'file too large (max 5MB)' }, 400);
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: `unsupported mime type: ${file.type}` }, 400);
  }

  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif'
    : 'jpg';
  // Filename determinístico por jogador — re-upload sobrescreve. Cache-bust via updated_at.
  const path = `${legacyPlayerId}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await sb.storage
    .from('legacy-player-portraits')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: 'public, max-age=3600',
    });

  if (uploadErr) {
    console.error('[legend-portrait] upload error:', uploadErr.message);
    return c.json({ error: uploadErr.message }, 500);
  }

  const { data: pubData } = sb.storage
    .from('legacy-player-portraits')
    .getPublicUrl(path);
  const publicUrl = pubData?.publicUrl ?? null;

  // Atualiza a row (cleanup outras extensões se existirem)
  const { error: updateErr } = await sb
    .from('legacy_players')
    .update({
      portrait_storage_path: path,
      portrait_public_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', legacyPlayerId);

  if (updateErr) {
    console.error('[legend-portrait] update row error:', updateErr.message);
    return c.json({ error: updateErr.message }, 500);
  }

  // Limpa extensões "concorrentes" (admin trocou de png pra jpg etc)
  const otherExts = ['png', 'jpg', 'webp', 'gif'].filter((e) => e !== ext);
  for (const e of otherExts) {
    await sb.storage.from('legacy-player-portraits').remove([`${legacyPlayerId}.${e}`]).catch(() => undefined);
  }

  return c.json({ ok: true, url: publicUrl, path });
});

/**
 * POST /api/admin/legacy-player-set-portrait
 * Persiste a URL pública do portrait (já hospedado em Pinata/IPFS via /api/media/pinata/upload)
 * no row de legacy_players. Substitui o upload via Supabase Storage do endpoint
 * /api/admin/legend-portrait, alinhando com o fluxo já validado em AdminGenesisPortraitsPanel.
 *
 * Body JSON: { legacyPlayerId: string, publicUrl: string, storagePath?: string }
 */
legendImportRoutes.post('/legacy-player-set-portrait', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin not configured' }, 503);

  let body: { legacyPlayerId?: unknown; publicUrl?: unknown; storagePath?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const legacyPlayerId =
    typeof body.legacyPlayerId === 'string' ? body.legacyPlayerId.trim() : '';
  const publicUrl = typeof body.publicUrl === 'string' ? body.publicUrl.trim() : '';
  const storagePath =
    typeof body.storagePath === 'string' ? body.storagePath.trim() : null;

  if (!legacyPlayerId) return c.json({ error: 'legacyPlayerId required' }, 400);
  if (!publicUrl || !/^https?:\/\//i.test(publicUrl)) {
    return c.json({ error: 'publicUrl required (http/https)' }, 400);
  }

  const { error } = await sb
    .from('legacy_players')
    .update({
      portrait_public_url: publicUrl,
      portrait_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', legacyPlayerId);

  if (error) {
    console.error('[legacy-player-set-portrait] update error:', error.message);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ ok: true, legacyPlayerId, publicUrl });
});

/**
 * GET /api/admin/find-user?email=...
 * Busca usuário por e-mail (auth.users) — pra UI do wizard escolher facilitadores/beneficiary.
 * Auth admin obrigatório.
 */
legendImportRoutes.get('/find-user', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin not configured' }, 503);

  const email = c.req.query('email')?.trim();
  if (!email || !email.includes('@')) {
    return c.json({ error: 'email query param required' }, 400);
  }

  // listUsers filtra por email — supabase-js v2.42+ aceita filter.
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) {
    console.error('[find-user] error:', error.message);
    return c.json({ error: error.message }, 500);
  }
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!match) {
    return c.json({ found: false });
  }
  return c.json({
    found: true,
    id: match.id,
    email: match.email,
    created_at: match.created_at,
  });
});

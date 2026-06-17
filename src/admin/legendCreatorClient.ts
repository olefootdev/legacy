/**
 * Cliente HTTP do Olefoot Legend Creator.
 *
 * Endpoints:
 *   POST /api/admin/legend-import  → cria 3 cards + 3 lotes iniciais a partir do legend.json
 *   GET  /api/admin/find-user      → busca user por email pra facilitadores/beneficiary
 */

import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

export type LegendPhase = 'revelacao' | 'consolidacao' | 'expansao';
export type LegendCurrency = 'USDT' | 'OLEFOOT';
export type LegendTier = 1 | 2 | 3;

export interface LegendSplitEntry {
  kind: 'player' | 'olefoot' | 'community' | 'facilitator';
  user_id: string | null;
  label?: string;
  percent: number;
}

export interface LegendPhasePayload {
  phase: LegendPhase;
  yearStart?: number;
  yearEnd?: number;
  mainClub?: string;
  narrativeTitle?: string;
  narrative?: string;
  tier?: LegendTier;
  collectionCode?: string;
  collectionTitle?: string;
  currency?: LegendCurrency;
  priceUnitCents?: number;
  initialSupply?: number;
  paymentSplit?: LegendSplitEntry[];
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
    /** Mini-texto de apoio (até ~150 chars). Subtítulo emocional do card. */
    tagline?: string;
    attrs: {
      passe: number; marcacao: number; velocidade: number; drible: number;
      finalizacao: number; fisico: number; tatico: number; mentalidade: number;
      confianca: number; fairPlay: number;
    };
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

export interface LegendImportPayload {
  playerName?: string;
  shortName?: string;
  collectionId: string;
  collectionKind?: 'memorable' | 'standard';
  sources?: string[];
  inconsistencies?: string[];
  phases: LegendPhasePayload[];
}

export interface LegendImportResponse {
  ok: true;
  slug: string;
  collectionId: string;
  inserted: Array<{
    id: string;
    name: string;
    phase: LegendPhase;
    collection_id: string;
    collection_code: string | null;
    tier: number | null;
    mint_overall: number | null;
    currency: LegendCurrency;
    price_unit_cents: number;
    card_supply: number;
  }>;
  lots: Array<{ legacy_player_id: string; lot_number: number; lot_id: string | null }>;
}

export interface FindUserResponse {
  found: boolean;
  id?: string;
  email?: string;
  created_at?: string;
}

function adminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('olefoot.admin.token')?.trim() ?? '';
  } catch {
    return '';
  }
}

export async function adminImportLegend(slug: string, payload: LegendImportPayload): Promise<LegendImportResponse> {
  const url = `${olefootApiBase()}/api/admin/legend-import`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken(),
    },
    body: JSON.stringify({ slug, payload }),
  });
  const body = (await res.json()) as LegendImportResponse | { error: string };
  if (!res.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `HTTP ${res.status}`);
  }
  return body;
}

export interface PortraitFocus {
  x: number;
  y: number;
  zoom: number;
}

export interface LegendExportResponse {
  ok: true;
  slug: string;
  payload: LegendImportPayload;
  portraits: Partial<Record<LegendPhase, string | null>>;
  portraitFocus?: Partial<Record<LegendPhase, PortraitFocus>>;
}

/**
 * Carrega uma lenda já tokenizada do banco pra edição no wizard.
 * Retorna o payload no mesmo formato do legend.json + URLs de portrait por fase.
 */
export async function adminExportLegend(slug: string): Promise<LegendExportResponse> {
  const url = `${olefootApiBase()}/api/admin/legend-export?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Admin-Token': adminToken() },
  });
  const body = (await res.json()) as LegendExportResponse | { error: string };
  if (!res.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `HTTP ${res.status}`);
  }
  return body;
}

export interface SetPortraitResponse {
  ok: true;
  legacyPlayerId: string;
  publicUrl: string;
}

/**
 * Persiste a URL do portrait (já hospedada em Pinata/IPFS via /api/media/pinata/upload)
 * no row de legacy_players. Substitui o upload Supabase Storage anterior — alinha
 * com fluxo validado em AdminGenesisPortraitsPanel.
 */
export async function adminSetLegacyPortrait(
  legacyPlayerId: string,
  publicUrl: string,
  storagePath?: string,
  focus?: PortraitFocus,
): Promise<SetPortraitResponse> {
  const url = `${olefootApiBase()}/api/admin/legacy-player-set-portrait`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken(),
    },
    body: JSON.stringify({
      legacyPlayerId,
      publicUrl,
      storagePath,
      ...(focus ? { focusX: focus.x, focusY: focus.y, zoom: focus.zoom } : {}),
    }),
  });
  const body = (await res.json()) as SetPortraitResponse | { error: string };
  if (!res.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `HTTP ${res.status}`);
  }
  return body;
}

export async function adminFindUserByEmail(email: string): Promise<FindUserResponse> {
  const url = `${olefootApiBase()}/api/admin/find-user?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Admin-Token': adminToken() },
  });
  const body = (await res.json()) as FindUserResponse | { error: string };
  if (!res.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `HTTP ${res.status}`);
  }
  return body;
}

/** Tier defaults (espelha tabela TIER_DEFAULTS do server). */
export const TIER_DEFAULTS: Record<LegendTier, { supply: number; usdtCents: number; oleUnits: number }> = {
  1: { supply: 10_000, usdtCents: 100, oleUnits: 100_000 },
  2: { supply: 5_000, usdtCents: 200, oleUnits: 250_000 },
  3: { supply: 2_500, usdtCents: 500, oleUnits: 1_000_000 },
};

export const DEFAULT_SPLIT: LegendSplitEntry[] = [
  { kind: 'player', user_id: null, label: 'Jogador', percent: 50 },
  { kind: 'olefoot', user_id: null, label: 'Olefoot', percent: 25 },
  { kind: 'community', user_id: null, label: 'Comunidade', percent: 15 },
  { kind: 'facilitator', user_id: null, label: 'Facilitador', percent: 10 },
];

export function isSplitValid(split: LegendSplitEntry[]): boolean {
  if (!Array.isArray(split) || split.length === 0) return false;
  const facilitators = split.filter((e) => e.kind === 'facilitator').length;
  if (facilitators > 5) return false;
  const sum = split.reduce((acc, e) => acc + (Number.isFinite(e.percent) ? e.percent : 0), 0);
  return Math.abs(sum - 100) < 0.01;
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

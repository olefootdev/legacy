/**
 * Cliente HTTP dos 4 agentes de Create Player.
 *
 * Fluxo recomendado no admin UI:
 *   scout → (admin edita) → attributes → (admin edita) → bio → upload foto → valuation → mint
 */

import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

export interface ScoutResearch {
  full_name: string;
  nickname?: string;
  position: string;
  era: string;
  nationality: string;
  national_team?: string;
  main_clubs: Array<{ name: string; years?: string; role?: string }>;
  titles: string[];
  highlights: string[];
  playstyle_notes: string;
  personality_traits: string[];
  confidence: 'high' | 'medium' | 'low';
  sources_used: string[];
}

export type AdminRarityTier = 'premium' | 'gol' | 'rare' | 'ultra_rare' | 'champion' | 'legend' | 'epic';

export interface AttributesResult {
  overall: number;
  rarity_recommended: AdminRarityTier;
  attrs: {
    passe: number; marcacao: number; velocidade: number; drible: number;
    finalizacao: number; fisico: number; tatico: number; mentalidade: number;
    confianca: number; fairPlay: number;
  };
  subattrs_notes: string;
}

export interface BioResult {
  quem_sou_eu: string;
  bio_short: string;
  signature_move: string;
  personality_line: string;
  spirit_notes: string;
}

export interface ValuationResult {
  floor_price_bro_cents: number;
  target_price_bro_cents: number;
  target_price_exp: number;
  rarity_tier: AdminRarityTier;
  scarcity_note: string;
  collection_fit: string;
  volatility: 'low' | 'medium' | 'high';
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout (agentes AI)

  try {
    const r = await fetch(`${olefootApiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const j = (await r.json()) as { ok: boolean; error?: string } & Record<string, unknown>;
    if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j as unknown as T;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Timeout: servidor não respondeu em 30s.');
    }
    throw e;
  }
}

export async function runScoutAgent(input: {
  name: string;
  nickname?: string;
  hintPosition?: string;
  hintEra?: string;
  sources?: string[];
}): Promise<ScoutResearch> {
  const r = await post<{ research: ScoutResearch }>('/api/admin/player/scout', input);
  return r.research;
}

export async function runAttributesAgent(input: {
  research: ScoutResearch;
  targetRarity?: 'comum' | 'raro' | 'epico' | 'mitico';
}): Promise<AttributesResult> {
  const r = await post<{ attrs: AttributesResult }>('/api/admin/player/attributes', input);
  return r.attrs;
}

export async function runBioAgent(input: {
  research: ScoutResearch;
  attrs?: AttributesResult;
}): Promise<BioResult> {
  const r = await post<{ bio: BioResult }>('/api/admin/player/bio', input);
  return r.bio;
}

export async function runValuationAgent(input: {
  attrs: AttributesResult;
  research?: ScoutResearch;
  collectionContext?: string;
}): Promise<ValuationResult> {
  const r = await post<{ valuation: ValuationResult }>('/api/admin/player/valuation', input);
  return r.valuation;
}

/**
 * Cliente do sorteio de craque (gacha de época).
 * - fetchAcademyDrawConfig(): odds + tetos por raridade (pra exibir antes do sorteio).
 * - drawAcademyPlayer(): chama POST /api/academy/draw (server rola raridade + pesquisa).
 */
import { getSupabase } from './client';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import type { PlayerAttributes } from '@/entities/types';

export type GachaRarity = 'normal' | 'premium' | 'gold' | 'rare' | 'legend';

export interface DrawConfigRow {
  rarity_tier: GachaRarity;
  probability_pct: number;
  ovr_floor: number;
  ovr_ceiling: number;
  sort_order: number;
}

export interface DrawResult {
  rarity: GachaRarity;
  position: string;
  year: number;
  playerName: string;
  overall: number;
  attributes: PlayerAttributes;
  bio: string;
  sources: string[];
}

export interface DrawResponse {
  ok: boolean;
  result?: DrawResult;
  error?: string;
  code?: string;
  activeReferrals?: number;
  required?: number;
}

export async function fetchAcademyDrawConfig(): Promise<DrawConfigRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('academy_draw_config')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data as DrawConfigRow[];
}

export async function drawAcademyPlayer(pos: string, year: number): Promise<DrawResponse> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { ok: false, error: 'Precisas estar autenticado.' };
  const base = olefootApiBase();
  try {
    const r = await fetch(`${base}/api/academy/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pos, year }),
    });
    const json = (await r.json()) as {
      ok: boolean;
      error?: string;
      code?: string;
      active_referrals?: number;
      required?: number;
      rarity?: GachaRarity;
      position?: string;
      year?: number;
      player_name?: string;
      overall?: number;
      attributes?: PlayerAttributes;
      bio?: string;
      sources?: string[];
    };
    if (!json.ok) {
      return {
        ok: false,
        error: json.error ?? 'Falha no sorteio.',
        code: json.code,
        activeReferrals: json.active_referrals,
        required: json.required,
      };
    }
    return {
      ok: true,
      result: {
        rarity: json.rarity ?? 'normal',
        position: json.position ?? pos,
        year: json.year ?? year,
        playerName: json.player_name ?? '—',
        overall: json.overall ?? 0,
        attributes: json.attributes as PlayerAttributes,
        bio: json.bio ?? '',
        sources: Array.isArray(json.sources) ? json.sources : [],
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede no sorteio.' };
  }
}

/** Marca o sorteio como confirmado (best-effort, após criar o player). */
export async function confirmAcademyDraw(): Promise<void> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return;
  const base = olefootApiBase();
  try {
    await fetch(`${base}/api/academy/confirm-draw`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* best-effort */
  }
}

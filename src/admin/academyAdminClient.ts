/**
 * Client admin do gacha: revisar/selar templates de atributos + ajustar odds.
 * Header X-Admin-Token (localStorage 'olefoot.admin.token'), mesmo padrão do
 * legendCreatorClient.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import type { PlayerAttributes } from '@/entities/types';

export interface AdminAttributeTemplate {
  id: string;
  player_slug: string;
  player_name: string;
  year: number;
  position: string;
  rarity_tier: 'normal' | 'premium' | 'gold' | 'rare' | 'legend';
  attributes: PlayerAttributes;
  overall: number;
  bio_snippet: string | null;
  sources: string[];
  methodology_ver: string;
  status: 'draft' | 'sealed';
  created_at: string;
}

export interface AdminDrawConfig {
  rarity_tier: 'normal' | 'premium' | 'gold' | 'rare' | 'legend';
  probability_pct: number;
  ovr_floor: number;
  ovr_ceiling: number;
  sort_order: number;
}

function adminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('olefoot.admin.token')?.trim() ?? '';
  } catch {
    return '';
  }
}

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = { 'X-Admin-Token': adminToken() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function fetchAcademyTemplates(): Promise<AdminAttributeTemplate[]> {
  const r = await fetch(`${olefootApiBase()}/api/admin/academy/templates`, { headers: headers() });
  const body = (await r.json()) as { ok?: boolean; templates?: AdminAttributeTemplate[]; error?: string };
  if (!r.ok || !body.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  return body.templates ?? [];
}

export async function patchAcademyTemplate(patch: {
  id: string;
  attributes?: PlayerAttributes;
  overall?: number;
  status?: 'draft' | 'sealed';
  player_name?: string;
  bio_snippet?: string;
}): Promise<AdminAttributeTemplate | null> {
  const r = await fetch(`${olefootApiBase()}/api/admin/academy/template`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(patch),
  });
  const body = (await r.json()) as { ok?: boolean; template?: AdminAttributeTemplate; error?: string };
  if (!r.ok || !body.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  return body.template ?? null;
}

export async function fetchAcademyDrawConfigAdmin(): Promise<AdminDrawConfig[]> {
  const r = await fetch(`${olefootApiBase()}/api/admin/academy/draw-config`, { headers: headers() });
  const body = (await r.json()) as { ok?: boolean; config?: AdminDrawConfig[]; error?: string };
  if (!r.ok || !body.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  return body.config ?? [];
}

export async function patchAcademyDrawConfig(patch: {
  rarity_tier: string;
  probability_pct?: number;
  ovr_floor?: number;
  ovr_ceiling?: number;
}): Promise<void> {
  const r = await fetch(`${olefootApiBase()}/api/admin/academy/draw-config`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(patch),
  });
  const body = (await r.json()) as { ok?: boolean; error?: string };
  if (!r.ok || !body.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
}

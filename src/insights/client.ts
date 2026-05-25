/**
 * OLEFOOT PYTHON MODE — Cliente TS pro serviço /insights.
 *
 * Encaminha requests via Hono proxy (/api/insights/*) → Python FastAPI.
 * Token JWT do Supabase passado automaticamente.
 */
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';

const API_BASE = import.meta.env.VITE_OLEFOOT_API_URL ?? '';

// ─── Types (espelham app/models.py) ────────────────────────────────

export type Dimension = 'physical' | 'psychological' | 'reputational' | 'financial';
export type DecayCurve = 'step' | 'linear' | 'exponential';
export type Scope = 'player' | 'club';

export interface InsightsConsequence {
  id: string;
  manager_id: string;
  club_id: string;
  player_id: string | null;
  kind: string;
  dimension: Dimension;
  scope: Scope;
  magnitude: number;
  decay_curve: DecayCurve;
  starts_at: string;
  expires_at: string;
  source_event_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface InsightsEvaluatedConsequence {
  consequence: InsightsConsequence;
  current_value: number;
  life_remaining: number;
  ms_until_expiry: number;
}

export interface ConsequencesByDimension {
  physical: InsightsEvaluatedConsequence[];
  psychological: InsightsEvaluatedConsequence[];
  reputational: InsightsEvaluatedConsequence[];
  financial: InsightsEvaluatedConsequence[];
}

export interface ClubSummary {
  total_active: number;
  unavailable_players: number;
  alerts: number;
  celebrations: number;
  next_expiry_at: string | null;
  most_impacted_player_id: string | null;
}

export interface NightReportCard {
  id: string;
  kind: 'alert' | 'celebration' | 'opportunity' | 'reminder' | 'highlight_match';
  tone: 'positive' | 'negative' | 'neutral' | 'urgent';
  title: string;
  subtitle: string;
  weight: number;
}

export interface NightReport {
  generated_at: string;
  manager_id: string;
  cards: NightReportCard[];
  one_line_summary: string;
  resolved_overnight: number;
  still_active: number;
  new_alerts: number;
}

// ─── HTTP helpers ───────────────────────────────────────────────────

async function authHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const headers = await authHeader();
  if (!headers.Authorization) {
    console.warn('[insights] sem JWT — abortando');
    return null;
  }

  const url = API_BASE ? `${API_BASE}${path}` : path;
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) {
      console.warn('[insights]', path, r.status, await r.text());
      return null;
    }
    return (await r.json()) as T;
  } catch (err) {
    console.warn('[insights] fetch error:', err);
    return null;
  }
}

// ─── Endpoints ──────────────────────────────────────────────────────

export async function fetchConsequences(managerId: string): Promise<ConsequencesByDimension | null> {
  return fetchJson(`/api/insights/club/${encodeURIComponent(managerId)}/consequences`);
}

export async function fetchClubSummary(managerId: string): Promise<ClubSummary | null> {
  return fetchJson(`/api/insights/club/${encodeURIComponent(managerId)}/summary`);
}

export async function fetchNightReport(managerId: string): Promise<NightReport | null> {
  return fetchJson(`/api/insights/club/${encodeURIComponent(managerId)}/night-report`);
}

export async function fetchInsightsHealth(): Promise<{ ok: boolean; reason?: string } | null> {
  const url = API_BASE ? `${API_BASE}/api/insights/health` : '/api/insights/health';
  try {
    const r = await fetch(url);
    return await r.json();
  } catch {
    return { ok: false, reason: 'fetch failed' };
  }
}

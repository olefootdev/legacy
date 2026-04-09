import type { ApiFootballEnvelope } from './types';

const HOST = 'https://v3.football.api-sports.io';

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const q = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '') continue;
      q.set(k, String(v));
    }
  }
  const qs = q.toString();
  if (import.meta.env.DEV) {
    return `/api-football${p}${qs ? `?${qs}` : ''}`;
  }
  return `${HOST}${p}${qs ? `?${qs}` : ''}`;
}

function headers(): HeadersInit {
  const h: HeadersInit = {};
  if (!import.meta.env.DEV) {
    const key = import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined;
    if (key) h['x-apisports-key'] = key;
  }
  return h;
}

export function hasApiFootballClientConfig(): boolean {
  if (import.meta.env.DEV) return true;
  return Boolean(import.meta.env.VITE_API_FOOTBALL_KEY);
}

export async function apiFootballGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = buildUrl(path, params);
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`API-Football ${r.status}: ${t.slice(0, 200)}`);
  }
  const json = (await r.json()) as ApiFootballEnvelope<T>;
  if (json.errors && (Array.isArray(json.errors) ? json.errors.length > 0 : Object.keys(json.errors as object).length > 0)) {
    throw new Error(`API-Football: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

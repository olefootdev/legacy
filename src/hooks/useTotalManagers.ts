/**
 * useTotalManagers — count global de managers cadastrados.
 *
 * Busca via supabase (head request, sem retornar rows). Fallback estável
 * se supabase não estiver configurado ou falhar — número crescente
 * baseado em data, pra parecer vivo no v1.
 *
 * Cacheia em sessionStorage por 5min pra evitar over-fetch.
 */
import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';

const CACHE_KEY = 'olefoot.totalManagers';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  count: number;
  ts: number;
}

function readCache(): CacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writeCache(count: number) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

/** Fallback determinístico crescente — começa num baseline plausível. */
function fallbackCount(): number {
  const epoch = new Date('2026-04-01T00:00:00Z').getTime();
  const daysSince = Math.max(0, Math.floor((Date.now() - epoch) / 86_400_000));
  return 320 + daysSince * 7; // ~7 novos managers/dia
}

export function useTotalManagers(): number | null {
  const cached = readCache();
  const [count, setCount] = useState<number | null>(cached?.count ?? null);

  useEffect(() => {
    if (cached) return; // evita fetch redundante
    let cancelled = false;

    const run = async () => {
      if (!isSupabaseConfigured()) {
        const fb = fallbackCount();
        if (!cancelled) {
          setCount(fb);
          writeCache(fb);
        }
        return;
      }
      try {
        const sb = getSupabase();
        if (!sb) throw new Error('supabase client unavailable');
        const { count: c, error } = await sb
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        if (error) throw error;
        const value = (c ?? 0) > 0 ? (c ?? fallbackCount()) : fallbackCount();
        if (!cancelled) {
          setCount(value);
          writeCache(value);
        }
      } catch {
        const fb = fallbackCount();
        if (!cancelled) {
          setCount(fb);
          writeCache(fb);
        }
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return count;
}

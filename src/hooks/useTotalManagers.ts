/**
 * useTotalManagers — count global REAL de managers cadastrados.
 *
 * Consulta RPC `get_total_managers()` (SECURITY DEFINER) que retorna
 * COUNT(*) de profiles ativos. Sem fallback mockado: se Supabase não
 * estiver disponível ou retornar erro, retorna `null` — a UI exibe
 * "Fase Beta" em vez de número fictício.
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

export function useTotalManagers(): number | null {
  const cached = readCache();
  const [count, setCount] = useState<number | null>(cached?.count ?? null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;

    const run = async () => {
      if (!isSupabaseConfigured()) {
        // Sem Supabase: deixa null (UI mostra "Fase Beta", não número fictício).
        return;
      }
      try {
        const sb = getSupabase();
        if (!sb) return;
        const { data, error } = await sb.rpc('get_total_managers');
        if (error) {
          console.warn('[useTotalManagers] rpc error:', error.message);
          return;
        }
        const value = typeof data === 'number' ? data : null;
        if (value != null && !cancelled) {
          setCount(value);
          writeCache(value);
        }
      } catch (e) {
        console.warn('[useTotalManagers] failed:', e);
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

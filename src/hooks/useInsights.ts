/**
 * OLEFOOT PYTHON MODE — Hooks reativos pra consumir o serviço /insights.
 *
 * Política: lazy fetch (só roda quando hook é montado), cache em memória
 * com TTL configurável, retry em erro com backoff curto.
 *
 * Diferença vs useConsequences/useEngagement:
 *   - Esses leem do store local (consequenceStore in-memory)
 *   - useInsights* leem do Python (com lógica analítica mais rica + histórico)
 *
 * UI usa um ou outro conforme contexto:
 *   - Badge no card de jogador → local (rápido, sempre)
 *   - Página SCOUTS → /insights (rico, histórico, analytics)
 */
import { useEffect, useState } from 'react';
import {
  fetchClubSummary,
  fetchConsequences,
  fetchInsightsHealth,
  fetchNightReport,
  fetchPlayerTransparency,
  fetchSquadOverview,
  type ClubSummary,
  type ConsequencesByDimension,
  type NightReport,
  type PlayerTransparency,
  type SquadOverview,
} from '@/insights/client';

interface UseInsightsState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useEndpoint<T>(
  managerId: string | null | undefined,
  fetcher: (id: string) => Promise<T | null>,
  ttlMs = 60_000,
): UseInsightsState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!managerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await fetcher(managerId);
      if (cancelled) return;
      if (result === null) {
        setError('Falha ao buscar /insights');
      } else {
        setData(result);
      }
      setLoading(false);
    })();
    // Auto-refresh a cada TTL
    const id = setInterval(() => setRefreshKey((k) => k + 1), ttlMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [managerId, refreshKey, fetcher, ttlMs]);

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}

export function useInsightsConsequences(
  managerId: string | null | undefined,
): UseInsightsState<ConsequencesByDimension> {
  return useEndpoint(managerId, fetchConsequences);
}

export function useInsightsClubSummary(
  managerId: string | null | undefined,
): UseInsightsState<ClubSummary> {
  return useEndpoint(managerId, fetchClubSummary);
}

export function useInsightsNightReport(
  managerId: string | null | undefined,
): UseInsightsState<NightReport> {
  // Night report cache mais longo — só muda 1x por noite
  return useEndpoint(managerId, fetchNightReport, 5 * 60_000);
}

export function useInsightsSquadOverview(
  managerId: string | null | undefined,
): UseInsightsState<SquadOverview> {
  return useEndpoint(managerId, fetchSquadOverview);
}

export function useInsightsPlayerTransparency(
  playerId: string | null | undefined,
): UseInsightsState<PlayerTransparency> {
  return useEndpoint(playerId, fetchPlayerTransparency);
}

/**
 * Probe de saúde do upstream Python — sem JWT, anônimo.
 *
 * Diferencia "serviço caiu" de "user não autenticado". Use junto com
 * `useInsightsClubSummary` pra montar um status badge honesto.
 *
 * Status:
 *   - 'unknown' → ainda nem tentou (mount inicial)
 *   - 'up'      → /api/insights/health retornou ok:true
 *   - 'down'    → falha de rede, 5xx, ou ok:false
 */
export type InsightsServiceStatus = 'unknown' | 'up' | 'down';

export function useInsightsServiceHealth(pollMs = 60_000): {
  status: InsightsServiceStatus;
  reason: string | null;
  lastCheckedAt: number | null;
} {
  const [status, setStatus] = useState<InsightsServiceStatus>('unknown');
  const [reason, setReason] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const r = await fetchInsightsHealth();
      if (cancelled) return;
      setLastCheckedAt(Date.now());
      if (r?.ok) {
        setStatus('up');
        setReason(null);
      } else {
        setStatus('down');
        setReason(r?.reason ?? 'serviço não respondeu');
      }
    };
    void probe();
    const id = setInterval(() => void probe(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { status, reason, lastCheckedAt };
}

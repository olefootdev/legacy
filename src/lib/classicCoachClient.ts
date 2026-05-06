/**
 * Cliente do Coach AI inteligente do CLASSIC.
 *
 * Chama POST {API_URL}/api/classic/coach-reading com snapshot da partida.
 * Inclui:
 *   - Throttle global de 28s (não dispara mais que 1 leitura nesse intervalo)
 *   - Cache por hash do snapshot (mudou pouco? reusa a leitura anterior)
 *   - Timeout 4s — se demorar, fallback é trabalho do caller
 *   - Abort em desmontagem
 *
 * Custo aproximado: Claude Haiku 4.5 ~$0.0003 por leitura. ~3-5 leituras
 * numa partida de 1m30s real → ~$0.0015 por partida. Escalável.
 */

// Em dev (vite dev) preferimos localhost:4000 mesmo que VITE_OLEFOOT_API_URL
// aponte pra prod — assim o desenvolvedor testa contra o seu próprio server
// rodando em background. Em produção, usa o env var.
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:4000'
  : (import.meta.env.VITE_OLEFOOT_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000');

export interface ClassicCoachSnapshot {
  homeTeam: string;
  awayTeam: string;
  score: { home: number; away: number };
  minute: number;
  period: string;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  passStyle: 'TIKTAK' | 'LONGO' | 'LATERAL' | 'COUNTER';
  mentalidade: 'DEFENSIVO' | 'EQUILIBRADO' | 'OFENSIVO';
  activeSkills: string[];
  keyPlayers: Array<{
    name: string;
    role: string;
    archetype: string;
    ovr: number;
    fatigue: number;
    confidence: number;
    onFire?: boolean;
    isStar?: boolean;
  }>;
  lastEvent?: { type: string; playerName?: string; minute: number };
  storyBeats?: string[];
}

export interface CoachReading {
  headline: string;
  reading: string;
  suggestion: string;
  tone: 'positive' | 'neutral' | 'urgent' | 'alert';
}

interface CacheEntry {
  hash: string;
  reading: CoachReading;
  ts: number;
}

const THROTTLE_MS = 28_000;
const CACHE_TTL   = 45_000;
let lastFetchAt = 0;
let inflight: Promise<CoachReading | null> | null = null;
const cache = new Map<string, CacheEntry>();

function snapshotHash(s: ClassicCoachSnapshot): string {
  // Hash leve: stats arredondadas + último evento + minuto/10
  const minBucket = Math.floor(s.minute / 5); // muda a cada 5 minutos
  const possBucket = Math.floor(s.possession.home / 10);
  const skillsKey = [...s.activeSkills].sort().join(',');
  return [
    minBucket,
    s.score.home, s.score.away,
    possBucket,
    s.shots.home, s.shots.away,
    s.passStyle, s.mentalidade,
    skillsKey,
    s.lastEvent?.type ?? '',
  ].join('|');
}

/**
 * Fetcha uma leitura tática. Throttled + cached. Retorna null se:
 *   - throttle ainda válido
 *   - servidor indisponível
 *   - resposta inválida
 *   - timeout
 *
 * O caller deve usar fallback (templates if/else) quando null.
 */
export async function fetchClassicCoachReading(
  snapshot: ClassicCoachSnapshot,
  opts: { force?: boolean; signal?: AbortSignal } = {},
): Promise<CoachReading | null> {
  const now = Date.now();
  const hash = snapshotHash(snapshot);

  // Cache hit: mesmo snapshot foi pedido há menos de 45s
  const cached = cache.get(hash);
  if (cached && now - cached.ts < CACHE_TTL && !opts.force) {
    return cached.reading;
  }

  // Throttle: só dispara nova leitura a cada 28s
  if (!opts.force && now - lastFetchAt < THROTTLE_MS) {
    return null;
  }

  // Coalesce: já tem uma chamada em voo? reusa
  if (inflight) {
    return inflight;
  }

  lastFetchAt = now;

  inflight = (async () => {
    try {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort('timeout'), 4500);
      // Encadeia abort externo se houver
      opts.signal?.addEventListener('abort', () => ctl.abort('parent-aborted'));

      const res = await fetch(`${API_BASE}/api/classic/coach-reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: ctl.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.ok || !data?.reading) return null;

      const reading: CoachReading = data.reading;
      cache.set(hash, { hash, reading, ts: Date.now() });
      // Limpa cache antigo (>3min) pra não vazar memória
      if (cache.size > 24) {
        const cutoff = Date.now() - 3 * 60_000;
        for (const [k, v] of cache.entries()) {
          if (v.ts < cutoff) cache.delete(k);
        }
      }
      return reading;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Reseta cache + throttle (útil em troca de partida). */
export function resetClassicCoach(): void {
  lastFetchAt = 0;
  inflight = null;
  cache.clear();
}

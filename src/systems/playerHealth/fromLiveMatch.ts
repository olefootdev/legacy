import type { LiveMatchSnapshot, MatchEventEntry } from '@/engine/types';
import type {
  MatchModeForHealth,
  MatchOutcomeEvent,
} from './types';

/**
 * Converte um `LiveMatchSnapshot` finalizado em `MatchOutcomeEvent[]` para o SSOT.
 * Cobre os modos `quick`, `auto`, `test2d` (e amistosos rodando como quick/auto).
 */
export function liveMatchToHealthEvents(opts: {
  lm: LiveMatchSnapshot;
  matchId: string;
  /** Liga em que esta partida vale (para escopo de cartões amarelos). null = amistoso. */
  leagueId: string | null;
  /** Modo unificado p/ telemetria. Default: lm.mode. */
  modeOverride?: MatchModeForHealth;
  now?: number;
}): MatchOutcomeEvent[] {
  const { lm, matchId, leagueId } = opts;
  const at = opts.now ?? Date.now();
  const matchMode: MatchModeForHealth =
    opts.modeOverride ?? (lm.mode as MatchModeForHealth);

  const events: MatchOutcomeEvent[] = [];

  // 1) Played: jogadores com homeStats receberam minutos.
  const minutesPlayed = Math.min(120, Math.max(0, Math.round(lm.minute || 90)));
  const totalShots =
    Object.values(lm.homeStats ?? {}).reduce(
      (acc, s) => acc + (s.shotsOn ?? 0) + (s.shotsOff ?? 0),
      0,
    ) || 0;
  const intensity = Math.max(0.3, Math.min(1, 0.4 + totalShots / 30));

  const playedIds = new Set<string>();
  for (const [pid, stat] of Object.entries(lm.homeStats ?? {})) {
    if (!pid) continue;
    if ((stat?.passesAttempt ?? 0) + (stat?.tackles ?? 0) + (stat?.km ?? 0) === 0) {
      // sem participação registada
      continue;
    }
    playedIds.add(pid);
    events.push({
      type: 'played',
      playerId: pid,
      matchId,
      matchMode,
      leagueId: leagueId ?? undefined,
      at,
      minutes: minutesPlayed,
      intensity,
    });
  }
  // Fallback: se homeStats vazio, usa homePlayers
  if (playedIds.size === 0) {
    for (const p of lm.homePlayers ?? []) {
      if (!p.playerId) continue;
      events.push({
        type: 'played',
        playerId: p.playerId,
        matchId,
        matchMode,
        leagueId: leagueId ?? undefined,
        at,
        minutes: minutesPlayed,
        intensity,
      });
    }
  }

  // 2) Eventos disciplinares e lesões (só lado da casa — visitante não usa nosso save).
  for (const e of lm.events ?? []) {
    const pid = e.playerId;
    if (!pid) continue;
    const ev = mapEventEntry(e, { matchId, matchMode, leagueId, at });
    if (ev) events.push(ev);
  }

  return events;
}

function mapEventEntry(
  e: MatchEventEntry,
  ctx: {
    matchId: string;
    matchMode: MatchModeForHealth;
    leagueId: string | null;
    at: number;
  },
): MatchOutcomeEvent | null {
  const base = {
    playerId: e.playerId!,
    matchId: ctx.matchId,
    matchMode: ctx.matchMode,
    at: ctx.at + e.minute * 60_000,
  };
  switch (e.kind) {
    case 'yellow_home':
      if (!ctx.leagueId) return null; // amistoso não acumula
      return { ...base, type: 'yellow_card', leagueId: ctx.leagueId };
    case 'red_home':
      return { ...base, type: 'red_card', reason: 'direct' };
    case 'injury_home':
      return { ...base, type: 'injury', severity: 'leve' };
    default:
      return null;
  }
}

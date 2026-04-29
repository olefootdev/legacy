import type { GlobalFixture } from '@/match/globalMatch';
import type { MatchOutcomeEvent } from './types';

/**
 * Converte fixtures finalizadas da Liga Global em `MatchOutcomeEvent[]`.
 * Filtra apenas jogadores do clube do manager (homeClubId).
 */
export function globalFixturesToHealthEvents(opts: {
  fixtures: GlobalFixture[];
  /** Id do clube do manager — só eventos deste clube viram saúde no save. */
  homeClubId: string;
  /** Liga em que rodam estes fixtures (para escopo de cartões amarelos). */
  leagueId: string;
  now?: number;
}): MatchOutcomeEvent[] {
  const { fixtures, homeClubId, leagueId } = opts;
  const at = opts.now ?? Date.now();
  const out: MatchOutcomeEvent[] = [];

  for (const fx of fixtures) {
    const homeIsClub = fx.homeTeamId === homeClubId;
    const awayIsClub = fx.awayTeamId === homeClubId;
    if (!homeIsClub && !awayIsClub) continue;

    // Played: aproximação — todos os 11 do clube jogaram 90.
    // (sem roster por fixture aqui; melhor é calcular minutos no caller que conhece a escalação)

    for (const ev of fx.events) {
      if (!ev.playerId) continue;
      const ourSide =
        (homeIsClub && ev.side === 'home') || (awayIsClub && ev.side === 'away');
      if (!ourSide) continue;

      const base = {
        playerId: ev.playerId,
        matchId: fx.id,
        matchMode: 'global' as const,
        at: at + ev.minute * 60_000,
      };
      switch (ev.type) {
        case 'yellow_card':
          out.push({ ...base, type: 'yellow_card', leagueId });
          break;
        case 'red_card':
          out.push({ ...base, type: 'red_card', reason: 'direct' });
          break;
        case 'injury':
          out.push({ ...base, type: 'injury', severity: 'leve' });
          break;
        default:
          break;
      }
    }
  }

  return out;
}

/**
 * Helper: emite eventos `played` para todos os jogadores escalados
 * (uma rodada global = 1 jogo de 90' com intensidade média).
 */
export function globalRoundPlayedEvents(opts: {
  playerIds: string[];
  matchId: string;
  leagueId: string;
  intensity?: number;
  now?: number;
}): MatchOutcomeEvent[] {
  const at = opts.now ?? Date.now();
  const intensity = opts.intensity ?? 0.6;
  return opts.playerIds.map((pid) => ({
    type: 'played',
    playerId: pid,
    matchId: opts.matchId,
    matchMode: 'global' as const,
    leagueId: opts.leagueId,
    at,
    minutes: 90,
    intensity,
  }));
}

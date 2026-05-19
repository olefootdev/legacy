import type { GlobalFixture } from '@/match/globalMatch';
import type { MatchOutcomeEvent, PlayerHealth } from './types';
import type { InjurySeverity } from '@/systems/injury';

/**
 * Determina severidade da lesão baseada na fadiga do jogador.
 * Fadiga alta → maior chance de lesão grave.
 */
function rollInjurySeverityFromFatigue(fatigue: number): InjurySeverity {
  const roll = Math.random();
  if (fatigue >= 80) {
    // Exausto: 30% leve, 40% forte, 30% gravíssima
    if (roll < 0.3) return 'leve';
    if (roll < 0.7) return 'forte';
    return 'gravissima';
  }
  if (fatigue >= 50) {
    // Cansado: 50% leve, 35% forte, 15% gravíssima
    if (roll < 0.5) return 'leve';
    if (roll < 0.85) return 'forte';
    return 'gravissima';
  }
  // Fresco: 70% leve, 25% forte, 5% gravíssima
  if (roll < 0.7) return 'leve';
  if (roll < 0.95) return 'forte';
  return 'gravissima';
}

/**
 * Converte fixtures finalizadas da Liga Global em `MatchOutcomeEvent[]`.
 * Filtra apenas jogadores do clube do manager (homeClubId).
 * Usa playerHealth para determinar severidade dinâmica de lesões.
 */
export function globalFixturesToHealthEvents(opts: {
  fixtures: GlobalFixture[];
  /** Id do clube do manager — só eventos deste clube viram saúde no save. */
  homeClubId: string;
  /** Liga em que rodam estes fixtures (para escopo de cartões amarelos). */
  leagueId: string;
  /** Mapa de saúde atual — usado para severidade dinâmica de lesões. */
  playerHealth?: Record<string, PlayerHealth>;
  now?: number;
}): MatchOutcomeEvent[] {
  const { fixtures, homeClubId, leagueId, playerHealth } = opts;
  const at = opts.now ?? Date.now();
  const out: MatchOutcomeEvent[] = [];

  for (const fx of fixtures) {
    const homeIsClub = fx.homeTeamId === homeClubId;
    const awayIsClub = fx.awayTeamId === homeClubId;
    if (!homeIsClub && !awayIsClub) continue;

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
        case 'injury': {
          const fatigue = playerHealth?.[ev.playerId]?.fatigue ?? 0;
          out.push({ ...base, type: 'injury', severity: rollInjurySeverityFromFatigue(fatigue) });
          break;
        }
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

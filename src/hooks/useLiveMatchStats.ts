/**
 * Hook para calcular estatísticas ao vivo da partida — Fase 1 Quick Win #8
 * Atualiza stats em tempo real a partir dos eventos causais.
 */
import { useMemo } from 'react';
import type { LiveMatchSnapshot } from '@/engine/types';
import type { LiveMatchStats } from '@/components/matchday/LiveStatsComparison';

export function useLiveMatchStats(liveSnap: LiveMatchSnapshot | undefined): LiveMatchStats {
  return useMemo(() => {
    if (!liveSnap) {
      return {
        possession: { home: 50, away: 50 },
        shots: { home: 0, away: 0 },
        shotsOnTarget: { home: 0, away: 0 },
        passAccuracy: { home: 0, away: 0 },
        tackles: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
      };
    }

    const causal = Array.isArray(liveSnap.causalLog) ? liveSnap.causalLog : [];

    // Conta eventos por tipo
    let homeShots = 0;
    let awayShots = 0;
    let homeShotsOnTarget = 0;
    let awayShotsOnTarget = 0;
    let homePasses = 0;
    let homePassesOk = 0;
    let awayPasses = 0;
    let awayPassesOk = 0;
    let homeTackles = 0;
    let awayTackles = 0;
    let homeFouls = 0;
    let awayFouls = 0;
    let homePossessionTicks = 0;
    let awayPossessionTicks = 0;

    for (const event of causal) {
      switch (event.type) {
        case 'shot_attempt': {
          const side = (event.payload as any)?.side;
          if (side === 'home') homeShots++;
          else if (side === 'away') awayShots++;
          break;
        }
        case 'shot_result': {
          const side = (event.payload as any)?.side;
          const outcome = (event.payload as any)?.outcome;
          if (outcome === 'goal' || outcome === 'save') {
            if (side === 'home') homeShotsOnTarget++;
            else if (side === 'away') awayShotsOnTarget++;
          }
          break;
        }
        case 'possession_change': {
          const to = (event.payload as any)?.to;
          if (to === 'home') homePossessionTicks++;
          else if (to === 'away') awayPossessionTicks++;
          break;
        }
        case 'interception': {
          const side = (event.payload as any)?.defenderSide;
          if (side === 'home') homeTackles++;
          else if (side === 'away') awayTackles++;
          break;
        }
        case 'foul_committed': {
          const side = (event.payload as any)?.foulerSide;
          if (side === 'home') homeFouls++;
          else if (side === 'away') awayFouls++;
          break;
        }
      }
    }

    // Calcula posse (baseado em ticks de posse + estimativa)
    const totalPossessionTicks = homePossessionTicks + awayPossessionTicks;
    const homePossessionPercent = totalPossessionTicks > 0
      ? Math.round((homePossessionTicks / totalPossessionTicks) * 100)
      : 50;
    const awayPossessionPercent = 100 - homePossessionPercent;

    // Precisão de passe (estimativa — em produção, usar statDeltas acumulados)
    const homePassAccuracy = homePasses > 0 ? Math.round((homePassesOk / homePasses) * 100) : 0;
    const awayPassAccuracy = awayPasses > 0 ? Math.round((awayPassesOk / awayPasses) * 100) : 0;

    // Fallback: se não há dados de passe, estima baseado em posse
    const homePassAccuracyFinal = homePassAccuracy > 0 ? homePassAccuracy : Math.max(65, homePossessionPercent - 10);
    const awayPassAccuracyFinal = awayPassAccuracy > 0 ? awayPassAccuracy : Math.max(65, awayPossessionPercent - 10);

    return {
      possession: { home: homePossessionPercent, away: awayPossessionPercent },
      shots: { home: homeShots, away: awayShots },
      shotsOnTarget: { home: homeShotsOnTarget, away: awayShotsOnTarget },
      passAccuracy: { home: homePassAccuracyFinal, away: awayPassAccuracyFinal },
      tackles: { home: homeTackles, away: awayTackles },
      fouls: { home: homeFouls, away: awayFouls },
    };
  }, [liveSnap]);
}

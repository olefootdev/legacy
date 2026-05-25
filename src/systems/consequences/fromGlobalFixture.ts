/**
 * Bridge: GlobalFixture finalizado → MatchSummaryForImpact.
 *
 * Espelha `fromLiveMatch.ts` mas pra Liga Global (que NÃO dispara FINALIZE_MATCH).
 * Sem isso, as 12 partidas/hora do modo principal não geravam consequências.
 *
 * Importante: apenas o LADO DO MANATO gera consequências (RLS server-side
 * recusa writes em outros manager_id mesmo se tentar).
 */
import type { GlobalFixture } from '@/match/globalMatch';
import type { MatchSummaryForImpact } from './handlers';

export interface BuildGlobalImpactSummaryOpts {
  fixture: GlobalFixture;
  managerId: string;
  clubId: string;
  /** ID do time do manager (pra detectar qual lado é "nosso"). */
  myTeamId: string;
  /** Vermelhos do mesmo jogador nos últimos 7 dias. */
  redCardLast7dPlayerIds?: string[];
  /** Marca como clássico. */
  isClassic?: boolean;
}

/**
 * Retorna `null` se o fixture não envolve o manager (defesa contra
 * processar partidas alheias).
 */
export function buildGlobalImpactSummary(
  opts: BuildGlobalImpactSummaryOpts,
): MatchSummaryForImpact | null {
  const { fixture, myTeamId } = opts;
  const isHome = fixture.homeTeamId === myTeamId;
  const isAway = fixture.awayTeamId === myTeamId;
  if (!isHome && !isAway) return null;

  const ourSide = isHome ? 'home' : 'away';
  const scoreFor = isHome ? fixture.scoreHome : fixture.scoreAway;
  const scoreAgainst = isHome ? fixture.scoreAway : fixture.scoreHome;

  const redCardPlayerIds: string[] = [];
  const injuries: MatchSummaryForImpact['injuries'] = [];
  const goalCount = new Map<string, number>();

  for (const e of fixture.events ?? []) {
    if (e.side !== ourSide) continue;
    if (!e.playerId) continue;
    if (e.type === 'red_card') {
      redCardPlayerIds.push(e.playerId);
    } else if (e.type === 'injury') {
      injuries.push({ playerId: e.playerId, severity: 'light' });
    } else if (e.type === 'goal') {
      goalCount.set(e.playerId, (goalCount.get(e.playerId) ?? 0) + 1);
    }
  }

  const hatTrickPlayerIds: string[] = [];
  for (const [pid, count] of goalCount) {
    if (count >= 3) hatTrickPlayerIds.push(pid);
  }

  // MVP: top scorer do nosso lado (proxy simples — não temos scoutMvp aqui)
  let mvpPlayerId: string | undefined;
  let topGoals = 0;
  for (const [pid, count] of goalCount) {
    if (count > topGoals) {
      topGoals = count;
      mvpPlayerId = pid;
    }
  }

  return {
    managerId: opts.managerId,
    clubId: opts.clubId,
    matchId: fixture.id,
    scoreFor,
    scoreAgainst,
    redCardPlayerIds,
    redCardLast7dPlayerIds: opts.redCardLast7dPlayerIds,
    hatTrickPlayerIds,
    mvpPlayerId,
    injuries,
    // Sem dados de fadiga em fixture global; engine atual não rastreia
    exhaustedPlayerIds: [],
    isClassic: opts.isClassic,
  };
}

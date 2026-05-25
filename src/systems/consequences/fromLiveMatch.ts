/**
 * Bridge: LiveMatchSnapshot finalizado → MatchSummaryForImpact (OLEFOOT PYTHON MODE).
 *
 * Espelha o padrão de `src/systems/playerHealth/fromLiveMatch.ts` mas
 * extrai apenas dados ricos pra alimentar o sistema de consequências
 * persistentes (cartões, lesões, MVP, hat-tricks, goleadas).
 */
import type { LiveMatchSnapshot } from '@/engine/types';
import type { ScoutMvpEntry } from '@/gamespirit/scoutScoring';
import type { MatchSummaryForImpact } from './handlers';

export interface BuildImpactSummaryOpts {
  lm: LiveMatchSnapshot;
  /** Aceita qualquer objeto com `.mvp` (computeMatchMvp ou MatchScoutResult). */
  scoutResult: { mvp?: ScoutMvpEntry | null } | { mvp: ScoutMvpEntry; top3: ScoutMvpEntry[] };
  managerId: string;
  clubId: string;
  matchId: string;
  /** Vermelhos do mesmo jogador nos últimos 7 dias (de fora — query externa). */
  redCardLast7dPlayerIds?: string[];
  /** Marca como clássico (rival declarado, decisão de título, etc.). */
  isClassic?: boolean;
}

/**
 * Constrói `MatchSummaryForImpact` a partir do snapshot finalizado.
 * Foco: lado do clube do manager (homeXxx) — o engine atual só persiste
 * estado nosso, não do oponente.
 */
export function buildImpactSummary(opts: BuildImpactSummaryOpts): MatchSummaryForImpact {
  const { lm, scoutResult, managerId, clubId, matchId } = opts;

  const redCardPlayerIds: string[] = [];
  const injuries: MatchSummaryForImpact['injuries'] = [];

  for (const e of lm.events ?? []) {
    if (!e.playerId) continue;
    if (e.kind === 'red_home') {
      redCardPlayerIds.push(e.playerId);
    } else if (e.kind === 'injury_home') {
      // Mapa simples: tudo "injury_home" hoje = leve. Engine pode evoluir
      // pra emitir severidade — depois adapta-se aqui.
      injuries.push({ playerId: e.playerId, severity: 'light' });
    }
  }

  // Hat-trick: contar gols do mesmo jogador
  const goalCount = new Map<string, number>();
  for (const e of lm.events ?? []) {
    if (e.kind !== 'goal_home') continue;
    if (!e.playerId) continue;
    goalCount.set(e.playerId, (goalCount.get(e.playerId) ?? 0) + 1);
  }
  const hatTrickPlayerIds: string[] = [];
  for (const [pid, count] of goalCount) {
    if (count >= 3) hatTrickPlayerIds.push(pid);
  }

  // Exaustão: jogador com km muito alto (proxy de fadiga ≥95%)
  const exhaustedPlayerIds: string[] = [];
  for (const [pid, stat] of Object.entries(lm.homeStats ?? {})) {
    const km = stat?.km ?? 0;
    if (km >= 12) exhaustedPlayerIds.push(pid);
  }

  return {
    managerId,
    clubId,
    matchId,
    scoreFor: lm.homeScore ?? 0,
    scoreAgainst: lm.awayScore ?? 0,
    redCardPlayerIds,
    redCardLast7dPlayerIds: opts.redCardLast7dPlayerIds,
    hatTrickPlayerIds,
    mvpPlayerId: scoutResult.mvp?.playerId ?? undefined,
    injuries,
    exhaustedPlayerIds,
    isClassic: opts.isClassic,
  };
}

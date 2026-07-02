/**
 * globalLeagueRanking — ranking MUNDIAL por ÍNDICE COMPOSTO.
 *
 * Ordena os times reais da Liga Global por uma MÉDIA de três fatores, cada um
 * normalizado 0-100 relativo ao maior valor entre os times (pra somar coisas de
 * escalas diferentes de forma justa):
 *
 *   • Pontos da temporada  (competição atual — zera a cada reset)
 *   • Força / OVR do time  (qualidade do elenco)
 *   • Engajamento          (0-100, proxy de investimento/EXP do manager)
 *
 * Índice = média dos três normalizados (0-100). É isso que dita o 1º lugar.
 * Os PONTOS da temporada aparecem na Liga Global (/match/global); aqui é o índice.
 */

import type { GlobalTeam } from '@/match/globalLeagueMVP';

export interface GlobalRankingEntry {
  team: string;
  /** Índice composto 0-100 (o score do ranking). */
  score: number;
  isMe: boolean;
  entryId: string;
  division?: number;
  /** Componentes brutos (pra detalhar no card). */
  points: number;
  overall: number;
  engagement: number;
}

/** Normaliza um valor 0..max → 0..100 (max=0 vira 0 pra todos). */
function norm(value: number, max: number): number {
  return max > 0 ? (Math.max(0, value) / max) * 100 : 0;
}

/**
 * Constrói o ranking por índice composto (pontos + força + engajamento).
 * `managerId` casa o "meu time" pelo mesmo critério do resto do app
 * (managerProfile.email ?? club.id → GlobalTeam.managerId).
 */
export function getGlobalLeagueRankingEntries(
  teams: GlobalTeam[] | undefined,
  managerId: string | undefined,
  myClubId: string,
): GlobalRankingEntry[] {
  if (!teams || teams.length === 0) return [];
  // Máximos pra normalização relativa (o líder de cada fator vira 100).
  const maxPoints = Math.max(...teams.map((t) => t.points ?? 0), 0);
  const maxOverall = Math.max(...teams.map((t) => t.overall ?? 0), 0);
  const maxEngagement = Math.max(...teams.map((t) => t.engagementScore ?? 0), 0);

  const rows: GlobalRankingEntry[] = teams.map((t) => {
    const points = t.points ?? 0;
    const overall = t.overall ?? 0;
    const engagement = t.engagementScore ?? 0;
    const score = (norm(points, maxPoints) + norm(overall, maxOverall) + norm(engagement, maxEngagement)) / 3;
    return {
      team: t.clubName,
      score: Math.round(score * 10) / 10, // 1 casa decimal
      isMe: (!!managerId && t.managerId === managerId) || t.id === myClubId,
      entryId: t.id,
      division: t.division,
      points, overall, engagement,
    };
  });
  return rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.points - a.points ||
      b.overall - a.overall ||
      a.team.localeCompare(b.team),
  );
}

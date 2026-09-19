/**
 * Tabela da DIVISÃO do manager, pela regra que de fato promove (A VIRADA · V4).
 *
 * `getGlobalLeagueRankingEntries` ordena por uma nota composta (pontos +
 * overall + engajamento) — serve pro ranking geral, mas NÃO é a classificação
 * que decide quem sobe. Quem sobe é decidido em `applyPromotionRelegation`
 * (match/globalLeagueMVP.ts): pontos > vitórias > saldo > gols pró > nome, e os
 * `ceil(n × promotionPercentage)` primeiros de cada divisão abaixo da Elite.
 * Esta função repete exatamente essa ordem pra "zona de acesso" da Home não
 * mentir.
 *
 * Pura: sem store, sem React — `npm run test:division-standings`.
 */
export interface StandingsTeam {
  id: string;
  managerId: string;
  clubName: string;
  division?: number;
  points: number;
  wins: number;
  goalDifference: number;
  goalsFor: number;
}

export interface StandingRow {
  id: string;
  team: string;
  points: number;
  /** 1-based, dentro da divisão. */
  pos: number;
  isMe: boolean;
}

export interface DivisionView {
  division: number;
  size: number;
  /** Quantos sobem (0 na divisão de cima). */
  promotionCount: number;
  me: StandingRow;
  /** Janela de até 5 linhas em volta do manager, já com `pos`. */
  window: StandingRow[];
  /**
   * Depois de qual `pos` desenhar a linha da zona de acesso, se ela cair
   * dentro da janela. null = linha fora da janela (ou divisão sem acesso).
   */
  zoneAfterPos: number | null;
  /** Pontos que faltam pro último da zona (0 = empatado). null = já está na zona. */
  pointsToZone: number | null;
  /** Pontos do último clube da zona — alvo da barra de progresso. */
  zoneTargetPoints: number | null;
}

export function sortStandings<T extends StandingsTeam>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubName.localeCompare(b.clubName);
  });
}

export function buildDivisionView(args: {
  teams: readonly StandingsTeam[] | undefined;
  /** Mesma identidade do ranking: e-mail do perfil ou id do clube. */
  managerId: string | null | undefined;
  myClubId: string;
  promotionPercentage: number | undefined;
  windowSize?: number;
}): DivisionView | null {
  const teams = args.teams ?? [];
  const mine = teams.find(
    (t) => (!!args.managerId && t.managerId === args.managerId) || t.id === args.myClubId,
  );
  if (!mine || mine.division == null) return null;
  const division = mine.division;

  const sorted = sortStandings(teams.filter((t) => t.division === division));
  const size = sorted.length;
  const myIdx = sorted.findIndex((t) => t.id === mine.id);
  if (myIdx < 0) return null;

  const pct = args.promotionPercentage ?? 0.1;
  const promotionCount = division > 1 ? Math.min(size, Math.ceil(size * pct)) : 0;

  const rows: StandingRow[] = sorted.map((t, i) => ({
    id: t.id,
    team: t.clubName,
    points: t.points,
    pos: i + 1,
    isMe: i === myIdx,
  }));

  const windowSize = Math.max(1, args.windowSize ?? 5);
  let start = Math.max(0, myIdx - Math.floor(windowSize / 2));
  const end = Math.min(size, start + windowSize);
  start = Math.max(0, end - windowSize);
  const window = rows.slice(start, end);

  const lastZonePos = promotionCount; // pos (1-based) do último que sobe
  const zoneAfterPos =
    promotionCount > 0 &&
    lastZonePos < size &&
    window.some((r) => r.pos === lastZonePos) &&
    window.some((r) => r.pos === lastZonePos + 1)
      ? lastZonePos
      : null;

  const inZone = promotionCount > 0 && myIdx < promotionCount;
  const zoneTarget = promotionCount > 0 ? sorted[promotionCount - 1]!.points : null;
  const pointsToZone =
    promotionCount === 0 || inZone ? null : Math.max(0, (zoneTarget ?? 0) - mine.points);

  return {
    division,
    size,
    promotionCount,
    me: rows[myIdx]!,
    window,
    zoneAfterPos,
    pointsToZone,
    zoneTargetPoints: zoneTarget,
  };
}

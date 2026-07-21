/**
 * Tipos e filtros do ranking usado na Home (busca de adversário pra amistoso).
 *
 * 2026-07-20: os mocks WORLD_TEAMS (zerados) e o preview fake da Home saíram —
 * a fonte real agora é a Liga Global via `getGlobalLeagueRankingEntries`
 * (`src/ranking/globalLeagueRanking.ts`), a MESMA do /competicao/ranking.
 * Este módulo mantém só o shape `RankingEntry` + o filtro de busca.
 */

export type RankingEntry = {
  team: string;
  /** Pontos exibidos na lista (Liga Global = pontos da temporada). */
  exp: number;
  isMe: boolean;
  /** Identificador estável para convite de amistoso (id persistido do time). */
  entryId: string;
};

/** Adversários do ranking cujo nome ou entryId contém a busca (exclui o próprio clube). */
export function filterOpponentRankingMatches(entries: RankingEntry[], query: string, limit = 12): RankingEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries
    .filter((r) => !r.isMe && (r.team.toLowerCase().includes(q) || r.entryId.toLowerCase().includes(q)))
    .slice(0, limit);
}

/**
 * Ranking mundial OLE (EXP) — dados de mundo + clube do manager.
 * Fonte única para Home (preview) e página /ranking.
 */

export type RankingEntry = {
  team: string;
  exp: number;
  isMe: boolean;
  /** Identificador estável para convite de amistoso (clube real = id persistido; mundo mock = slug). */
  entryId: string;
};

function worldEntryId(team: string): string {
  const slug = team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `world:${slug || 'team'}`;
}

/**
 * Times do mundo — zerado pra deploy de testes online.
 * Ranking começa só com o próprio manager; população real virá de
 * `ranking_world_teams` no Supabase quando houver managers suficientes.
 * Histórico com os 24 mocks (Nova Empire, Spartans, Titans FC, etc.) está no git.
 */
const WORLD_TEAMS: { team: string; exp: number }[] = [];

/**
 * Lista completa ordenada por EXP (maior primeiro), com o teu clube incluído.
 */
export function getFullRankingEntries(clubName: string, managerOle: number, clubId: string): RankingEntry[] {
  const world: RankingEntry[] = WORLD_TEAMS.map((r) => ({
    team: r.team,
    exp: r.exp,
    isMe: false,
    entryId: worldEntryId(r.team),
  }));
  const withManager: RankingEntry[] = [
    { team: clubName, exp: Math.round(managerOle), isMe: true, entryId: clubId },
    ...world,
  ];
  return [...withManager].sort((a, b) => b.exp - a.exp);
}

/** Adversários do ranking cujo nome ou entryId contém a busca (exclui o próprio clube). */
export function filterOpponentRankingMatches(entries: RankingEntry[], query: string, limit = 12): RankingEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries
    .filter((r) => !r.isMe && (r.team.toLowerCase().includes(q) || r.entryId.toLowerCase().includes(q)))
    .slice(0, limit);
}

export type HomePreviewRow = RankingEntry & { rank: number };

/**
 * Preview da Home: top 5 mundiais fixos + até 5 posições entre o resto
 * (busca + favoritos entre pos. 6+).
 */
export function buildHomeRankingPreview(
  fullSorted: RankingEntry[],
  searchQuery: string,
  favoriteTeams: Set<string>,
): HomePreviewRow[] {
  const top5 = fullSorted.slice(0, 5);
  const q = searchQuery.trim().toLowerCase();
  const rest = fullSorted
    .slice(5)
    .filter((r) => (q ? r.team.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      const af = favoriteTeams.has(a.team) ? 1 : 0;
      const bf = favoriteTeams.has(b.team) ? 1 : 0;
      if (af !== bf) return bf - af;
      return b.exp - a.exp;
    })
    .slice(0, 5);
  return [...top5, ...rest].map((row, i) => ({ ...row, rank: i + 1 }));
}

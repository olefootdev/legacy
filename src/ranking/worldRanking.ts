/**
 * Ranking mundial OLE (EXP) — dados de mundo + clube do manager.
 * Fonte única para Home (preview) e página /ranking.
 */

export type RankingEntry = {
  team: string;
  exp: number;
  isMe: boolean;
};

/** Times do mundo (mock) com EXP base — o manager é injetado em merge. */
const WORLD_TEAMS: { team: string; exp: number }[] = [
  { team: 'Nova Empire', exp: 198450 },
  { team: 'Black Hawks', exp: 193220 },
  { team: 'Urban Legends', exp: 189030 },
  { team: 'Royal Titans', exp: 186910 },
  { team: 'Storm Eleven', exp: 181740 },
  { team: 'Thunder FC', exp: 173800 },
  { team: 'Night Owls', exp: 169300 },
  { team: 'Blue Orbit', exp: 162440 },
  { team: 'Spartans', exp: 158900 },
  { team: 'Dragons', exp: 155220 },
  { team: 'Wolves', exp: 149500 },
  { team: 'Falcons', exp: 145080 },
  { team: 'Titans FC', exp: 141900 },
  { team: 'River North', exp: 138200 },
  { team: 'Solar SC', exp: 134550 },
  { team: 'Iron Gate', exp: 130100 },
  { team: 'Crimson XI', exp: 126800 },
  { team: 'Pacific FC', exp: 122400 },
  { team: 'Metro United', exp: 118900 },
  { team: 'Atlas City', exp: 115300 },
  { team: 'Vertex', exp: 111700 },
  { team: 'Lynx SC', exp: 108200 },
  { team: 'Quartz FC', exp: 104600 },
  { team: 'Harbor Line', exp: 101000 },
];

/**
 * Lista completa ordenada por EXP (maior primeiro), com o teu clube incluído.
 */
export function getFullRankingEntries(clubName: string, managerOle: number): RankingEntry[] {
  const world: RankingEntry[] = WORLD_TEAMS.map((r) => ({
    team: r.team,
    exp: r.exp,
    isMe: false,
  }));
  const withManager: RankingEntry[] = [
    { team: clubName, exp: Math.round(managerOle), isMe: true },
    ...world,
  ];
  return [...withManager].sort((a, b) => b.exp - a.exp);
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

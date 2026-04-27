/**
 * Ranking agregado por pontos nas competições ADMIN com um dado âmbito (estadual / nacional).
 */

import type { AdminLeagueConfig, LeagueScope } from '@/match/adminLeagues';
import { standingsRowsForDisplay } from '@/match/adminLeagues';
import type { LeagueSeasonState } from '@/match/leagueSeason';

export type LeagueScopeRankingEntry = {
  team: string;
  /** Soma de pontos nas tabelas desse âmbito (várias competições). */
  points: number;
  isMe: boolean;
  entryId: string;
};

function scopeEntryId(scope: LeagueScope, team: string): string {
  const slug = team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `league-scope:${scope}:${slug || 'team'}`;
}

function teamIsManagerClub(teamName: string, clubName: string, clubShort: string): boolean {
  const u = clubName.trim().toUpperCase();
  const s = clubShort.trim().toUpperCase();
  const t = teamName.trim().toUpperCase();
  return t === u || t === s || (s.length > 0 && t.includes(s)) || (u.length > 0 && t.includes(u));
}

/**
 * Agrega pontos de todas as competições com o mesmo `scope` (exceto mundial).
 */
export function getLeagueScopeRankingEntries(
  adminLeagues: AdminLeagueConfig[],
  scope: Exclude<LeagueScope, 'world'>,
  clubName: string,
  clubShort: string,
  leagueSeason: LeagueSeasonState,
): LeagueScopeRankingEntry[] {
  const byKey = new Map<string, { team: string; points: number }>();

  for (const lg of adminLeagues) {
    if (lg.scope !== scope) continue;
    const rows = standingsRowsForDisplay(lg, clubName, clubShort, leagueSeason);
    for (const r of rows) {
      const key = r.name.trim().toUpperCase();
      const cur = byKey.get(key);
      const pts = r.points;
      if (!cur) byKey.set(key, { team: r.name, points: pts });
      else cur.points += pts;
    }
  }

  const list: LeagueScopeRankingEntry[] = [...byKey.values()].map((v) => ({
    team: v.team,
    points: v.points,
    isMe: teamIsManagerClub(v.team, clubName, clubShort),
    entryId: scopeEntryId(scope, v.team),
  }));

  return list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.team.localeCompare(b.team, 'pt-BR');
  });
}

import { apiFootballGet } from './client';
import { apiFootballSeasonYear } from './season';
import type { ApiCountry, ApiLeagueEntry, ApiTeamEntry } from './types';

export async function fetchCountries(): Promise<ApiCountry[]> {
  return apiFootballGet<ApiCountry[]>('/countries');
}

export async function fetchLeaguesByCountry(country: string): Promise<ApiLeagueEntry[]> {
  const season = apiFootballSeasonYear();
  /** API aceita `type: league` (minúsculas); fallback sem filtro se a lista vier vazia. */
  let rows = await apiFootballGet<ApiLeagueEntry[]>('/leagues', { country, season, type: 'league' });
  if (!rows?.length) {
    rows = await apiFootballGet<ApiLeagueEntry[]>('/leagues', { country, season });
  }
  return rows ?? [];
}

export async function fetchTeamsByLeague(leagueId: number): Promise<ApiTeamEntry[]> {
  const season = apiFootballSeasonYear();
  return apiFootballGet<ApiTeamEntry[]>('/teams', { league: leagueId, season });
}

export async function searchTeams(query: string): Promise<ApiTeamEntry[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return apiFootballGet<ApiTeamEntry[]>('/teams', { search: q });
}

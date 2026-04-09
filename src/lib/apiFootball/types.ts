/** Resposta genérica API-Sports / API-Football v3. */

export interface ApiFootballEnvelope<T> {
  get?: string;
  parameters: Record<string, unknown>;
  errors: unknown;
  results: number;
  paging?: { current: number; total: number };
  response: T;
}

export interface ApiCountry {
  name: string;
  code: string;
  flag: string | null;
}

export interface ApiLeagueEntry {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string | null;
  };
  country: { name: string; code: string; flag: string | null };
  seasons?: Array<{ year: number; start: string; end: string }>;
}

export interface ApiTeamEntry {
  team: {
    id: number;
    name: string;
    code: string | null;
    logo: string | null;
  };
}

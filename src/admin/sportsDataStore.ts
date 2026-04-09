/**
 * Sports Data — base curada de ligas + clubes reais.
 * Persistência via localStorage (padrão platformStore).
 * Alimentada manualmente no Admin via JSON; consumida no Cadastro.
 */
import { useSyncExternalStore } from 'react';
import seedData from './sportsDataSeed.json';

const STORAGE_KEY = 'olefoot-sports-data-v1';

export interface SportsClub {
  id: string;
  name: string;
  short_name: string;
  city: string;
  country: string;
  logo_url?: string | null;
}

export interface SportsLeague {
  id: string;
  name: string;
  country: string;
  season: string;
  clubs: SportsClub[];
}

export interface SportsDataState {
  version: 1;
  leagues: SportsLeague[];
}

function emptyState(): SportsDataState {
  return { version: 1, leagues: [] };
}

function seedState(): SportsDataState {
  return { version: 1, leagues: seedData.leagues as SportsLeague[] };
}

function loadState(): SportsDataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as SportsDataState;
    if (parsed.version !== 1 || !Array.isArray(parsed.leagues)) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    return seedState();
  }
}

function saveState(s: SportsDataState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full / private mode */
  }
}

let state = loadState();
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function getSnapshot(): SportsDataState {
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSportsDataStore<T>(selector: (s: SportsDataState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()));
}

export function getSportsDataSnapshot(): SportsDataState {
  return state;
}

/** Valida e importa JSON (upsert por id). Retorna { added, updated, errors }. */
export function importSportsDataJson(json: unknown): { added: number; updated: number; errors: string[] } {
  const errors: string[] = [];

  if (!json || typeof json !== 'object') {
    return { added: 0, updated: 0, errors: ['JSON inválido: esperado objeto com campo "leagues".'] };
  }

  const obj = json as Record<string, unknown>;
  const leaguesRaw = obj.leagues;
  if (!Array.isArray(leaguesRaw)) {
    return { added: 0, updated: 0, errors: ['Campo "leagues" deve ser um array.'] };
  }

  let added = 0;
  let updated = 0;
  const next = { ...state, leagues: [...state.leagues] };
  const existingMap = new Map(next.leagues.map((l, i) => [l.id, i]));

  for (let li = 0; li < leaguesRaw.length; li++) {
    const raw = leaguesRaw[li];
    if (!raw || typeof raw !== 'object') {
      errors.push(`leagues[${li}]: entrada inválida (não é objeto).`);
      continue;
    }
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!id || !name) {
      errors.push(`leagues[${li}]: falta "id" ou "name".`);
      continue;
    }

    const clubs: SportsClub[] = [];
    if (Array.isArray(entry.clubs)) {
      for (let ci = 0; ci < (entry.clubs as unknown[]).length; ci++) {
        const cr = (entry.clubs as unknown[])[ci];
        if (!cr || typeof cr !== 'object') {
          errors.push(`leagues[${li}].clubs[${ci}]: entrada inválida.`);
          continue;
        }
        const c = cr as Record<string, unknown>;
        const cid = typeof c.id === 'string' ? c.id.trim() : '';
        const cname = typeof c.name === 'string' ? c.name.trim() : '';
        if (!cid || !cname) {
          errors.push(`leagues[${li}].clubs[${ci}]: falta "id" ou "name".`);
          continue;
        }
        clubs.push({
          id: cid,
          name: cname,
          short_name: typeof c.short_name === 'string' ? c.short_name.trim() : cname,
          city: typeof c.city === 'string' ? c.city.trim() : '',
          country: typeof c.country === 'string' ? c.country.trim() : '',
          logo_url: typeof c.logo_url === 'string' ? c.logo_url.trim() || null : null,
        });
      }
    }

    const league: SportsLeague = {
      id,
      name,
      country: typeof entry.country === 'string' ? entry.country.trim() : '',
      season: typeof entry.season === 'string' ? entry.season.trim() : '',
      clubs,
    };

    const existingIdx = existingMap.get(id);
    if (existingIdx !== undefined) {
      const existing = next.leagues[existingIdx]!;
      const mergedClubs = mergeClubs(existing.clubs, clubs);
      next.leagues[existingIdx] = { ...league, clubs: mergedClubs };
      updated++;
    } else {
      next.leagues.push(league);
      existingMap.set(id, next.leagues.length - 1);
      added++;
    }
  }

  state = next;
  saveState(state);
  notify();
  return { added, updated, errors };
}

function mergeClubs(existing: SportsClub[], incoming: SportsClub[]): SportsClub[] {
  const map = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) {
    map.set(c.id, c);
  }
  return Array.from(map.values());
}

export function removeSportsLeague(leagueId: string) {
  state = { ...state, leagues: state.leagues.filter((l) => l.id !== leagueId) };
  saveState(state);
  notify();
}

export function clearAllSportsData() {
  state = emptyState();
  saveState(state);
  notify();
}

/**
 * Troféus memoráveis: apenas títulos de liga / copa / supercopa (não missões nem marcos de temporada).
 * IDs persistidos em `OlefootGameState.memorableTrophyUnlockedIds`.
 */

export const MEMORABLE_TROPHY_SLOTS = [
  {
    id: 'mem_liga_ole',
    name: 'Campeão da Liga',
    blurb: 'Título da liga principal OLE.',
  },
  {
    id: 'mem_copa_ole',
    name: 'Copa OLE',
    blurb: 'Taça de mata-mata.',
  },
  {
    id: 'mem_supercopa_ole',
    name: 'Supercopa',
    blurb: 'Confronto entre campeões.',
  },
] as const;

export type MemorableTrophyId = (typeof MEMORABLE_TROPHY_SLOTS)[number]['id'];

/** Mínimos para considerar “título de liga” no MVP (ajustável). */
const LIGA_TITLE_MIN_POINTS = 24;
const LIGA_TITLE_MIN_PLAYED = 8;

/**
 * Após vitória em partida finalizada: pode acrescentar IDs memoráveis (sem remover).
 */
export function appendMemorableTrophyUnlocks(
  prev: string[],
  args: {
    homeWin: boolean;
    competition: string;
    leaguePoints: number;
    leaguePlayed: number;
  },
): string[] {
  if (!args.homeWin) return [...prev];
  const set = new Set(prev);
  const c = args.competition.toLowerCase();

  if (c.includes('liga') && args.leaguePoints >= LIGA_TITLE_MIN_POINTS && args.leaguePlayed >= LIGA_TITLE_MIN_PLAYED) {
    set.add('mem_liga_ole');
  }
  if (c.includes('copa')) {
    set.add('mem_copa_ole');
  }
  if (c.includes('supercop') || c.includes('supercopa') || c.includes('super copa')) {
    set.add('mem_supercopa_ole');
  }

  return [...set];
}

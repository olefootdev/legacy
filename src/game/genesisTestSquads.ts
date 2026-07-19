import { buildDefaultLineup } from '@/entities/lineup';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import type { GameAction } from '@/game/types';
import { dispatchGame, getGameState } from '@/game/store';
import { isSupabaseConfigured } from '@/supabase/client';
import {
  fetchGenesisMarketPlayerRowsOrdered,
  mergeGenesisRowWithSavedPlayer,
  splitGenesisRowsIntoTwoBalancedSquads,
} from '@/supabase/genesisMarket';

const OPP_ID = 'genesis-test-b';
const OPP_NAME = 'Genesis Beta FC';
const OPP_SHORT = 'GNS-B';

let hydrateInFlight = false;
let portraitSyncInFlight = false;

function squadStrength(players: import('@/entities/types').PlayerEntity[]): number {
  if (!players.length) return 72;
  const sum = players.reduce((acc, p) => acc + (p.mintOverall ?? overallFromAttributes(p.attrs, p.pos)), 0);
  return Math.min(99, Math.max(40, Math.round(sum / players.length)));
}

function pickHighlight(players: import('@/entities/types').PlayerEntity[]): { name: string; ovr: number } {
  const atas = players.filter((p) => p.pos?.toUpperCase() === 'ATA');
  const pool = atas.length ? atas : players;
  let best = pool[0]!;
  let bestOvr = best.mintOverall ?? overallFromAttributes(best.attrs, best.pos);
  for (const p of pool) {
    const o = p.mintOverall ?? overallFromAttributes(p.attrs, p.pos);
    if (o > bestOvr) {
      best = p;
      bestOvr = o;
    }
  }
  return { name: best.name.split(/\s+/).pop() ?? best.name, ovr: bestOvr };
}

/**
 * Carrega `genesis_market_players`, substitui o plantel local por apenas jogadores do DB (`genesis-*`)
 * e define o adversário com `genesisAwayPlayers` para o motor. Preserva fadiga/XP/lesão do save.
 */
export async function applyGenesisTestSquads(
  dispatch: (a: GameAction) => void,
  currentPlayers: Record<string, import('@/entities/types').PlayerEntity>,
): Promise<boolean> {
  if (hydrateInFlight) return false;
  if (!isSupabaseConfigured()) return false;
  hydrateInFlight = true;
  try {
    const rows = await fetchGenesisMarketPlayerRowsOrdered();
    if (rows.length < 22) {
      console.warn('[genesisTestSquads] catálogo insuficiente para dois XI:', rows.length);
      return false;
    }
    const { homeRows, awayRows } = splitGenesisRowsIntoTwoBalancedSquads(rows);
    const home = homeRows.map((row) =>
      mergeGenesisRowWithSavedPlayer(row, currentPlayers[`genesis-${row.id}`]),
    );
    const away = awayRows.map((row) =>
      mergeGenesisRowWithSavedPlayer(row, currentPlayers[`genesis-${row.id}`]),
    );
    const homeMap = Object.fromEntries(home.map((p) => [p.id, p]));
    dispatch({ type: 'SET_PLAYERS_RECORD', players: homeMap });
    dispatch({
      type: 'SET_LINEUP',
      lineup: buildDefaultLineup(homeMap),
      formationScheme: '4-3-3',
    });
    dispatch({
      type: 'ADMIN_PATCH_NEXT_FIXTURE',
      partial: {
        awayName: OPP_NAME,
        opponent: {
          id: OPP_ID,
          name: OPP_NAME,
          shortName: OPP_SHORT,
          strength: squadStrength(away),
          highlightPlayer: pickHighlight(away),
          supporterCrestUrl: null,
          genesisAwayPlayers: away,
        },
      },
    });
    return true;
  } finally {
    hydrateInFlight = false;
  }
}

function portraitPairKey(p: PlayerEntity): string {
  return `${p.portraitUrl ?? ''}|${p.portraitTokenUrl ?? ''}`;
}

/**
 * Reconcilia `portraitUrl` / `portraitTokenUrl` (e resto do merge catálogo + save) com `genesis_market_players`
 * no Supabase. O plantel persiste em localStorage: depois de mudares fotos no Admin, o jogo não voltava a
 * importar as colunas até isto correr.
 */
export async function syncGenesisRosterPortraitsFromSupabase(): Promise<void> {
  if (portraitSyncInFlight || !isSupabaseConfigured()) return;
  const st = getGameState();
  const genesisPids = Object.keys(st.players).filter((id) => id.startsWith('genesis-'));
  const away = st.nextFixture?.opponent?.genesisAwayPlayers;
  const hasAwayGenesis = away?.some((p) => p.id.startsWith('genesis-'));
  if (!genesisPids.length && !hasAwayGenesis) return;

  portraitSyncInFlight = true;
  try {
    const rows = await fetchGenesisMarketPlayerRowsOrdered();
    if (!rows.length) return;
    const byCatalogId = new Map(rows.map((r) => [r.id, r]));

    const mergedHome: Record<string, PlayerEntity> = {};
    for (const pid of genesisPids) {
      const catalogId = pid.replace(/^genesis-/, '');
      const row = byCatalogId.get(catalogId);
      const saved = st.players[pid];
      if (!row || !saved) continue;
      const m = mergeGenesisRowWithSavedPlayer(row, saved);
      if (portraitPairKey(m) !== portraitPairKey(saved)) {
        mergedHome[pid] = m;
      }
    }
    if (Object.keys(mergedHome).length) {
      dispatchGame({ type: 'MERGE_PLAYERS', players: mergedHome });
    }

    if (away?.length) {
      const st2 = getGameState();
      const opp = st2.nextFixture?.opponent;
      const away2 = opp?.genesisAwayPlayers;
      if (away2?.length && opp) {
        let changed = false;
        const nextAway = away2.map((p) => {
          if (!p.id.startsWith('genesis-')) return p;
          const catalogId = p.id.replace(/^genesis-/, '');
          const row = byCatalogId.get(catalogId);
          if (!row) return p;
          const m = mergeGenesisRowWithSavedPlayer(row, p);
          if (portraitPairKey(m) !== portraitPairKey(p)) changed = true;
          return m;
        });
        if (changed) {
          dispatchGame({
            type: 'ADMIN_PATCH_NEXT_FIXTURE',
            partial: { opponent: { ...opp, genesisAwayPlayers: nextAway } },
          });
        }
      }
    }
  } finally {
    portraitSyncInFlight = false;
  }
}

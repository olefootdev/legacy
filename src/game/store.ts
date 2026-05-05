import { useCallback, useSyncExternalStore } from 'react';
import type { OlefootGameState } from './types';
import type { GameAction } from './types';
import { gameReducer } from './reducer';
import { loadGameState, saveGameState } from './persistence';
import { insertMatch } from '@/supabase/matchPersistence';
import { isSupabaseConfigured } from '@/supabase/client';
import { persistGlobalLeagueSnapshot } from '@/supabase/globalLeague';
import { persistManagerSquad } from '@/supabase/managerSquad';
import { persistManagerGameState, type ManagerGameStateSnapshot } from '@/supabase/managerGameState';

const GLOBAL_LEAGUE_PERSIST_ACTIONS = new Set<GameAction['type']>([
  'INIT_GLOBAL_LEAGUE_MVP',
  'REGISTER_GLOBAL_TEAM',
  'ADMIN_START_GLOBAL_PLAYOFFS',
  'START_GLOBAL_PLAYOFF_ROUND',
  'FINISH_GLOBAL_PLAYOFF_ROUND',
  'RESCHEDULE_PLAYOFF_ROUND',
  'SET_GLOBAL_LEAGUE_MVP_MIN_TEAMS',
  'GRANT_ONBOARDING_PACKAGE',
  'START_GLOBAL_LEAGUE_ROUND',
  'FINISH_GLOBAL_LEAGUE_ROUND',
  'APPLY_GLOBAL_PROMOTION_RELEGATION',
  'RESET_GLOBAL_LEAGUE_MVP',
]);

// Actions que disparam persistência dos slices críticos no Supabase
const GAME_STATE_PERSIST_ACTIONS = new Set<GameAction['type']>([
  'APPLY_MATCH_CONSEQUENCES',
  'FINALIZE_MATCH',
  'UPGRADE_STRUCTURE',
  'UNLOCK_TROPHY',
  'GRANT_EARNED_EXP',
  'ADMIN_GRANT_RESOURCES',
  'SET_OLEFOOT_LEAGUE',
  'SHOP_PURCHASE_ITEM',
  'APPLY_PLAYER_HEALTH_EVENTS',
  'TICK_TRAINING',
  'SET_STAFF',
  'SAVE_TACTIC',
  'DELETE_TACTIC',
  'SET_COMPETITIVE_RANKING',
  'UPDATE_OLEFOOT_RANKED',
]);

type Listener = () => void;

let state: OlefootGameState = loadGameState();
const listeners = new Set<Listener>();

// ─── Squad hydration gate ─────────────────────────────────────────────
// Impede que a cerimônia de onboarding abra antes do ManagerSquadHydrator
// terminar de verificar o Supabase (evita falso positivo de plantel vazio).
let squadHydrationDone = false;
const hydrationListeners = new Set<Listener>();

export function setSquadHydrationDone(): void {
  if (squadHydrationDone) return;
  squadHydrationDone = true;
  for (const l of hydrationListeners) l();
}

export function resetSquadHydrationDone(): void {
  squadHydrationDone = false;
  for (const l of hydrationListeners) l();
}

export function useSquadHydrationDone(): boolean {
  return useSyncExternalStore(
    (cb) => { hydrationListeners.add(cb); return () => hydrationListeners.delete(cb); },
    () => squadHydrationDone,
  );
}

function emit() {
  for (const l of listeners) l();
}

export function getGameState(): OlefootGameState {
  return state;
}

/** Substitui slices do estado vindo de hidratação remota (Supabase) sem
 *  reentrar no reducer. Usado pelo ManagerSquadHydrator no boot. */
export function applyHydratedSquad(input: {
  players: Record<string, OlefootGameState['players'][string]>;
  lineup: Record<string, string>;
  formationScheme: OlefootGameState['manager']['formationScheme'] | null;
}): void {
  state = {
    ...state,
    players: input.players,
    lineup: input.lineup,
    manager: input.formationScheme
      ? { ...state.manager, formationScheme: input.formationScheme }
      : state.manager,
  };
  saveGameState(state);
  emit();
}

/** Hidrata slices críticos vindos do Supabase sem reentrar no reducer. */
export function applyHydratedGameState(remote: ManagerGameStateSnapshot): void {
  const local = state;
  const hasLocalResults = local.results && local.results.length > 0;
  const hasLocalStructures = local.structures && Object.values(local.structures).some((v) => (v as number) > 1);
  const hasLocalTrophies = local.memorableTrophyUnlockedIds && local.memorableTrophyUnlockedIds.length > 0;

  state = {
    ...local,
    structures:                 (!hasLocalStructures && remote.structures)         ? remote.structures         : local.structures,
    leagueSeason:               remote.leagueSeason                                ? remote.leagueSeason       : local.leagueSeason,
    results:                    (!hasLocalResults && remote.results)               ? remote.results            : local.results,
    memorableTrophyUnlockedIds: (!hasLocalTrophies && remote.trophyIds)            ? remote.trophyIds          : local.memorableTrophyUnlockedIds,
    competitiveRanking:         remote.competitiveRanking                          ?? local.competitiveRanking,
    olefootRanked:              remote.olefootRanked                               ?? local.olefootRanked,
    playerHealth:               remote.playerHealth                                ?? local.playerHealth,
    playerSeasonLedger:         remote.playerSeasonLedger                          ?? local.playerSeasonLedger,
    playerMoral:                remote.playerMoral                                 ?? local.playerMoral,
    shopInventory:              remote.shopInventory                               ?? local.shopInventory,
    olefootLeague:              remote.olefootLeague                               ?? local.olefootLeague,
    managerRelationByPlayer:    remote.managerRelation                             ?? local.managerRelationByPlayer,
    manager: {
      ...local.manager,
      savedTactics: remote.savedTactics ?? local.manager.savedTactics,
      staff:        remote.staff        ?? local.manager.staff,
    },
  };
  saveGameState(state);
  emit();
}

// ─── Debounced manager_game_state persistence ─────────────────────────
let gameStatePersistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleGameStatePersist(): void {
  if (!isSupabaseConfigured()) return;
  if (gameStatePersistTimer) clearTimeout(gameStatePersistTimer);
  gameStatePersistTimer = setTimeout(() => {
    gameStatePersistTimer = null;
    void persistManagerGameState(state);
  }, 2000);
}


let lastPersistedPlayersRef: OlefootGameState['players'] | null = null;
let lastPersistedLineupRef: OlefootGameState['lineup'] | null = null;
let lastPersistedFormation: OlefootGameState['manager']['formationScheme'] | null = null;
let squadPersistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleManagerSquadPersist(): void {
  if (!isSupabaseConfigured()) return;
  const sliceChanged =
    state.players !== lastPersistedPlayersRef ||
    state.lineup !== lastPersistedLineupRef ||
    state.manager.formationScheme !== lastPersistedFormation;
  if (!sliceChanged) return;
  if (squadPersistTimer) clearTimeout(squadPersistTimer);
  squadPersistTimer = setTimeout(() => {
    squadPersistTimer = null;
    lastPersistedPlayersRef = state.players;
    lastPersistedLineupRef = state.lineup;
    lastPersistedFormation = state.manager.formationScheme;
    void persistManagerSquad({
      players: state.players,
      lineup: state.lineup,
      formationScheme: state.manager.formationScheme,
    });
  }, 1500);
}

export function dispatchGame(action: GameAction): void {
  state = gameReducer(state, action);
  if (action.type === 'START_LIVE_MATCH' && isSupabaseConfigured()) {
    const lm = state.liveMatch;
    const nonce = lm?.matchClientNonce;
    if (lm && nonce != null && !lm.supabaseMatchId) {
      void insertMatch({
        homeClubId: state.club.id,
        awayName: state.nextFixture.opponent.shortName,
        mode: lm.mode,
        simulationSeed: lm.simulationSeed,
      }).then((sbId) => {
        if (!sbId) return;
        const cur = getGameState().liveMatch;
        if (!cur || cur.supabaseMatchId || cur.matchClientNonce !== nonce) return;
        state = gameReducer(getGameState(), { type: 'SET_LIVE_MATCH_SUPABASE_ID', matchId: sbId, matchClientNonce: nonce });
        saveGameState(state);
        emit();
      });
    }
  }
  saveGameState(state);

  if (GLOBAL_LEAGUE_PERSIST_ACTIONS.has(action.type) && state.globalLeagueMVP) {
    void persistGlobalLeagueSnapshot(state.globalLeagueMVP);
  }

  if (GAME_STATE_PERSIST_ACTIONS.has(action.type)) {
    scheduleGameStatePersist();
  }

  scheduleManagerSquadPersist();

  emit();
}

export function subscribeGame(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGameStore<T>(selector: (s: OlefootGameState) => T): T {
  return useSyncExternalStore(
    subscribeGame,
    () => selector(state),
    () => selector(state),
  );
}

export function useGameDispatch() {
  return useCallback((a: GameAction) => dispatchGame(a), []);
}

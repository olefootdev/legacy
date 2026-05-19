import { useCallback, useSyncExternalStore } from 'react';
import type { OlefootGameState } from './types';
import type { GameAction } from './types';
import { gameReducer } from './reducer';
import { loadGameState, saveGameState } from './persistence';
import { insertMatch } from '@/supabase/matchPersistence';
import { isSupabaseConfigured } from '@/supabase/client';
import { persistManagerSquad } from '@/supabase/managerSquad';
import { persistManagerGameState, type ManagerGameStateSnapshot } from '@/supabase/managerGameState';

// Actions que disparam persistência dos slices críticos no Supabase
const GAME_STATE_PERSIST_ACTIONS = new Set<GameAction['type']>([
  'APPLY_MATCH_CONSEQUENCES',
  'FINALIZE_MATCH',
  'UPGRADE_STRUCTURE',
  'GRANT_EARNED_EXP',
  'ADMIN_GRANT_RESOURCES',
  'SET_OLEFOOT_LEAGUE',
  'SHOP_PURCHASE_ITEM',
  'SAVE_TACTIC_PLAN',
  // Academia OLE — queue + inbox persistem cross-browser
  'CREATE_MANAGER_PROSPECT',
  'ADMIN_PLAYER_CREATION_SET_PHOTO',
  'ADMIN_PLAYER_CREATION_SET_PROMOTIONAL',
  'ADMIN_PLAYER_CREATION_VALIDATE',
  'ADMIN_PLAYER_CREATION_APPROVE',
  'ADMIN_PLAYER_CREATION_LAUNCH',
  // Liga Global — marcos pagos persistem cross-browser (evita duplo claim)
  'CLAIM_GLOBAL_LEAGUE_MILESTONES',
  'CLAIM_GLOBAL_LEAGUE_MILESTONES_SILENT',
  // Liga Classic / Fast Liga — placar acumulado persiste cross-browser
  'RECORD_LOCAL_LEAGUE_RESULT',
  // Flag de onboarding (hasDoneOnboarding) — persistir cross-browser pra
  // cerimônia não reabrir após logout.
  'GRANT_ONBOARDING_PACKAGE',
  'SET_USER_SETTINGS',
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

/**
 * Faz MERGE de jogadores remotos no estado local: adiciona qualquer player
 * presente em `remotePlayers` que não esteja em `state.players`, sem
 * sobrescrever os que já existem localmente. Usado para recuperar jogadores
 * comprados que sumiram do localStorage por filtros antigos ou cache stale.
 *
 * Retorna a lista de IDs que foram recuperados (vazia se nada faltava).
 */
export function mergeRemoteSquadIntoLocal(
  remotePlayers: Record<string, OlefootGameState['players'][string]>,
): string[] {
  const localIds = new Set(Object.keys(state.players));
  const recovered: string[] = [];
  const next: typeof state.players = { ...state.players };
  for (const [id, p] of Object.entries(remotePlayers)) {
    if (!localIds.has(id)) {
      next[id] = p;
      recovered.push(id);
    }
  }
  if (recovered.length === 0) return [];
  state = { ...state, players: next };
  saveGameState(state);
  emit();
  return recovered;
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
    // Academy queue: merge defensivo — usa o array maior (evita perder
    // entries criadas em outro browser se o local tiver menos).
    managerProspectArtQueue:    mergeAcademyQueue(local.managerProspectArtQueue, remote.managerProspectArtQueue),
    // Inbox: merge por id, remoto tem prioridade (notificações novas vencem).
    inbox:                      mergeInbox(local.inbox, remote.inbox),
    // Milestones Liga Global: união de IDs (jamais regredir um marco já
    // pago em qualquer browser).
    globalLeagueMilestonesClaimed: mergeMilestoneIds(local.globalLeagueMilestonesClaimed, remote.globalLeagueMilestonesClaimed),
    // Liga Classic / Fast Liga: usa o lado com mais partidas (jamais regredir).
    localLeagues: mergeLocalLeagues(local.localLeagues, remote.localLeagues),
    // Flag de onboarding: OR entre local e remote — proteção monotônica.
    // Se remoto disse "já fez onboarding", isso vence sempre (evita cerimônia
    // reabrir após logout/login num browser limpo).
    userSettings: {
      ...local.userSettings,
      hasDoneOnboarding:
        (local.userSettings?.hasDoneOnboarding ?? false) ||
        (remote.onboardingFlags?.hasDoneOnboarding ?? false),
    },
    // Finance: usa o lado com MAIOR expLifetimeEarned — monotônico, jamais
    // regredir. Se o user fez cerimônia em outro browser e ganhou EXP, e o
    // local zerou (localStorage limpo no logout), o remoto vence.
    finance: pickHigherFinance(local.finance, remote.finance),
    manager: {
      ...local.manager,
      savedTactics: remote.savedTactics ?? local.manager.savedTactics,
      staff:        remote.staff        ?? local.manager.staff,
    },
  };
  saveGameState(state);
  // Hidratação completa — libera o gate de persist debounced.
  markGameStateHydrated();
  emit();
}

/**
 * Merge defensivo da queue da Academia.
 * Une por id (Map), preservando entries dos dois lados. Em conflito,
 * remoto vence se step é "mais avançado" (launched > approved > validated
 * > photo_uploaded > awaiting_photo). Garante que admin processing em
 * outro browser não é descartado pelo local stale.
 */
function mergeAcademyQueue(
  local: OlefootGameState['managerProspectArtQueue'] | undefined,
  remote: OlefootGameState['managerProspectArtQueue'] | null | undefined,
): OlefootGameState['managerProspectArtQueue'] {
  const a = Array.isArray(local) ? local : [];
  const b = Array.isArray(remote) ? remote : [];
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const STEP_RANK: Record<string, number> = {
    awaiting_photo: 0,
    photo_uploaded: 1,
    validated: 2,
    approved: 3,
    launched: 4,
  };
  const byId = new Map<string, typeof a[number]>();
  for (const x of a) byId.set(x.id, x);
  for (const x of b) {
    const existing = byId.get(x.id);
    if (!existing) byId.set(x.id, x);
    else {
      const lr = STEP_RANK[existing.playerCreationStep] ?? 0;
      const rr = STEP_RANK[x.playerCreationStep] ?? 0;
      byId.set(x.id, rr >= lr ? x : existing);
    }
  }
  return Array.from(byId.values());
}

/**
 * Merge defensivo do `finance` — usa o lado com MAIOR `expLifetimeEarned`.
 * Sem isso, logout/login num browser novo zera EXP do user.
 */
function pickHigherFinance(
  local: OlefootGameState['finance'] | undefined,
  remote: OlefootGameState['finance'] | null | undefined,
): OlefootGameState['finance'] {
  if (!remote) return local!;
  if (!local) return remote;
  const localLifetime = local.expLifetimeEarned ?? 0;
  const remoteLifetime = remote.expLifetimeEarned ?? 0;
  // Lifetime é monotônico — só cresce. Maior vence.
  return remoteLifetime > localLifetime ? remote : local;
}

/**
 * Merge defensivo das ligas locais (classic + fast).
 * Pega o lado com mais partidas jogadas em cada liga — jamais regride placar.
 */
function mergeLocalLeagues(
  local: OlefootGameState['localLeagues'] | undefined,
  remote: OlefootGameState['localLeagues'] | null | undefined,
): OlefootGameState['localLeagues'] {
  if (!local && !remote) return undefined;
  if (!local) return remote ?? undefined;
  if (!remote) return local;
  const pick = (a: typeof local.classic, b: typeof local.classic) =>
    (a?.played ?? 0) >= (b?.played ?? 0) ? a : b;
  return {
    classic: pick(local.classic, remote.classic),
    fast:    pick(local.fast,    remote.fast),
  };
}

/**
 * Merge defensivo dos IDs de marcos da Liga Global já reclamados.
 * União monotônica — jamais regredir um marco pago.
 */
function mergeMilestoneIds(
  local: string[] | undefined,
  remote: string[] | null | undefined,
): string[] {
  const a = Array.isArray(local) ? local : [];
  const b = Array.isArray(remote) ? remote : [];
  if (a.length === 0 && b.length === 0) return [];
  return Array.from(new Set([...a, ...b]));
}

/**
 * Merge defensivo do inbox: união por id, remoto vence em conflito
 * (notificação nova de outro browser tem precedência). Cap 14 como
 * no reducer.
 */
function mergeInbox(
  local: OlefootGameState['inbox'] | undefined,
  remote: OlefootGameState['inbox'] | null | undefined,
): OlefootGameState['inbox'] {
  const a = Array.isArray(local) ? local : [];
  const b = Array.isArray(remote) ? remote : [];
  if (a.length === 0) return b.slice(0, 14);
  if (b.length === 0) return a;
  const byId = new Map<string, typeof a[number]>();
  for (const x of a) byId.set(x.id, x);
  for (const x of b) byId.set(x.id, x); // remoto sobrescreve
  return Array.from(byId.values()).slice(0, 14);
}

// ─── Debounced manager_game_state persistence ─────────────────────────
let gameStatePersistTimer: ReturnType<typeof setTimeout> | null = null;

// FIX 2026-05-18f: gate de hidratação.
// Antes: ao logar, Login.tsx dispatchava SET_USER_SETTINGS (managerProfile),
// que disparava persist debounced 2s. Como o localStorage tinha sido limpo
// no logout, state.finance era 0/vazio. Se a hidratação do Supabase
// (ManagerGameStateHydrator, async) demorasse >2s, o timer disparava ANTES
// e persistia estado vazio NO SUPABASE — sobrescrevendo o saldo do user.
//
// Agora: scheduleGameStatePersist NÃO faz nada até gameStateHydrated=true.
// Quando applyHydratedGameState é chamado, libera o gate e enfileira UM
// persist pra cobrir mudanças que aconteceram durante a hidratação.
let gameStateHydrated = false;
let gameStateHasPendingChanges = false;

function scheduleGameStatePersist(): void {
  if (!isSupabaseConfigured()) return;
  if (!gameStateHydrated) {
    // Hidratação ainda não terminou — marca pendência mas NÃO persiste agora.
    gameStateHasPendingChanges = true;
    return;
  }
  if (gameStatePersistTimer) clearTimeout(gameStatePersistTimer);
  gameStatePersistTimer = setTimeout(() => {
    gameStatePersistTimer = null;
    void persistManagerGameState(state);
  }, 2000);
}

function markGameStateHydrated(): void {
  if (gameStateHydrated) return;
  gameStateHydrated = true;
  // Se houve mudanças durante a hidratação, persiste agora (após merge).
  if (gameStateHasPendingChanges) {
    gameStateHasPendingChanges = false;
    scheduleGameStatePersist();
  }
}

/** Versão pública pra hidratadores: libera o gate sem precisar passar payload. */
export function markGameStateHydrationDone(): void {
  markGameStateHydrated();
}

/** Útil pra testes / logout: força reset do gate (próxima sessão re-hidrata). */
export function resetGameStateHydration(): void {
  gameStateHydrated = false;
  gameStateHasPendingChanges = false;
  if (gameStatePersistTimer) { clearTimeout(gameStatePersistTimer); gameStatePersistTimer = null; }
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

  // A Liga Global é autoritativa no backend (Edge Function global-league-tick).
  // O frontend só lê (hidratação + realtime) e registra o próprio time via
  // registerGlobalTeamIdentity — nunca reescreve o snapshot da liga.

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

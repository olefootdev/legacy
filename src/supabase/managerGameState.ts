/**
 * Persistência server-side dos slices críticos do OlefootGameState.
 * Complementa managerSquad.ts (players/lineup) cobrindo dados que ficavam
 * apenas no localStorage e se perdiam ao trocar de browser/dispositivo.
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type { OlefootGameState } from '@/game/types';
import {
  applyResultToLocalLeague,
  emptyLocalLeaguesState,
  type LocalLeagueResult,
  type LocalLeaguesState,
} from '@/match/localLeagues';
import { applyMatchConsequences } from '@/systems/playerHealth/reducer';
import type { MatchOutcomeEvent, PlayerHealth } from '@/systems/playerHealth/types';

export interface ManagerGameStateSnapshot {
  structures:               OlefootGameState['structures'] | null;
  leagueSeason:             OlefootGameState['leagueSeason'] | null;
  results:                  OlefootGameState['results'] | null;
  trophyIds:                OlefootGameState['memorableTrophyUnlockedIds'] | null;
  competitiveRanking:       OlefootGameState['competitiveRanking'] | null;
  olefootRanked:            OlefootGameState['olefootRanked'] | null;
  playerHealth:             OlefootGameState['playerHealth'] | null;
  playerSeasonLedger:       OlefootGameState['playerSeasonLedger'] | null;
  playerMoral:              OlefootGameState['playerMoral'] | null;
  shopInventory:            OlefootGameState['shopInventory'] | null;
  olefootLeague:            OlefootGameState['olefootLeague'] | null;
  managerRelation:          OlefootGameState['managerRelationByPlayer'] | null;
  savedTactics:             OlefootGameState['manager']['savedTactics'] | null;
  staff:                    OlefootGameState['manager']['staff'] | null;
  managerProspectArtQueue:  OlefootGameState['managerProspectArtQueue'] | null;
  inbox:                    OlefootGameState['inbox'] | null;
  globalLeagueMilestonesClaimed: string[] | null;
  localLeagues:             OlefootGameState['localLeagues'] | null;
  /** Gate cross-browser pra OnboardingCeremony — evita reabrir após logout. */
  onboardingFlags:          { hasDoneOnboarding?: boolean } | null;
  /** Saldo do manager (ole, broCents, expLifetimeEarned, etc) — sem isto, logout zera tudo. */
  finance:                  OlefootGameState['finance'] | null;
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (data?.session?.user?.id) return data.session.user.id;
  // Fallback: após signup recente, a sessão pode não estar no storage ainda.
  await new Promise((r) => setTimeout(r, 500));
  const { data: retry } = await sb.auth.getSession();
  if (retry?.session?.user?.id) return retry.session.user.id;
  // Último recurso: getUser() faz round-trip ao server
  const { data: userData } = await sb.auth.getUser();
  return userData?.user?.id ?? null;
}

export async function persistManagerGameState(s: OlefootGameState): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) {
    console.warn('[managerGameState] persist: sem uid — abortando');
    return;
  }

  const exp = s.finance?.expLifetimeEarned ?? 0;
  const hasDone = s.userSettings?.hasDoneOnboarding ?? false;
  // Guard: nunca sobrescrever com state vazio (0 EXP + onboarding não feito)
  // se o user já completou onboarding. Protege contra persist debounced
  // que roda antes da hidratação completar.
  if (exp === 0 && !hasDone && Object.keys(s.players ?? {}).length === 0) {
    console.warn('[managerGameState] persist: skip — state vazio (proteção anti-overwrite)');
    return;
  }
  console.info('[managerGameState] persist: uid=', uid, 'exp=', exp, 'hasDoneOnboarding=', hasDone);

  const { error, status, count } = await sb.from('manager_game_state').upsert(
    {
      user_id:                     uid,
      structures:                  s.structures ?? null,
      league_season:               s.leagueSeason ?? null,
      results:                     s.results ?? null,
      trophy_ids:                  s.memorableTrophyUnlockedIds ?? null,
      competitive_ranking:         s.competitiveRanking ?? null,
      olefoot_ranked:              s.olefootRanked ?? null,
      player_health:               s.playerHealth ?? null,
      player_season_ledger:        s.playerSeasonLedger ?? null,
      player_moral:                s.playerMoral ?? null,
      shop_inventory:              s.shopInventory ?? null,
      olefoot_league:              s.olefootLeague ?? null,
      manager_relation:            s.managerRelationByPlayer ?? null,
      saved_tactics:               s.manager.savedTactics ?? null,
      staff:                       s.manager.staff ?? null,
      manager_prospect_art_queue:  s.managerProspectArtQueue ?? null,
      inbox:                       s.inbox ?? null,
      global_league_milestones_claimed: s.globalLeagueMilestonesClaimed ?? null,
      local_leagues:               s.localLeagues ?? null,
      onboarding_flags:            {
        hasDoneOnboarding: hasDone,
      },
      finance:                     s.finance ?? null,
    },
    { onConflict: 'user_id', count: 'exact' },
  ).select('user_id');

  if (error) {
    console.warn('[managerGameState] persist FALHOU:', error.code, error.message, 'status=', status);
  } else {
    console.info('[managerGameState] persist OK — status=', status, 'count=', count);
  }
}

export async function loadManagerGameState(): Promise<ManagerGameStateSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;

  const { data, error } = await sb
    .from('manager_game_state')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) { console.warn('[managerGameState] load falhou:', error.message); return null; }
  if (!data) return null;

  return {
    structures:              (data.structures                   as OlefootGameState['structures'])         ?? null,
    leagueSeason:            (data.league_season                as OlefootGameState['leagueSeason'])       ?? null,
    results:                 (data.results                      as OlefootGameState['results'])             ?? null,
    trophyIds:               (data.trophy_ids                   as OlefootGameState['memorableTrophyUnlockedIds']) ?? null,
    competitiveRanking:      (data.competitive_ranking          as OlefootGameState['competitiveRanking']) ?? null,
    olefootRanked:           (data.olefoot_ranked               as OlefootGameState['olefootRanked'])      ?? null,
    playerHealth:            (data.player_health                as OlefootGameState['playerHealth'])       ?? null,
    playerSeasonLedger:      (data.player_season_ledger          as OlefootGameState['playerSeasonLedger']) ?? null,
    playerMoral:             (data.player_moral                 as OlefootGameState['playerMoral'])        ?? null,
    shopInventory:           (data.shop_inventory               as OlefootGameState['shopInventory'])      ?? null,
    olefootLeague:           (data.olefoot_league               as OlefootGameState['olefootLeague'])      ?? null,
    managerRelation:         (data.manager_relation             as OlefootGameState['managerRelationByPlayer']) ?? null,
    savedTactics:            (data.saved_tactics                as OlefootGameState['manager']['savedTactics']) ?? null,
    staff:                   (data.staff                        as OlefootGameState['manager']['staff'])   ?? null,
    managerProspectArtQueue: (data.manager_prospect_art_queue   as OlefootGameState['managerProspectArtQueue']) ?? null,
    inbox:                   (data.inbox                        as OlefootGameState['inbox'])               ?? null,
    globalLeagueMilestonesClaimed: (data.global_league_milestones_claimed as string[]) ?? null,
    localLeagues: (data.local_leagues as OlefootGameState['localLeagues']) ?? null,
    onboardingFlags: (data.onboarding_flags as ManagerGameStateSnapshot['onboardingFlags']) ?? null,
    finance: (data.finance as OlefootGameState['finance']) ?? null,
  };
}

/**
 * Persiste o resultado INVERSO de uma Quick Match na Fast Liga do adversário.
 * Fire-and-forget — não bloqueia a UI do jogador local.
 */
export async function persistOpponentQuickMatchResult(
  opponentUserId: string,
  opponentResult: LocalLeagueResult,
  goalsFor: number,
  goalsAgainst: number,
  league: 'fast' | 'classic' = 'fast',
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    // 1. Ler o state atual do adversário
    const { data, error: readErr } = await sb
      .from('manager_game_state')
      .select('local_leagues')
      .eq('user_id', opponentUserId)
      .maybeSingle();

    if (readErr) {
      console.warn('[persistOpponentQuickMatchResult] read falhou:', readErr.message);
      return;
    }

    const existing = (data?.local_leagues as LocalLeaguesState | null) ?? emptyLocalLeaguesState();

    // 2. Aplicar resultado inverso na league do adversário
    const updatedLeague = applyResultToLocalLeague(existing[league], opponentResult, goalsFor, goalsAgainst);
    const updatedLocalLeagues: LocalLeaguesState = { ...existing, [league]: updatedLeague };

    // 3. Upsert — cria row se o adversário ainda não tem manager_game_state
    const { error: writeErr } = await sb.from('manager_game_state').upsert(
      {
        user_id: opponentUserId,
        local_leagues: updatedLocalLeagues,
      },
      { onConflict: 'user_id' },
    );

    if (writeErr) {
      console.warn('[persistOpponentQuickMatchResult] write falhou:', writeErr.message);
    } else {
      console.info('[persistOpponentQuickMatchResult] OK para', opponentUserId, opponentResult, league);
    }
  } catch (err) {
    console.warn('[persistOpponentQuickMatchResult] exception:', err);
  }
}

/**
 * Persiste eventos de saúde (cartões, lesões) que ocorreram nos jogadores
 * do adversário durante uma Quick Match.
 * Fire-and-forget — não bloqueia a UI do jogador local.
 */
export async function persistOpponentAwayEvents(
  opponentUserId: string,
  events: MatchOutcomeEvent[],
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!events.length) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    // 1. Ler playerHealth atual do adversário
    const { data, error: readErr } = await sb
      .from('manager_game_state')
      .select('player_health')
      .eq('user_id', opponentUserId)
      .maybeSingle();

    if (readErr) {
      console.warn('[persistOpponentAwayEvents] read falhou:', readErr.message);
      return;
    }

    const currentHealth = (data?.player_health as Record<string, PlayerHealth> | null) ?? {};

    // 2. Aplicar consequências de saúde
    const { next } = applyMatchConsequences(currentHealth, events);

    // 3. Upsert
    const { error: writeErr } = await sb.from('manager_game_state').upsert(
      {
        user_id: opponentUserId,
        player_health: next,
      },
      { onConflict: 'user_id' },
    );

    if (writeErr) {
      console.warn('[persistOpponentAwayEvents] write falhou:', writeErr.message);
    } else {
      console.info('[persistOpponentAwayEvents] OK —', events.length, 'eventos para', opponentUserId);
    }
  } catch (err) {
    console.warn('[persistOpponentAwayEvents] exception:', err);
  }
}

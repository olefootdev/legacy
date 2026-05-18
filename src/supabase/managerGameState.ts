/**
 * Persistência server-side dos slices críticos do OlefootGameState.
 * Complementa managerSquad.ts (players/lineup) cobrindo dados que ficavam
 * apenas no localStorage e se perdiam ao trocar de browser/dispositivo.
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type { OlefootGameState } from '@/game/types';

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
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.user?.id ?? null;
}

export async function persistManagerGameState(s: OlefootGameState): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  const { error } = await sb.from('manager_game_state').upsert(
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
    },
    { onConflict: 'user_id' },
  );

  if (error) console.warn('[managerGameState] persist falhou:', error.message);
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
  };
}

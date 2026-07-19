/**
 * Persistência server-side do plantel do manager (`state.players` + `state.lineup`).
 *
 * Estratégia MVP: snapshot completo (players[] + lineup{} + formationScheme).
 * Idempotente, debounced no store. Hidrata no boot via ManagerSquadHydrator.
 *
 * Próximas iterações podem normalizar players em rows separadas, mas para
 * 16-30 jogadores por manager o JSONB single-row é suficiente.
 */

import { getSupabase, isSupabaseConfigured } from './client';
import type { PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { overallFromAttributes } from '@/entities/player';

interface ManagerSquadRow {
  user_id: string;
  players: PlayerEntity[];
  lineup: Record<string, string>;
  formation_scheme: FormationSchemeId | null;
  updated_at: string;
}

export interface ManagerSquadSnapshot {
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  formationScheme: FormationSchemeId | null;
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Tenta getSession primeiro (lê do storage local, rápido)
  const { data } = await sb.auth.getSession();
  if (data?.session?.user?.id) return data.session.user.id;
  // Fallback: após signup recente, a sessão pode não estar no storage ainda.
  // Espera 500ms e tenta de novo.
  await new Promise((r) => setTimeout(r, 500));
  const { data: retry } = await sb.auth.getSession();
  if (retry?.session?.user?.id) return retry.session.user.id;
  // Último recurso: getUser() faz round-trip ao server
  const { data: userData } = await sb.auth.getUser();
  return userData?.user?.id ?? null;
}

/** Upsert do snapshot completo. Silencioso em erro (apenas log). */
export async function persistManagerSquad(snapshot: {
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  formationScheme: FormationSchemeId;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) {
    console.warn('[managerSquad] persist: sem uid — abortando');
    return;
  }

  const playersArr = Object.values(snapshot.players);
  // Guard: nunca sobrescrever com 0 players — protege contra persist
  // debounced que roda antes da hidratação completar.
  if (playersArr.length === 0) {
    console.warn('[managerSquad] persist: 0 players — skip (proteção anti-overwrite)');
    return;
  }
  console.info('[managerSquad] persist: uid=', uid, 'players=', playersArr.length);
  const { error, status, statusText, count } = await sb
    .from('manager_squad')
    .upsert(
      {
        user_id: uid,
        players: playersArr,
        lineup: snapshot.lineup,
        formation_scheme: snapshot.formationScheme,
      },
      { onConflict: 'user_id', count: 'exact' },
    )
    .select('user_id');

  if (error) {
    console.warn('[managerSquad] persist FALHOU:', error.code, error.message, 'status=', status, statusText);
  } else {
    console.info('[managerSquad] persist OK — status=', status, 'count=', count);
  }
}

/** Carrega snapshot do user logado. Retorna null se não houver row (manager novo). */
export async function loadManagerSquad(): Promise<ManagerSquadSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;

  const { data, error } = await sb
    .from('manager_squad')
    .select('user_id, players, lineup, formation_scheme, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.warn('[managerSquad] load falhou:', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as ManagerSquadRow;
  const playersById: Record<string, PlayerEntity> = {};
  if (Array.isArray(row.players)) {
    for (const p of row.players) {
      if (p && typeof p === 'object' && typeof (p as PlayerEntity).id === 'string') {
        playersById[(p as PlayerEntity).id] = p as PlayerEntity;
      }
    }
  }
  return {
    players: playersById,
    lineup: (row.lineup as Record<string, string>) ?? {},
    formationScheme: row.formation_scheme ?? null,
  };
}

export interface OpponentSquadEntry {
  userId: string;
  clubName: string;
  clubShort: string;
  players: PlayerEntity[];
  lineup: Record<string, string>;
  formationScheme: FormationSchemeId | null;
  avgOvr: number;
}

/**
 * Busca squads de outros managers para matchmaking assíncrono (PvP offline).
 * Filtra por OVR médio do XI dentro do range especificado.
 */
export async function fetchOpponentSquads(params: {
  excludeUserId: string;
  ovrRange: [number, number];
  limit?: number;
}): Promise<OpponentSquadEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];

  const { excludeUserId, limit = 20 } = params;

  try {
    // 1. Buscar squads (sem join — profiles FK não existe)
    const { data: squads, error: sqErr } = await sb
      .from('manager_squad')
      .select('user_id, players, lineup, formation_scheme')
      .neq('user_id', excludeUserId)
      .limit(limit);

    if (sqErr || !squads || squads.length === 0) {
      if (sqErr) console.warn('[managerSquad] fetchOpponentSquads:', sqErr.message);
      return [];
    }

    // 2. Buscar nomes dos clubes via global_league_teams
    const userIds = squads.map((r: any) => r.user_id as string);
    const { data: teams } = await sb
      .from('global_league_teams')
      .select('manager_id, club_name, club_short')
      .in('manager_id', userIds);

    const teamsByManager: Record<string, { club_name: string; club_short: string }> = {};
    for (const t of (teams ?? []) as Array<{ manager_id: string; club_name: string; club_short: string }>) {
      teamsByManager[t.manager_id] = { club_name: t.club_name, club_short: t.club_short };
    }

    // 3. Montar resultados com filtro de OVR
    const [minOvr, maxOvr] = params.ovrRange;
    const results: OpponentSquadEntry[] = [];

    for (const row of squads as unknown as Array<{
      user_id: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formation_scheme: FormationSchemeId | null;
    }>) {
      const players = Array.isArray(row.players) ? row.players as PlayerEntity[] : [];
      const lineup = (row.lineup as Record<string, string>) ?? {};
      const teamInfo = teamsByManager[row.user_id];

      const lineupPlayers = Object.values(lineup)
        .map(id => players.find(p => p.id === id))
        .filter((p): p is PlayerEntity => !!p);

      if (lineupPlayers.length === 0) continue;

      const avgOvr = Math.round(
        lineupPlayers.reduce((s, p) => s + overallFromAttributes(p.attrs, p.pos), 0) / lineupPlayers.length
      );

      if (avgOvr < minOvr || avgOvr > maxOvr) continue;

      results.push({
        userId: row.user_id,
        clubName: teamInfo?.club_name ?? 'Clube Rival',
        clubShort: teamInfo?.club_short ?? 'RIV',
        players,
        lineup,
        formationScheme: row.formation_scheme,
        avgOvr,
      });
    }

    return results;
  } catch (err) {
    console.warn('[managerSquad] fetchOpponentSquads exception:', err);
    return [];
  }
}

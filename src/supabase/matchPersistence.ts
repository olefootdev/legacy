import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './client';
import type { MatchEventEntry } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';

let _pendingEvents: { match_id: string; minute: number; kind: string; payload: Record<string, unknown> }[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 3000;
const FLUSH_BATCH_SIZE = 50;

/** `public.players.id` / `clubs.id` são UUID; o save local usa `ole-fc` até ligar ao perfil remoto. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(s: string): boolean {
  return UUID_RE.test(s);
}

let _clubResolveCache: { userId: string; remoteClubId: string | null } | null = null;

export async function resolvePersistClubId(sb: SupabaseClient, localClubId: string): Promise<string | null> {
  if (isUuidString(localClubId)) return localClubId;
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return null;
  if (_clubResolveCache?.userId === userId) return _clubResolveCache.remoteClubId;
  const { data, error } = await sb.from('profiles').select('club_id').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('[matchPersistence] resolvePersistClubId:', error.message);
    _clubResolveCache = { userId, remoteClubId: null };
    return null;
  }
  const cid = data?.club_id;
  const remote = typeof cid === 'string' && isUuidString(cid) ? cid : null;
  _clubResolveCache = { userId, remoteClubId: remote };
  if (!remote) {
    console.warn(
      '[matchPersistence] club_id local não é UUID e o perfil não tem club_id válido no Supabase.',
    );
  }
  return remote;
}

export type SyncPlayerToSupabaseResult =
  | { ok: true }
  | { ok: false; reason: 'no_client' | 'no_club' | 'invalid_player_id'; message?: string }
  | { ok: false; reason: 'request_error'; message: string };

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
}

async function flushEvents() {
  const sb = getSupabase();
  if (!sb || _pendingEvents.length === 0) return;
  const batch = _pendingEvents.splice(0, FLUSH_BATCH_SIZE);
  try {
    const { error } = await sb.from('match_events').insert(batch as never);
    if (error) {
      console.warn('[matchPersistence] flush error:', error.message);
      _pendingEvents.unshift(...batch);
    }
  } catch (e) {
    console.warn('[matchPersistence] flush exception:', e);
    _pendingEvents.unshift(...batch);
  }
  if (_pendingEvents.length > 0) scheduleFlush();
}

export async function insertMatch(input: {
  homeClubId: string;
  awayName: string;
  mode: 'quick' | 'auto' | 'test2d';
  simulationSeed?: number;
}): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const homeClubId = await resolvePersistClubId(sb, input.homeClubId);
  if (!homeClubId) {
    console.warn('[matchPersistence] insertMatch: sem home_club_id resolvido (login + club_id no perfil).');
    return null;
  }
  try {
    const { data, error } = await sb
      .from('matches')
      .insert({
        home_club_id: homeClubId,
        away_name: input.awayName,
        mode: input.mode,
        status: 'live',
        simulation_seed: input.simulationSeed ?? null,
        started_at: new Date().toISOString(),
      } as never)
      .select('id')
      .single();
    if (error) {
      console.warn('[matchPersistence] insertMatch error:', error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.warn('[matchPersistence] insertMatch exception:', e);
    return null;
  }
}

export function queueMatchEvents(matchId: string, events: MatchEventEntry[]) {
  for (const ev of events) {
    _pendingEvents.push({
      match_id: matchId,
      minute: ev.minute,
      kind: ev.kind,
      payload: { text: ev.text, id: ev.id },
    });
  }
  scheduleFlush();
}

export async function finalizeMatch(
  matchId: string,
  scoreHome: number,
  scoreAway: number,
  postMatchData?: Record<string, unknown>,
) {
  await flushEvents();
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb
      .from('matches')
      .update({
        status: 'finished',
        score_home: scoreHome,
        score_away: scoreAway,
        ended_at: new Date().toISOString(),
        post_match_data: postMatchData ?? null,
      } as never)
      .eq('id', matchId);
    if (error) {
      console.warn('[matchPersistence] finalizeMatch error:', error.message);
    }
  } catch (e) {
    console.warn('[matchPersistence] finalizeMatch exception:', e);
  }
}

export async function persistPlayers(
  clubId: string,
  players: Array<{
    id: string;
    name: string;
    num: number;
    pos: string;
    archetype: string;
    zone: string;
    behavior: string;
    attributes: Record<string, number>;
    fatigue: number;
    injuryRisk: number;
    evolutionXp: number;
    outForMatches: number;
  }>,
) {
  const sb = getSupabase();
  if (!sb) return;
  const resolvedClubId = await resolvePersistClubId(sb, clubId);
  if (!resolvedClubId) {
    console.warn('[matchPersistence] persistPlayers: sem club_id resolvido, ignorando persistência.');
    return;
  }

  // Filtrar apenas jogadores com UUID válido
  const validPlayers = players.filter(p => {
    if (!isUuidString(p.id)) {
      console.warn('[matchPersistence] persistPlayers: id de jogador não é UUID, ignorado:', p.id);
      return false;
    }
    return true;
  });

  if (validPlayers.length === 0) return;

  // Batch upsert em vez de loop sequencial - muito mais rápido
  try {
    const payload = validPlayers.map(p => ({
      id: p.id,
      club_id: resolvedClubId,
      name: p.name,
      num: p.num,
      pos: p.pos,
      archetype: p.archetype,
      zone: p.zone,
      behavior: p.behavior,
      attributes: p.attributes,
      fatigue: p.fatigue,
      injury_risk: p.injuryRisk,
      evolution_xp: p.evolutionXp,
      out_for_matches: p.outForMatches,
    }));

    await sb.from('players').upsert(payload as never, { onConflict: 'id' });
  } catch (e) {
    console.warn('[matchPersistence] persistPlayers batch error:', e);
  }
}

/**
 * Grava um jogador do plantel em `public.players` (RLS: `club_id` = `profiles.club_id` do utilizador).
 * O `localClubId` do save (`ole-fc`, …) é mapeado para o `club_id` UUID do perfil quando necessário.
 */
export async function syncPlayerToSupabase(
  localClubId: string,
  player: PlayerEntity,
): Promise<SyncPlayerToSupabaseResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no_client' };
  if (!isUuidString(player.id)) {
    return {
      ok: false,
      reason: 'invalid_player_id',
      message:
        'Este jogador usa um ID antigo (não UUID). Cria um novo jogador no wizard para gravar no Supabase.',
    };
  }
  const clubId = await resolvePersistClubId(sb, localClubId);
  if (!clubId) {
    return {
      ok: false,
      reason: 'no_club',
      message:
        'Sem clube no Supabase para este utilizador. Confirma login, migrations aplicadas e `profiles.club_id` preenchido.',
    };
  }
  try {
    const { error } = await sb.from('players').upsert(
      {
        id: player.id,
        club_id: clubId,
        name: player.name,
        num: player.num,
        pos: player.pos,
        archetype: player.archetype,
        zone: player.zone,
        behavior: player.behavior,
        attributes: player.attrs as unknown as Record<string, number>,
        fatigue: player.fatigue,
        injury_risk: player.injuryRisk,
        evolution_xp: player.evolutionXp,
        out_for_matches: player.outForMatches,
        // positionKnowledge: persiste DNA de lenda quando disponível (coluna JSONB opcional)
        ...(player.positionKnowledge ? { position_knowledge: player.positionKnowledge } : {}),
      } as never,
      { onConflict: 'id' },
    );
    if (error) return { ok: false, reason: 'request_error', message: error.message };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'request_error', message };
  }
}

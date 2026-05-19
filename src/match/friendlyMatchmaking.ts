import { getSupabase } from '@/supabase/client';
import { getMatchingBotTeam, generateBotSquad, type BotTeamDefinition } from './botTeams';
import type { ClubSearchHit } from '@/supabase/friendlyChallenges';
import type { OpponentStub, PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { overallFromAttributes } from '@/entities/player';

/**
 * Converte qualquer `OpponentMatch` em `OpponentStub` para passar via
 * navigate state (mantém o adversário consistente entre tela de busca e
 * MatchQuick/MatchClassic — evita cair no DEFAULT_OPPONENT placeholder).
 */
export function opponentMatchToStub(m: OpponentMatch, myOverall: number): OpponentStub {
  if (m.type === 'real_manager') return m.stub;
  if (m.type === 'online') {
    return {
      id: m.club.club_id,
      name: m.club.name,
      shortName: m.club.short_name,
      strength: Math.max(50, myOverall - m.ovrDiff),
    };
  }
  return {
    id: m.bot.id,
    name: m.bot.name,
    shortName: m.bot.shortName,
    strength: m.bot.avgOverall,
  };
}

export type MatchmakingMode = 'quick' | 'penalty';

export interface MatchmakingParams {
  myClubId: string;
  myUserId?: string;
  myOverall: number;
  preferredMode: MatchmakingMode;
  maxOvrDiff?: number;
}

export type OpponentMatch =
  | { type: 'real_manager'; stub: OpponentStub }
  | { type: 'online'; club: ClubSearchHit; ovrDiff: number }
  | { type: 'bot'; bot: BotTeamDefinition };

/**
 * Busca adversário real: squad de manager_squad + nome de global_league_teams.
 * Usa jogadores REAIS do plantel do manager adversário.
 */
async function findRealManagerOpponent(
  myUserId: string | undefined,
  myOverall: number,
  maxOvrDiff: number,
): Promise<OpponentMatch | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // 1. Buscar squads reais (RLS agora permite leitura cruzada)
    const { data: squads, error: sqErr } = await sb
      .from('manager_squad')
      .select('user_id, players, lineup, formation_scheme')
      .neq('user_id', myUserId ?? '')
      .limit(20);

    if (sqErr || !squads || squads.length === 0) return null;

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

    // 3. Filtrar por OVR e validar
    const [minOvr, maxOvr] = [myOverall - maxOvrDiff, myOverall + maxOvrDiff];
    const candidates: Array<{
      userId: string;
      clubName: string;
      clubShort: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formationScheme: FormationSchemeId | null;
      avgOvr: number;
    }> = [];

    for (const row of squads as unknown as Array<{
      user_id: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formation_scheme: FormationSchemeId | null;
    }>) {
      const players = Array.isArray(row.players) ? row.players as PlayerEntity[] : [];
      const lineup = (row.lineup as Record<string, string>) ?? {};
      const teamInfo = teamsByManager[row.user_id];

      // Precisa ter nome válido
      if (!teamInfo || !teamInfo.club_name || teamInfo.club_name === 'Buscando…') continue;

      // Pegar jogadores do lineup
      const lineupPlayers = Object.values(lineup)
        .map(id => players.find(p => p.id === id))
        .filter((p): p is PlayerEntity => !!p);

      if (lineupPlayers.length < 11) continue;

      const avgOvr = Math.round(
        lineupPlayers.reduce((s, p) => s + overallFromAttributes(p.attrs), 0) / lineupPlayers.length
      );

      if (avgOvr < minOvr || avgOvr > maxOvr) continue;

      candidates.push({
        userId: row.user_id,
        clubName: teamInfo.club_name,
        clubShort: teamInfo.club_short,
        players,
        lineup,
        formationScheme: row.formation_scheme,
        avgOvr,
      });
    }

    if (candidates.length === 0) return null;

    // Escolher um dos mais próximos em OVR
    const sorted = candidates.sort((a, b) =>
      Math.abs(a.avgOvr - myOverall) - Math.abs(b.avgOvr - myOverall)
    );
    const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]!;

    // Montar stub com jogadores REAIS do lineup
    const realLineupPlayers = Object.values(pick.lineup)
      .map(id => pick.players.find(p => p.id === id))
      .filter((p): p is PlayerEntity => !!p)
      .slice(0, 11);

    const stub: OpponentStub = {
      id: pick.userId,
      name: pick.clubName,
      shortName: pick.clubShort,
      strength: pick.avgOvr,
      genesisAwayPlayers: realLineupPlayers,
      formationScheme: pick.formationScheme ?? '4-3-3',
    };

    return { type: 'real_manager', stub };
  } catch (err) {
    console.warn('[friendlyMatchmaking] real manager search failed:', err);
    return null;
  }
}

/**
 * Fallback: busca nome/OVR de global_league_teams e gera squad sintético.
 * Usado apenas se manager_squad não retornar resultados (RLS ainda bloqueando
 * ou manager sem squad persistido).
 */
async function findGlobalLeagueFallback(
  myUserId: string | undefined,
  myOverall: number,
  maxOvrDiff: number,
): Promise<OpponentMatch | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    let query = sb
      .from('global_league_teams')
      .select('id, manager_id, club_name, club_short, overall')
      .gte('overall', Math.max(40, myOverall - maxOvrDiff))
      .lte('overall', Math.min(99, myOverall + maxOvrDiff))
      .limit(10);

    if (myUserId) {
      query = query.neq('manager_id', myUserId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    const valid = (data as Array<{
      id: string; manager_id: string; club_name: string; club_short: string; overall: number;
    }>).filter(t =>
      t.club_name && t.club_name !== 'Buscando…' && t.overall >= 40 && t.overall <= 99
    );

    if (valid.length === 0) return null;

    const sorted = valid.sort((a, b) =>
      Math.abs(a.overall - myOverall) - Math.abs(b.overall - myOverall)
    );
    const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]!;

    // Squad sintético como último recurso (manager não tem squad persistido)
    const formations: FormationSchemeId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1'];
    const formation = formations[Math.floor(Math.random() * formations.length)]!;
    const botDef: BotTeamDefinition = {
      id: `bot-${pick.id}` as any,
      name: pick.club_name,
      shortName: pick.club_short,
      country: 'Brasil',
      avgOverall: pick.overall,
      formation,
      style: 'balanced',
      description: '',
    };
    const squad = generateBotSquad(botDef);
    const lineupPlayers = Object.values(squad).slice(0, 11);

    const stub: OpponentStub = {
      id: pick.manager_id,
      name: pick.club_name,
      shortName: pick.club_short,
      strength: pick.overall,
      genesisAwayPlayers: lineupPlayers,
      formationScheme: formation,
    };

    return { type: 'real_manager', stub };
  } catch (err) {
    console.warn('[friendlyMatchmaking] global league fallback failed:', err);
    return null;
  }
}

/**
 * Busca automática de adversário para amistoso.
 *
 * Prioridade:
 * 1. Manager real com squad persistido (jogadores REAIS) — OVR ±10
 * 2. Manager real com squad persistido — OVR ±20
 * 3. Manager da Liga Global (squad sintético) — OVR ±20
 * 4. Manager da Liga Global — OVR ±30
 * 5. Bot (último recurso)
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myUserId, myOverall, maxOvrDiff = 10 } = params;

  // 1. Squad real (±10)
  const real = await findRealManagerOpponent(myUserId, myOverall, maxOvrDiff);
  if (real) return real;

  // 2. Squad real (±20)
  const realWide = await findRealManagerOpponent(myUserId, myOverall, 20);
  if (realWide) return realWide;

  // 3. Liga Global fallback (±20)
  const globalClose = await findGlobalLeagueFallback(myUserId, myOverall, 20);
  if (globalClose) return globalClose;

  // 4. Liga Global fallback (±30)
  const globalWide = await findGlobalLeagueFallback(myUserId, myOverall, 30);
  if (globalWide) return globalWide;

  // 5. Bot
  const bot = getMatchingBotTeam(myOverall, 15);
  return { type: 'bot', bot };
}

/**
 * Busca rápida de adversário (usado no botão "BUSCAR PARTIDA").
 */
export async function quickFindOpponent(
  myClubId: string,
  myOverall: number,
  myUserId?: string,
): Promise<OpponentMatch> {
  return findFriendlyOpponent({
    myClubId,
    myUserId,
    myOverall,
    preferredMode: 'quick',
    maxOvrDiff: 10,
  });
}

/**
 * Verifica se um clube está ONLINE e disponível para amistosos.
 */
export async function isClubOnlineAvailable(clubId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { data, error } = await sb
      .from('clubs')
      .select('friendly_availability')
      .eq('club_id', clubId)
      .maybeSingle();

    if (error || !data) return false;
    return (data.friendly_availability as string) === 'ONLINE';
  } catch {
    return false;
  }
}

/**
 * Atualiza a disponibilidade de um clube no Supabase.
 */
export async function updateClubAvailability(
  clubId: string,
  availability: 'ONLINE' | 'OFFLINE',
): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase não configurado.' };

  try {
    const { error } = await sb
      .from('clubs')
      .update({ friendly_availability: availability } as never)
      .eq('club_id', clubId);

    if (error) return { error: error.message };
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Atualiza a configuração de auto-aceitar convites.
 */
export async function updateClubAutoAccept(
  clubId: string,
  autoAccept: boolean,
): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase não configurado.' };

  try {
    const { error } = await sb
      .from('clubs')
      .update({ friendly_auto_accept: autoAccept } as never)
      .eq('club_id', clubId);

    if (error) return { error: error.message };
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}

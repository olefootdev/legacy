import { getSupabase } from '@/supabase/client';
import { getMatchingBotTeam, type BotTeamDefinition } from './botTeams';
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

      // Precisa ter pelo menos 11 jogadores no plantel
      if (players.length < 11) continue;

      // Tentar montar lineup a partir do mapa de lineup
      let lineupPlayers = Object.values(lineup)
        .map(id => players.find(p => p.id === id))
        .filter((p): p is PlayerEntity => !!p);

      // Se lineup não tem 11, usar os 11 melhores jogadores do plantel
      if (lineupPlayers.length < 11) {
        lineupPlayers = [...players]
          .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs))
          .slice(0, 11);
      }

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
    let realLineupPlayers = Object.values(pick.lineup)
      .map(id => pick.players.find(p => p.id === id))
      .filter((p): p is PlayerEntity => !!p)
      .slice(0, 11);

    // Fallback: se lineup não resolve 11, usar os melhores do plantel
    if (realLineupPlayers.length < 11) {
      realLineupPlayers = [...pick.players]
        .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs))
        .slice(0, 11);
    }

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
 * Busca automática de adversário para amistoso.
 *
 * Prioridade:
 * 1. Manager real com squad persistido (jogadores REAIS) — OVR ±10
 * 2. Manager real com squad persistido — OVR ±20
 * 3. Manager real com squad persistido — OVR ±30 (qualquer)
 * 4. Bot (último recurso — nunca inventa jogadores para managers reais)
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

  // 3. Squad real (±30)
  const realVeryWide = await findRealManagerOpponent(myUserId, myOverall, 30);
  if (realVeryWide) return realVeryWide;

  // 4. Bot (último recurso)
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

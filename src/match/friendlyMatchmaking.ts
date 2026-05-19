import { getSupabase } from '@/supabase/client';
import { getMatchingBotTeam, generateBotSquad, type BotTeamDefinition } from './botTeams';
import type { ClubSearchHit } from '@/supabase/friendlyChallenges';
import type { OpponentStub } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';

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
  // bot
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

const FORMATIONS: FormationSchemeId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2'];

/**
 * Busca adversário real da Liga Global e gera squad sintético.
 * global_league_teams tem leitura pública (sem RLS), contém managers reais.
 */
async function findGlobalLeagueOpponent(
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

    const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)]!;
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
    const squadPlayers = Object.values(squad);
    const lineupPlayers = squadPlayers.slice(0, 11);

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
    console.warn('[friendlyMatchmaking] global league search failed:', err);
    return null;
  }
}

/**
 * Busca automática de adversário para amistoso.
 *
 * Prioridade:
 * 1. Manager real da Liga Global com OVR similar (±10)
 * 2. Manager real da Liga Global com OVR similar (±20)
 * 3. Qualquer manager real da Liga Global (±30)
 * 4. Bot aleatório com OVR próximo (último recurso)
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myUserId, myOverall, maxOvrDiff = 10 } = params;

  // 1. Liga Global (±10)
  const close = await findGlobalLeagueOpponent(myUserId, myOverall, maxOvrDiff);
  if (close) return close;

  // 2. Liga Global (±20)
  const wide = await findGlobalLeagueOpponent(myUserId, myOverall, 20);
  if (wide) return wide;

  // 3. Liga Global (±30)
  const veryWide = await findGlobalLeagueOpponent(myUserId, myOverall, 30);
  if (veryWide) return veryWide;

  // 4. Fallback: bot com OVR próximo
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

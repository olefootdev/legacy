/**
 * Bridge: Liga Global → PlayerHealth + PlayerMoral
 *
 * Escuta rodadas finalizadas via realtime e aplica consequências nos
 * jogadores individuais do manager:
 *  - Cartão vermelho → suspensão 1 rodada
 *  - Acúmulo 3 amarelos → suspensão 1 rodada
 *  - Lesão com severidade dinâmica (baseada em fadiga)
 *  - Fadiga acumulativa (PlayedEvent para todos os escalados)
 *  - Moral pós-resultado (win/draw/loss)
 *  - Form streak (boa/má fase)
 *  - Inbox notifications
 *  - Tick recovery (decrementa suspensões/lesões anteriores)
 *
 * A Edge Function gera eventos no nível do TIME (sem playerId).
 * Este bridge atribui cada evento a um jogador aleatório do lineup.
 */

import { useEffect } from 'react';
import { useGameStore, dispatchGame } from '@/game/store';
import { globalRoundPlayedEvents } from '@/systems/playerHealth/fromGlobalMatch';
import { makeInboxItem } from '@/game/inboxItem';
import { getSupabase } from '@/supabase/client';
import type { GlobalFixture } from '@/match/globalMatch';
import type { MatchOutcomeEvent, PlayerHealth } from '@/systems/playerHealth/types';
import type { MatchResult } from '@/systems/playerMoral/types';
import type { InjurySeverity } from '@/systems/injury';
import type { PlayerEntity } from '@/entities/types';

const LEAGUE_ID = 'global';

export function useGlobalConsequencesSync() {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const club = useGameStore((s) => s.club);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const lineup = useGameStore((s) => s.lineup);
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lastProcessedRound = useGameStore((s) => s.lastProcessedGlobalRound);

  const engagementScore = useGameStore((s) => s.managerPresence?.engagementScore ?? 0);

  // Sync available_player_count + engagement_score para Supabase (debounced)
  useEffect(() => {
    if (!club || !players || Object.keys(players).length === 0) return;
    const timer = setTimeout(() => {
      syncTeamStatus(players as Record<string, PlayerEntity>, playerHealth, engagementScore);
    }, 2000);
    return () => clearTimeout(timer);
  }, [playerHealth, players, club, engagementScore]);

  useEffect(() => {
    if (!globalLeagueMVP || !club) return;

    const managerId = managerProfile?.email ?? club.id;
    const myTeam = globalLeagueMVP.teams.find((t) => t.managerId === managerId);
    if (!myTeam) return;

    const leagueRounds = globalLeagueMVP.leagueRounds ?? [];
    const currentRoundNum = globalLeagueMVP.currentLeagueRound;
    if (!currentRoundNum || currentRoundNum < 2) return;

    const lastFinishedRound = leagueRounds[currentRoundNum - 2];
    if (!lastFinishedRound || lastFinishedRound.status !== 'finished') return;

    const roundKey = `${globalLeagueMVP.seasonId}_round_${currentRoundNum - 1}`;
    if (lastProcessedRound === roundKey) return;

    const myFixture = lastFinishedRound.fixtures.find(
      (f) => f.homeTeamId === myTeam.id || f.awayTeamId === myTeam.id,
    );
    if (!myFixture || myFixture.status !== 'finished') return;

    dispatchGame({ type: 'SET_LAST_PROCESSED_GLOBAL_ROUND', roundKey });

    // Detect opponent for rivalry check
    const opponentTeamId = myFixture.homeTeamId === myTeam.id ? myFixture.awayTeamId : myFixture.homeTeamId;
    const opponentTeam = globalLeagueMVP.teams.find((t) => t.id === opponentTeamId);
    const rivalryCount = myTeam.rivalryEncounters?.[opponentTeamId] ?? 0;

    applyRoundConsequences(
      myFixture, myTeam.id, lineup,
      players as Record<string, PlayerEntity>, playerHealth,
      { opponentName: opponentTeam?.clubName, rivalryCount },
    );
  }, [globalLeagueMVP, club, managerProfile, lineup, players, playerHealth, lastProcessedRound]);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rollSeverityFromFatigue(fatigue: number): InjurySeverity {
  const roll = Math.random();
  if (fatigue >= 80) {
    if (roll < 0.3) return 'leve';
    if (roll < 0.7) return 'forte';
    return 'gravissima';
  }
  if (fatigue >= 50) {
    if (roll < 0.5) return 'leve';
    if (roll < 0.85) return 'forte';
    return 'gravissima';
  }
  if (roll < 0.7) return 'leve';
  if (roll < 0.95) return 'forte';
  return 'gravissima';
}

function applyRoundConsequences(
  fixture: GlobalFixture,
  myTeamId: string,
  lineup: Record<string, string>,
  players: Record<string, PlayerEntity>,
  playerHealth: Record<string, PlayerHealth>,
  rivalryInfo?: { opponentName?: string; rivalryCount: number },
) {
  const isHome = fixture.homeTeamId === myTeamId;
  const mySide = isHome ? 'home' : 'away';
  const myScore = isHome ? fixture.scoreHome : fixture.scoreAway;
  const theirScore = isHome ? fixture.scoreAway : fixture.scoreHome;

  const lineupPlayerIds = Object.values(lineup).filter(
    (id) => id && players[id],
  );
  if (lineupPlayerIds.length === 0) return;

  // 1. Tick recovery (decrementa suspensões/lesões de rodadas anteriores)
  dispatchGame({ type: 'TICK_HEALTH_RECOVERY' });

  // 2. Atribuir eventos do servidor a jogadores individuais
  const healthEvents: MatchOutcomeEvent[] = [];
  const affectedPlayerIds = new Set<string>();
  const usedPlayerIds = new Set<string>();
  const now = Date.now();

  for (const ev of fixture.events) {
    if (ev.side !== mySide) continue;

    // Se o evento já tem playerId (futuro), usar. Senão, atribuir aleatório evitando repetição.
    let targetId: string;
    if (ev.playerId) {
      targetId = ev.playerId;
    } else {
      const available = lineupPlayerIds.filter((id) => !usedPlayerIds.has(id));
      targetId = pickRandom(available.length > 0 ? available : lineupPlayerIds);
    }
    usedPlayerIds.add(targetId);

    const base = {
      playerId: targetId,
      matchId: fixture.id,
      matchMode: 'global' as const,
      at: now + ev.minute * 60_000,
    };

    switch (ev.type) {
      case 'yellow_card':
        healthEvents.push({ ...base, type: 'yellow_card', leagueId: LEAGUE_ID });
        break;
      case 'red_card':
        healthEvents.push({ ...base, type: 'red_card', reason: 'direct' });
        affectedPlayerIds.add(targetId);
        break;
      case 'injury': {
        const fatigue = playerHealth[targetId]?.fatigue ?? 0;
        const severity = rollSeverityFromFatigue(fatigue);
        healthEvents.push({ ...base, type: 'injury', severity });
        affectedPlayerIds.add(targetId);
        // Lesão grave em titular → trigger mercado emergencial
        if (severity === 'gravissima' || severity === 'forte') {
          const player = players[targetId];
          if (player) {
            dispatchGame({
              type: 'SET_EMERGENCY_TRANSFER_OFFER',
              offer: {
                injuredPlayerId: targetId,
                injuredPlayerName: player.name,
                zone: player.zone,
                createdAt: now,
              },
            });
          }
        }
        break;
      }
    }
  }

  // 3. PlayedEvent para todos os escalados (fadiga acumulativa)
  const playedEvents = globalRoundPlayedEvents({
    playerIds: lineupPlayerIds,
    matchId: fixture.id,
    leagueId: LEAGUE_ID,
    intensity: 0.6,
  });

  // 4. Aplicar consequências de saúde
  const allEvents = [...healthEvents, ...playedEvents];
  if (allEvents.length > 0) {
    dispatchGame({ type: 'APPLY_MATCH_CONSEQUENCES', events: allEvents });
  }

  // 5. Moral baseada no resultado
  const result: MatchResult =
    myScore > theirScore ? 'win' : myScore < theirScore ? 'loss' : 'draw';
  dispatchGame({
    type: 'APPLY_GLOBAL_ROUND_MORAL',
    result,
    playerIds: lineupPlayerIds,
  });

  // 6. Form streak
  const formUpdates = lineupPlayerIds.map((pid) => ({
    playerId: pid,
    good: result === 'win' && !affectedPlayerIds.has(pid),
  }));
  dispatchGame({ type: 'UPDATE_PLAYER_FORM_STREAK', updates: formUpdates });

  // 7. Inbox notifications
  generateInboxNotifications(healthEvents, lineupPlayerIds, playerHealth, players);

  // 8. Rivalry notification
  if (rivalryInfo && rivalryInfo.rivalryCount >= 3 && rivalryInfo.opponentName) {
    dispatchGame({
      type: 'PUSH_INBOX_ITEMS',
      items: [
        makeInboxItem(
          `global-rivalry-${fixture.id}`,
          'LEAGUE_MATCH_SIMULATED',
          'COMPETIÇÃO',
          `Clássico! ${rivalryInfo.rivalryCount}º confronto contra ${rivalryInfo.opponentName} — tensão aumentada`,
          { timeLabel: 'Liga Global' },
        ),
      ],
    });
  }
}

function generateInboxNotifications(
  healthEvents: MatchOutcomeEvent[],
  lineupPlayerIds: string[],
  playerHealth: Record<string, PlayerHealth>,
  players: Record<string, PlayerEntity>,
) {
  const inboxItems: ReturnType<typeof makeInboxItem>[] = [];
  const now = Date.now();

  const redCards = healthEvents.filter((e) => e.type === 'red_card');
  for (const ev of redCards) {
    const playerName = players[ev.playerId]?.name ?? 'Jogador';
    inboxItems.push(
      makeInboxItem(
        `global-red-${ev.playerId}-${now}`,
        'PLAYER_SUSPENSION',
        'COMPETIÇÃO',
        `Cartão vermelho na Liga Global — ${playerName} suspenso 1 rodada`,
        { timeLabel: 'Liga Global' },
      ),
    );
  }

  const yellows = healthEvents.filter((e) => e.type === 'yellow_card');
  for (const ev of yellows) {
    const prev = playerHealth[ev.playerId];
    const prevCount = prev?.yellowCardsByLeague?.[LEAGUE_ID] ?? 0;
    if (prevCount === 2) {
      const playerName = players[ev.playerId]?.name ?? 'Jogador';
      inboxItems.push(
        makeInboxItem(
          `global-yellow-ban-${ev.playerId}-${now}`,
          'PLAYER_SUSPENSION',
          'COMPETIÇÃO',
          `3 amarelos acumulados na Liga Global — ${playerName} suspenso 1 rodada`,
          { timeLabel: 'Liga Global' },
        ),
      );
    }
  }

  const injuries = healthEvents.filter((e) => e.type === 'injury');
  for (const ev of injuries) {
    const sev = (ev as { severity: string }).severity;
    const label = sev === 'gravissima' ? 'Gravíssima' : sev === 'forte' ? 'Forte' : 'Leve';
    const playerName = players[ev.playerId]?.name ?? 'Jogador';
    inboxItems.push(
      makeInboxItem(
        `global-injury-${ev.playerId}-${now}`,
        'PLAYER_INJURY',
        'PLANTEL',
        `Lesão ${label} na Liga Global — ${playerName} indisponível`,
        { timeLabel: 'Liga Global' },
      ),
    );
  }

  // Alerta de risco de WO
  const currentlyUnavailable = lineupPlayerIds.filter((pid) => {
    const h = playerHealth[pid];
    return h && (h.outForMatches > 0 || h.suspendedMatches > 0);
  }).length;
  const newUnavailable = redCards.length + injuries.length;
  const totalSquad = Object.keys(playerHealth).length || lineupPlayerIds.length;
  const availableAfter = totalSquad - currentlyUnavailable - newUnavailable;
  if (availableAfter < 12) {
    inboxItems.push(
      makeInboxItem(
        `global-wo-risk-${now}`,
        'LINEUP_ISSUE',
        'COMPETIÇÃO',
        `Alerta: apenas ~${Math.max(0, availableAfter)} jogadores disponíveis — risco de WO!`,
        { timeLabel: 'Liga Global' },
      ),
    );
  }

  if (inboxItems.length > 0) {
    dispatchGame({ type: 'PUSH_INBOX_ITEMS', items: inboxItems });
  }
}

/**
 * Sincroniza available_player_count + engagement_score para o Supabase.
 * A Edge Function usa estes valores para WO (< 11 = derrota 3x0) e buff de engajamento.
 */
async function syncTeamStatus(
  players: Record<string, PlayerEntity>,
  playerHealth: Record<string, PlayerHealth>,
  engagementScore: number,
) {
  const sb = getSupabase();
  if (!sb) return;

  let available = 0;
  for (const pid of Object.keys(players)) {
    const h = playerHealth[pid];
    if (h && (h.outForMatches > 0 || h.suspendedMatches > 0)) continue;
    available++;
  }

  const { data: session } = await sb.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) return;

  const { data: team } = await sb
    .from('global_league_teams')
    .select('id')
    .eq('manager_id', userId)
    .maybeSingle();
  if (!team) return;

  await sb
    .from('global_league_teams')
    .update({
      available_player_count: available,
      available_player_count_updated_at: new Date().toISOString(),
      engagement_score: engagementScore,
    })
    .eq('id', team.id);
}

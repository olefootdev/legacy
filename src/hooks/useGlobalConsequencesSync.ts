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

import { useEffect, useRef } from 'react';
import { useGameStore, dispatchGame } from '@/game/store';
import { globalRoundPlayedEvents } from '@/systems/playerHealth/fromGlobalMatch';
import { makeInboxItem } from '@/game/inboxItem';
import { getSupabase } from '@/supabase/client';
import { fetchMyOlexpBalance, spendMyOlefoot } from '@/wallet/olexpSync';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import { overallFromAttributes } from '@/entities/player';
import { expCostToOlefoot, managerProspectContractPremiumExp } from '@/playerContracts/playerContracts';
import {
  buildContractNudges,
  contractDeepLink,
  playersPendingAutoRenew,
} from '@/systems/contracts/contractEngagement';
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
  const inbox = useGameStore((s) => s.inbox);
  const createCostExp = useGameStore(
    (s) => s.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  );
  const autoRenewInFlight = useRef<Set<string>>(new Set());

  // Sync available_player_count + engagement_score para Supabase (debounced)
  useEffect(() => {
    if (!club || !players || Object.keys(players).length === 0) return;
    const timer = setTimeout(() => {
      syncTeamStatus(players as Record<string, PlayerEntity>, playerHealth, engagementScore);
    }, 2000);
    return () => clearTimeout(timer);
  }, [playerHealth, players, club, engagementScore]);

  // ── Nudge in-app: contrato vencido / a vencer → item de inbox acionável ────
  useEffect(() => {
    if (!players || Object.keys(players).length === 0) return;
    const existingIds = new Set((inbox ?? []).map((i) => i.id));
    const items = buildContractNudges(players as Record<string, PlayerEntity>, existingIds);
    if (items.length > 0) dispatchGame({ type: 'PUSH_INBOX_ITEMS', items });
  }, [players, inbox]);

  // ── Auto-renovação opt-in: debita OLEXP e renova contratos vencidos ────────
  // Tier de manutenção (50 jogos, o mais barato) — interação frequente e leve.
  useEffect(() => {
    if (!players) return;
    const targets = playersPendingAutoRenew(players as Record<string, PlayerEntity>).filter(
      (p) => !autoRenewInFlight.current.has(p.id),
    );
    if (targets.length === 0) return;
    // Reserva síncrona (antes de qualquer await) evita dupla-renovação por re-render.
    for (const p of targets) autoRenewInFlight.current.add(p.id);

    const tier = 50 as const;
    const expCost = Math.round(createCostExp * 0.5) + managerProspectContractPremiumExp(tier);
    const olexpCost = expCostToOlefoot(expCost);

    let cancelled = false;
    (async () => {
      let balance = await fetchMyOlexpBalance();
      const inboxItems = [];
      for (const p of targets) {
        if (cancelled) break;
        try {
          if (balance < olexpCost) {
            inboxItems.push(
              makeInboxItem(`autorenew-failed-${p.id}`, 'PLAYER_CONTRACT', 'PLANTEL', `Auto-renovação falhou — ${p.name}`, {
                body: `Sem OLEXP suficiente (${olexpCost} OLEXP) pra renovar ${p.name}. Recarregue OLEXP ou renove manualmente.`,
                deepLink: contractDeepLink(p.id),
                relatedPlayerIds: [p.id],
              }),
            );
            continue;
          }
          const result = await spendMyOlefoot({ amount: olexpCost, source: 'renovacao_contrato', sourceRef: p.id });
          if (result.ok === false) continue; // erro transitório → tenta no próximo scan
          balance = result.newBalance;
          dispatchGame({ type: 'RENEW_MANAGER_PROSPECT_CONTRACT', playerId: p.id, contractMatches: tier, paymentMethod: 'olefoot' });
          inboxItems.push(
            makeInboxItem(`autorenew-ok-${p.id}`, 'PLAYER_CONTRACT', 'PLANTEL', `Auto-renovado — ${p.name}`, {
              body: `Renovei ${p.name} por ${olexpCost} OLEXP (+${tier} jogos). Auto-renovação está ativa para este jogador.`,
              deepLink: contractDeepLink(p.id),
              relatedPlayerIds: [p.id],
            }),
          );
        } finally {
          // Sucesso: contractExpired vira false e o filtro não reentra.
          // Falha: liberamos pra retry no próximo scan.
          autoRenewInFlight.current.delete(p.id);
        }
      }
      if (!cancelled && inboxItems.length > 0) dispatchGame({ type: 'PUSH_INBOX_ITEMS', items: inboxItems });
    })();
    return () => {
      cancelled = true;
    };
  }, [players, createCostExp]);

  // ── Prêmio de Campeão de Temporada: lê coroações não-reclamadas e credita ───
  // Idempotência forte: marca claimed=true (condicional a claimed=false) ANTES
  // de dispatchar o crédito — se a linha já foi reclamada, não credita 2×.
  useEffect(() => {
    const email = managerProfile?.email;
    if (!email) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from('global_league_season_champions')
        .select('*')
        .eq('manager_id', email)
        .eq('claimed', false);
      if (cancelled || !data || data.length === 0) return;
      const items = [];
      for (const c of data as Array<Record<string, any>>) {
        const { data: upd } = await sb
          .from('global_league_season_champions')
          .update({ claimed: true })
          .eq('id', c.id)
          .eq('claimed', false)
          .select('id');
        if (!upd || upd.length === 0) continue; // reclamado em outra aba/sessão
        const ole = Number(c.prize_ole ?? 0);
        const exp = Number(c.prize_exp ?? 0);
        dispatchGame({ type: 'CLAIM_SEASON_CHAMPION_PRIZE', ole, exp, division: Number(c.division) });
        items.push(
          makeInboxItem(`season-champ-${c.id}`, 'FINANCE_EXP_GAIN', 'COMPETIÇÃO', `🏆 Campeão da Divisão ${c.division}!`, {
            body: `Sua equipe venceu a temporada da Div ${c.division} com ${c.points ?? 0} pts. Prêmio creditado: +${ole.toLocaleString('pt-BR')} OLE · +${exp.toLocaleString('pt-BR')} EXP.`,
            deepLink: '/match/global',
          }),
        );
      }
      if (!cancelled && items.length > 0) dispatchGame({ type: 'PUSH_INBOX_ITEMS', items });
    })();
    return () => {
      cancelled = true;
    };
  }, [managerProfile?.email, globalLeagueMVP?.seasonId]);

  // ── Prêmio do Mata-Mata Diário (Coroa do Dia): credita EXP por fase ─────────
  // Mesmo padrão do campeão sazonal: marca claimed=true (condicional) ANTES de
  // creditar, pra nunca pagar 2×. Uma linha por (time, fase) na Edge.
  useEffect(() => {
    const email = managerProfile?.email;
    if (!email) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from('global_league_ko_prizes')
        .select('*')
        .eq('manager_id', email)
        .eq('claimed', false);
      if (cancelled || !data || data.length === 0) return;
      const STAGE_LABEL: Record<string, string> = {
        qualified: 'Classificado pro Mata-Mata!', r16: 'Venceu as oitavas!',
        qf: 'Venceu as quartas!', sf: 'Venceu a semifinal!', final: '👑 Campeão do Dia!',
      };
      const items = [];
      for (const c of data as Array<Record<string, any>>) {
        const { data: upd } = await sb
          .from('global_league_ko_prizes')
          .update({ claimed: true })
          .eq('id', c.id)
          .eq('claimed', false)
          .select('id');
        if (!upd || upd.length === 0) continue; // reclamado em outra aba/sessão
        const exp = Number(c.prize_exp ?? 0);
        if (exp <= 0) continue;
        dispatchGame({ type: 'CLAIM_KO_PRIZE', exp, stage: String(c.stage ?? '') });
        items.push(
          makeInboxItem(`ko-prize-${c.id}`, 'FINANCE_EXP_GAIN', 'COMPETIÇÃO', `🏆 ${STAGE_LABEL[c.stage] ?? 'Mata-Mata do Dia'}`, {
            body: `Mata-Mata da Liga Global — prêmio creditado: +${exp.toLocaleString('pt-BR')} EXP.`,
            deepLink: '/match/global',
          }),
        );
      }
      if (!cancelled && items.length > 0) dispatchGame({ type: 'PUSH_INBOX_ITEMS', items });
    })();
    return () => {
      cancelled = true;
    };
  }, [managerProfile?.email, globalLeagueMVP?.seasonId]);

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

    // ── Passo 5: BATCH CATCH-UP do decremento contratual ────────────────────
    // Manager offline N rodadas perderia N-1 decrementos. Aqui detectamos
    // todas as rodadas perdidas e dispatchamos SÓ o decremento de contrato
    // pra cada uma (sem re-aplicar moral/health/inbox, que já estavam OK).
    // A rodada MAIS RECENTE segue pra applyRoundConsequences abaixo (full).
    const lastProcessedNum = lastProcessedRound
      ? parseInt(lastProcessedRound.split('_round_').pop() ?? '0', 10) || 0
      : 0;
    const latestRoundNum = currentRoundNum - 1;
    if (lastProcessedNum > 0 && latestRoundNum > lastProcessedNum + 1) {
      const lineupIdsForCatchup = Object.values(lineup).filter(
        (id) => id && players[id],
      ) as string[];
      // Itera rodadas perdidas (exclusive da última, que cai no full path).
      for (let rn = lastProcessedNum + 1; rn < latestRoundNum; rn++) {
        const missedRound = leagueRounds[rn - 1];
        if (!missedRound || missedRound.status !== 'finished') continue;
        const missedFixture = missedRound.fixtures.find(
          (f) => f.homeTeamId === myTeam.id || f.awayTeamId === myTeam.id,
        );
        if (!missedFixture || missedFixture.status !== 'finished') continue;
        dispatchGame({
          type: 'APPLY_CONTRACT_DECREMENT_FOR_PLAYED',
          playerIds: lineupIdsForCatchup,
        });
      }
    }

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

  // 1b. Contratos: decrementa 1 jogo pra cada escalado.
  // Dedupe garantido por lastProcessedGlobalRound (linha 67 acima) — uma rodada
  // global = um decremento por jogador participante.
  dispatchGame({
    type: 'APPLY_CONTRACT_DECREMENT_FOR_PLAYED',
    playerIds: lineupPlayerIds as string[],
  });

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

  // 6b. Daily challenges — atualiza progresso com resultado da Liga Global
  if (result === 'win') {
    dispatchGame({ type: 'UPDATE_CHALLENGE_PROGRESS', challengeType: 'win_matches' });
  }
  if (myScore > 0) {
    dispatchGame({ type: 'UPDATE_CHALLENGE_PROGRESS', challengeType: 'score_goals', increment: myScore });
    dispatchGame({ type: 'UPDATE_CHALLENGE_PROGRESS', challengeType: 'quick_goals' });
  }
  if (result === 'win' && theirScore === 0) {
    dispatchGame({ type: 'UPDATE_CHALLENGE_PROGRESS', challengeType: 'clean_sheet' });
  }
  if (result === 'win' && (myScore - theirScore) >= 3) {
    dispatchGame({ type: 'UPDATE_CHALLENGE_PROGRESS', challengeType: 'dominant_win' });
  }

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
  let ovrSum = 0;
  let ovrCount = 0;
  for (const pid of Object.keys(players)) {
    const p = players[pid];
    if (!p) continue;
    // Overall do time = média do elenco (mesma convenção do registro). Mantido em
    // sync pra o seed por divisão refletir investimento real — antes era setado 1×
    // no registro e nunca atualizava (ficava achatado no piso).
    ovrSum += overallFromAttributes(p.attrs);
    ovrCount++;
    // Contrato vencido tira o jogador do elenco útil (squadEligibility → 'contract').
    // É ISTO que faz "contrato vencido" finalmente impactar a Liga Global: derruba
    // o available_player_count e, abaixo de 11, gera WO legítimo.
    if (p.contractExpired === true) continue;
    const h = playerHealth[pid];
    if (h && (h.outForMatches > 0 || h.suspendedMatches > 0)) continue;
    available++;
  }
  // Clamp 40–99: respeita o CHECK da coluna. Sem isso, um elenco com média <40
  // faria o UPDATE inteiro falhar (e nada sincronizaria — o bug original).
  const teamOverall = ovrCount > 0
    ? Math.max(40, Math.min(99, Math.round(ovrSum / ovrCount)))
    : 40;

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
      overall: teamOverall,
    })
    .eq('id', team.id);
}

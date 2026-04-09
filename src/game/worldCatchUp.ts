import type { OlefootGameState } from './types';
import { gameMinutesFromRealMs } from '@/systems/time';
import type { PlayerEntity } from '@/entities/types';
import { runMatchMinute } from '@/engine/runMatchMinute';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { accrueOlexpDaily } from '@/wallet/olexp';
import { accrueGatDaily } from '@/wallet/gat';
import { createInitialWalletState } from '@/wallet/initial';

function recoverOffMatch(player: PlayerEntity, gameMinutes: number): PlayerEntity {
  const g = Math.min(gameMinutes, 360);
  const rec = (g / 120) * (8 + player.attrs.fisico / 25);
  return {
    ...player,
    fatigue: Math.max(0, player.fatigue - rec),
    injuryRisk: Math.max(0, player.injuryRisk - g / 200),
  };
}

function homeRosterFromLineupState(state: OlefootGameState): PlayerEntity[] {
  const lu = mergeLineupWithDefaults(state.lineup, state.players);
  const ids = new Set<string>(Object.values(lu));
  return Array.from(ids)
    .map((id) => state.players[id])
    .filter((p): p is PlayerEntity => Boolean(p));
}

/** Avança o mundo com base no tempo real enquanto o app esteve fechado. */
export function applyWorldCatchUp(state: OlefootGameState, nowMs: number): OlefootGameState {
  const prev = state.lastWorldRealMs;
  const delta = Math.max(0, Math.min(nowMs - prev, 1000 * 60 * 60 * 72));
  if (delta < 5000) {
    return { ...state, lastWorldRealMs: nowMs };
  }

  const gm = gameMinutesFromRealMs(delta);
  let players = { ...state.players };
  let liveMatch = state.liveMatch;
  let crowd = { ...state.crowd };

  const playingIds = new Set(liveMatch?.homePlayers.map((p) => p.playerId) ?? []);

  for (const [id, p] of Object.entries(players)) {
    if (playingIds.has(id) && liveMatch?.phase === 'playing') continue;
    players[id] = recoverOffMatch(p, gm);
  }

  if (liveMatch && liveMatch.phase === 'playing' && liveMatch.minute < 90) {
    let roster = homeRosterFromLineupState({ ...state, players });
    const maxSim = Math.min(40, Math.floor(gm), 90 - liveMatch.minute);
    for (let i = 0; i < maxSim; i++) {
      const homeRoster = roster.map((r) => players[r.id] ?? r);
      const { snapshot, updatedPlayers } = runMatchMinute({
        snapshot: liveMatch,
        homeRoster,
        allPlayers: players,
        crowdSupport: crowd.supportPercent,
        tacticalMentality: state.manager.tacticalMentality,
        tacticalStyle: state.manager.tacticalStyle,
        opponentStrength: state.nextFixture.opponent.strength,
        awayShort: state.nextFixture.opponent.shortName,
        opponentId: state.nextFixture.opponent.id,
      });
      liveMatch = snapshot;
      players = { ...players, ...updatedPlayers };
      roster = roster.map((r) => players[r.id] ?? r);
    }
    if (liveMatch.minute >= 90 && liveMatch.phase === 'playing') {
      liveMatch = {
        ...liveMatch,
        phase: 'postgame',
        events: [
          {
            id: `ft-offline-${nowMs}`,
            minute: 90,
            text: `90' — Tempo regulamentar (simulação offline).`,
            kind: 'whistle',
          },
          ...liveMatch.events,
        ],
      };
    }
  }

  crowd = {
    ...crowd,
    supportPercent: Math.min(98, Math.max(22, crowd.supportPercent + (gm > 180 ? 0.4 : -0.15))),
  };

  let wallet = state.finance.wallet ?? createInitialWalletState();
  wallet = { ...wallet, spotBroCents: state.finance.broCents };
  const todayStr = new Date(nowMs).toISOString().slice(0, 10);
  wallet = accrueOlexpDaily(wallet, todayStr);
  wallet = accrueGatDaily(wallet, todayStr);

  const broAdjust = wallet.spotBroCents - state.finance.broCents;
  const finance = { ...state.finance, broCents: state.finance.broCents + broAdjust, wallet };

  return { ...state, players, liveMatch, crowd, finance, lastWorldRealMs: nowMs };
}

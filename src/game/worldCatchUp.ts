import type { OlefootGameState } from './types';
import { gameMinutesFromRealMs } from '@/systems/time';
import type { PlayerEntity } from '@/entities/types';
import { runMatchMinute } from '@/engine/runMatchMinute';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { accrueOlexpDaily } from '@/wallet/olexp';
import { accrueGatDaily } from '@/wallet/gat';
import { createInitialWalletState } from '@/wallet/initial';
import { processLeagueScheduleDue } from '@/match/processLeagueSchedule';
import { mergeWalletIntoFinance } from './financeWalletSync';
import { effectiveCrowdSupportPercent, medicalDeptRecoverySpeedBonusPercent } from '@/clubStructures/benefits';
import { staffPhysicalRecoveryBonusPercent, staffRunMatchMinuteEffects } from '@/systems/staffBenefits';
// OLEFOOT PYTHON MODE — gate de fadiga regenera por absence tier
import { evaluateAbsence } from '@/systems/engagement/absencePenalty';
import { recoverHealthOffMatch } from '@/systems/playerHealth/reducer';

/** BRT = UTC-3 */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Retorna a data BRT como string YYYY-MM-DD */
function brtDateString(ms: number): string {
  return new Date(ms + BRT_OFFSET_MS).toISOString().split('T')[0]!;
}

/**
 * Aplica o avanço de dia do manager.
 * O dia incrementa quando a data BRT muda (reset às 00:00 BRT = 03:00 UTC).
 * hasDoneOnboarding nunca é resetado — protege a cerimônia de repetir.
 */
function applyManagerDayAdvance(
  settings: OlefootGameState['userSettings'],
  nowMs: number,
): OlefootGameState['userSettings'] {
  const todayBrt = brtDateString(nowMs);
  const lastReset = settings.lastDayResetDate;

  if (lastReset === todayBrt) return settings;

  // Primeiro boot: inicializa no Dia 1
  if (!lastReset) {
    return {
      ...settings,
      managerDay: 1,
      lastDayResetDate: todayBrt,
    };
  }

  // Novo dia BRT: incrementa
  return {
    ...settings,
    managerDay: (settings.managerDay ?? 1) + 1,
    lastDayResetDate: todayBrt,
  };
}

// recoverOffMatch removido — agora a recuperação roda em playerHealth (SSOT)
// via recoverHealthOffMatch. O campo legado PlayerEntity.fatigue é deprecado
// e não é mais atualizado aqui (UI lê de state.playerHealth).

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
  const medLvl = state.structures.medical_dept ?? 1;
  const staffPhys = staffPhysicalRecoveryBonusPercent(state.manager.staff);

  // OLEFOOT PYTHON MODE — se ausência ≥ moderate_36h, fadiga não regenera off-match
  const fatigueRegenOk = evaluateAbsence(state.managerPresence, Date.now()).effect.fatigueRegenEnabled;

  // Recuperação off-match agora atualiza playerHealth (SSOT), não PlayerEntity.fatigue.
  // playerHealth pode estar undefined em saves antigos — só atua se já hidratado.
  const fisicoById: Record<string, number> = {};
  for (const [id, p] of Object.entries(players)) {
    fisicoById[id] = p.attrs.fisico;
  }
  const activePlayingIds =
    liveMatch?.phase === 'playing' ? playingIds : new Set<string>();
  const nextPlayerHealth = state.playerHealth
    ? recoverHealthOffMatch(state.playerHealth, fisicoById, gm, {
        medicalBonusPct: medicalDeptRecoverySpeedBonusPercent(medLvl),
        staffPhysRecoveryPct: staffPhys,
        playingIds: activePlayingIds,
        fatigueRegenEnabled: fatigueRegenOk,
      })
    : state.playerHealth;

  if (
    liveMatch &&
    liveMatch.phase === 'playing' &&
    liveMatch.minute < 90 &&
    liveMatch.mode !== 'test2d'
  ) {
    let roster = homeRosterFromLineupState({ ...state, players });
    const maxSim = Math.min(40, Math.floor(gm), 90 - liveMatch.minute);
    const staffFx = staffRunMatchMinuteEffects(state.manager.staff);
    for (let i = 0; i < maxSim; i++) {
      const homeRoster = roster.map((r) => players[r.id] ?? r);
      const { snapshot, updatedPlayers } = runMatchMinute({
        snapshot: liveMatch,
        homeRoster,
        allPlayers: players,
        crowdSupport: effectiveCrowdSupportPercent(
          crowd.supportPercent,
          state.structures,
          state.nextFixture.isHome,
        ),
        tacticalMentality: state.manager.tacticalMentality,
        tacticalStyle: state.manager.tacticalStyle,
        opponentStrength: state.nextFixture.opponent.strength,
        awayShort: state.nextFixture.opponent.shortName,
        opponentId: state.nextFixture.opponent.id,
        staffMatchEffects: staffFx,
      });
      liveMatch = snapshot;
      players = { ...players, ...updatedPlayers };
      if (liveMatch.mode === 'quick' && liveMatch.quickInjurySub) break;
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

  const finance = mergeWalletIntoFinance(state.finance, wallet);

  let next: OlefootGameState = {
    ...state,
    players,
    liveMatch,
    crowd,
    finance,
    playerHealth: nextPlayerHealth,
    lastWorldRealMs: nowMs,
  };
  next = processLeagueScheduleDue(next, nowMs);
  next = { ...next, userSettings: applyManagerDayAdvance(next.userSettings, nowMs) };
  return next;
}

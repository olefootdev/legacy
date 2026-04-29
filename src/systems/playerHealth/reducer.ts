import { INJURY_MATCHES_OUT, type InjurySeverity } from '@/systems/injury';
import type {
  MatchHealthOutcome,
  MatchModeForHealth,
  MatchOutcomeEvent,
  PlayerHealth,
} from './types';

/** Fadiga >=80 OU injuryRisk >=70 → atRisk. AI usa pra propor descanso. */
const AT_RISK_FATIGUE = 80;
const AT_RISK_RISK = 70;

/** Fadiga crítica: dobra o crescimento de injuryRisk durante a partida. */
export const CRITICAL_FATIGUE_THRESHOLD = 100;

export function emptyHealth(playerId: string): PlayerHealth {
  return {
    playerId,
    fatigue: 0,
    injuryRisk: 0,
    outForMatches: 0,
    injurySeverity: null,
    yellowCardsByLeague: {},
    suspendedMatches: 0,
    atRisk: false,
    lastMatchAt: 0,
    lastMatchMode: null,
  };
}

export function recomputeAtRisk(h: PlayerHealth): PlayerHealth {
  const atRisk = h.fatigue >= AT_RISK_FATIGUE || h.injuryRisk >= AT_RISK_RISK;
  return atRisk === h.atRisk ? h : { ...h, atRisk };
}

/** Escala de fadiga acumulada em uma partida (minutos × intensidade). */
function fatigueDelta(minutes: number, intensity: number): number {
  return Math.min(60, (minutes / 90) * (24 + intensity * 28));
}

/** Crescimento natural de injuryRisk em partida; dobra se fadiga ≥100 ao entrar. */
function injuryRiskDelta(minutes: number, intensity: number, fatigueAtStart: number): number {
  const base = (minutes / 90) * (4 + intensity * 6);
  const mul = fatigueAtStart >= CRITICAL_FATIGUE_THRESHOLD ? 2 : 1;
  return base * mul;
}

/** 3 amarelos na mesma liga => 1 jogo de suspensão e zera contador. */
const YELLOW_LIMIT = 3;

function applySingleEvent(h: PlayerHealth, ev: MatchOutcomeEvent): PlayerHealth {
  const next: PlayerHealth = {
    ...h,
    lastMatchAt: ev.at,
    lastMatchMode: ev.matchMode as MatchModeForHealth,
  };

  switch (ev.type) {
    case 'played': {
      next.fatigue = Math.min(100, h.fatigue + fatigueDelta(ev.minutes, ev.intensity));
      next.injuryRisk = Math.min(
        100,
        h.injuryRisk + injuryRiskDelta(ev.minutes, ev.intensity, h.fatigue),
      );
      return next;
    }
    case 'injury': {
      next.injurySeverity = ev.severity;
      next.outForMatches = Math.max(h.outForMatches, INJURY_MATCHES_OUT[ev.severity]);
      next.injuryRisk = Math.max(0, h.injuryRisk - 15);
      return next;
    }
    case 'yellow_card': {
      const ledger = { ...h.yellowCardsByLeague };
      const cur = (ledger[ev.leagueId] ?? 0) + 1;
      if (cur >= YELLOW_LIMIT) {
        ledger[ev.leagueId] = 0;
        next.suspendedMatches = h.suspendedMatches + 1;
      } else {
        ledger[ev.leagueId] = cur;
      }
      next.yellowCardsByLeague = ledger;
      return next;
    }
    case 'red_card': {
      next.suspendedMatches = h.suspendedMatches + 1;
      return next;
    }
    case 'suspension': {
      next.suspendedMatches = h.suspendedMatches + ev.matches;
      return next;
    }
  }
}

/**
 * Aplica todos os eventos de UMA partida ao mapa de saúde.
 * É o ÚNICO ponto que muta playerHealth a partir de modos de jogo.
 */
export function applyMatchConsequences(
  prev: Record<string, PlayerHealth>,
  events: MatchOutcomeEvent[],
): { next: Record<string, PlayerHealth>; outcomes: MatchHealthOutcome[] } {
  const next: Record<string, PlayerHealth> = { ...prev };
  const outcomesById: Record<string, MatchHealthOutcome> = {};

  for (const ev of events) {
    const before = next[ev.playerId] ?? emptyHealth(ev.playerId);
    const afterRaw = applySingleEvent(before, ev);
    const after = recomputeAtRisk(afterRaw);
    next[ev.playerId] = after;

    const outcome = outcomesById[ev.playerId] ?? {
      playerId: ev.playerId,
      before,
      after,
      injured: null,
      newlySuspended: false,
      becameAtRisk: false,
    };
    outcome.after = after;
    if (ev.type === 'injury') outcome.injured = ev.severity;
    if (ev.type === 'red_card' || ev.type === 'suspension') outcome.newlySuspended = true;
    if (!before.atRisk && after.atRisk) outcome.becameAtRisk = true;
    outcomesById[ev.playerId] = outcome;
  }

  return { next, outcomes: Object.values(outcomesById) };
}

/** Decrementa outForMatches/suspendedMatches após cada jornada (qualquer modo). */
export function tickHealthRecovery(
  prev: Record<string, PlayerHealth>,
  opts: { medicalBonusPct?: number } = {},
): Record<string, PlayerHealth> {
  const bonus = opts.medicalBonusPct ?? 0;
  const next: Record<string, PlayerHealth> = {};
  for (const [id, h] of Object.entries(prev)) {
    if (h.outForMatches <= 0 && h.suspendedMatches <= 0) {
      next[id] = h;
      continue;
    }
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const fast = bonus > 0 && hash % 100 < bonus;
    const dec = fast ? 2 : 1;
    const newOut = Math.max(0, h.outForMatches - dec);
    const newSus = Math.max(0, h.suspendedMatches - 1);
    next[id] = recomputeAtRisk({
      ...h,
      outForMatches: newOut,
      suspendedMatches: newSus,
      injurySeverity: newOut === 0 ? null : h.injurySeverity,
    });
  }
  return next;
}

/** Boosters/itens da loja: reset de fadiga, redução de risco, cura instantânea. */
export function applyHealthEffect(
  h: PlayerHealth,
  effect:
    | { kind: 'reset_fatigue' }
    | { kind: 'reduce_injury_risk'; amount: number }
    | { kind: 'heal_injury' }
    | { kind: 'reduce_fatigue'; amount: number },
): PlayerHealth {
  switch (effect.kind) {
    case 'reset_fatigue':
      return recomputeAtRisk({ ...h, fatigue: 0 });
    case 'reduce_fatigue':
      return recomputeAtRisk({ ...h, fatigue: Math.max(0, h.fatigue - effect.amount) });
    case 'reduce_injury_risk':
      return recomputeAtRisk({ ...h, injuryRisk: Math.max(0, h.injuryRisk - effect.amount) });
    case 'heal_injury':
      return recomputeAtRisk({
        ...h,
        outForMatches: 0,
        injurySeverity: null,
      });
  }
}

/** Hidrata a partir de PlayerEntity-legado (campos fatigue/injuryRisk/outForMatches). */
export function healthFromLegacyPlayer(p: {
  id: string;
  fatigue?: number;
  injuryRisk?: number;
  outForMatches?: number;
}): PlayerHealth {
  return recomputeAtRisk({
    ...emptyHealth(p.id),
    fatigue: p.fatigue ?? 0,
    injuryRisk: p.injuryRisk ?? 0,
    outForMatches: p.outForMatches ?? 0,
  });
}

export type { InjurySeverity };

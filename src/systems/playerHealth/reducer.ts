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

/** Recuperação base de fadiga por tick (chamado após cada jornada). */
const FATIGUE_RECOVERY_BASE_PER_TICK = 10;
/** Recuperação base de injury risk por tick. */
const INJURY_RISK_RECOVERY_PER_TICK = 2;

/**
 * Tick pós-jornada: decrementa indisponibilidade (outForMatches/suspendedMatches)
 * E reduz fadiga + risco de lesão de TODOS os jogadores. Sem esta segunda parte,
 * jogadores nunca recuperavam (bug histórico) — único caminho era o item de loja.
 *
 * medicalBonusPct vem de (medicalDeptLevel - 1) * 10, ou seja:
 *   L1: 0%   L2: +10%   L3: +20%   L4: +30%   L5: +40%
 */
export function tickHealthRecovery(
  prev: Record<string, PlayerHealth>,
  opts: { medicalBonusPct?: number } = {},
): Record<string, PlayerHealth> {
  const bonus = opts.medicalBonusPct ?? 0;
  const fatigueRec = Math.round(FATIGUE_RECOVERY_BASE_PER_TICK * (1 + bonus / 100));
  const riskRec = Math.round(INJURY_RISK_RECOVERY_PER_TICK * (1 + bonus / 100));
  const next: Record<string, PlayerHealth> = {};
  for (const [id, h] of Object.entries(prev)) {
    let nextOut = h.outForMatches;
    let nextSus = h.suspendedMatches;
    let nextSeverity = h.injurySeverity;

    // Decremento de indisponibilidade só se houver
    if (h.outForMatches > 0 || h.suspendedMatches > 0) {
      const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const fast = bonus > 0 && hash % 100 < bonus;
      const decOut = fast ? 2 : 1;
      nextOut = Math.max(0, h.outForMatches - decOut);
      nextSus = Math.max(0, h.suspendedMatches - 1);
      nextSeverity = nextOut === 0 ? null : h.injurySeverity;
    }

    next[id] = recomputeAtRisk({
      ...h,
      outForMatches: nextOut,
      suspendedMatches: nextSus,
      injurySeverity: nextSeverity,
      fatigue: Math.max(0, h.fatigue - fatigueRec),
      injuryRisk: Math.max(0, h.injuryRisk - riskRec),
    });
  }
  return next;
}

/**
 * Recuperação off-match no SSOT (playerHealth). Substitui `recoverOffMatch`
 * em worldCatchUp.ts que mexia em PlayerEntity.fatigue (campo legado invisível
 * pra UI). Fórmula equivalente, mas agora atualiza o estado autoritativo.
 *
 * @param gameMinutes minutos de jogo equivalentes ao tempo offline (cap externo aplica)
 * @param medicalBonusPct (medicalDeptLevel - 1) * 10
 * @param staffPhysRecoveryPct bônus do staff
 * @param playingIds jogadores que estão em partida ativa — não recuperam
 * @param fatigueRegenEnabled false se manager ausente >36h
 */
export function recoverHealthOffMatch(
  prev: Record<string, PlayerHealth>,
  playerFisicoById: Record<string, number>,
  gameMinutes: number,
  opts: {
    medicalBonusPct?: number;
    staffPhysRecoveryPct?: number;
    playingIds?: Set<string>;
    fatigueRegenEnabled?: boolean;
  } = {},
): Record<string, PlayerHealth> {
  if (gameMinutes <= 0) return prev;
  if (opts.fatigueRegenEnabled === false) return prev;
  const medBonus = opts.medicalBonusPct ?? 0;
  const staffBonus = opts.staffPhysRecoveryPct ?? 0;
  const mult = 1 + medBonus / 100 + staffBonus / 100;
  const g = Math.min(gameMinutes, 360);
  const playing = opts.playingIds;

  const next: Record<string, PlayerHealth> = {};
  for (const [id, h] of Object.entries(prev)) {
    if (playing?.has(id)) {
      next[id] = h;
      continue;
    }
    const fisico = playerFisicoById[id] ?? 50;
    const rec = (g / 120) * (8 + fisico / 25) * mult;
    const riskRec = (g / 200) * mult;
    next[id] = recomputeAtRisk({
      ...h,
      fatigue: Math.max(0, h.fatigue - rec),
      injuryRisk: Math.max(0, h.injuryRisk - riskRec),
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

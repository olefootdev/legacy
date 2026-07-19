/**
 * Fase 2 do plano MELHORIAS_INTELIGENCIA_PARTIDAS.md — Status Contínuo.
 *
 * Agregadores que consolidam disponibilidade (SSOT playerHealth + contrato
 * + fadiga) num único ponto de leitura, sem criar nova fonte de verdade.
 *
 * Esses selectors são a base de:
 *  - UI pré-jogo (escalação provável, "novidades do elenco")
 *  - Fase 3 (squadDepletion como multiplicador em MatchContextModifiers)
 *  - Fase 1 (força efetiva como entrada do Monte Carlo)
 */

import type { PlayerEntity } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import { getPlayerHealth, fatigueOf } from '@/systems/playerHealth/selectors';
import { overallFromAttributes } from '@/entities/player';
import {
  buildDefaultLineupWithMeta,
  PITCH_SLOT_ORDER,
  FATIGUE_EXHAUSTED_THRESHOLD,
} from '@/entities/lineup';
import { unavailableReason } from '@/match/squadEligibility';

// ──────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ──────────────────────────────────────────────────────────────────────────

export type UnavailableReason =
  | 'no_player'
  | 'contract'
  | 'injured'
  | 'suspended'
  | 'exhausted';

export interface PlayerAvailabilityEntry {
  player: PlayerEntity;
  reason: UnavailableReason;
  /** Detalhe legível pra UI (ex.: "Lesão · 3 jogos"). */
  detail: string;
  /** Jogos restantes pro retorno (lesão/suspensão); null se outro motivo. */
  matchesUntilReturn: number | null;
}

export interface RiskEntry {
  player: PlayerEntity;
  fatigue: number;
  injuryRisk: number;
  /** 'fatigue' | 'injury' | 'contract'. */
  primaryRisk: 'fatigue' | 'injury' | 'contract';
  /** Detalhe legível pra UI (ex.: "Fadiga 86%"). */
  detail: string;
}

export interface AvailabilityReport {
  /** Quantos titulares estão escaláveis em modo strict (posição pura). */
  startersAvailable: number;
  /** Quantos reservas disponíveis (banco). */
  benchAvailable: number;
  /** Slots que ficariam vazios em XI strict — bloqueia jogo oficial. */
  emptySlots: { slotId: string; positionLabel: string }[];
  /** Jogadores indisponíveis (não escaláveis em nenhum slot). */
  unavailable: PlayerAvailabilityEntry[];
  /** Jogadores em risco (entram em campo, mas com alerta). */
  atRisk: RiskEntry[];
  /** Jogadores com contrato em alerta (≤ 10% restante mas ainda > 0). */
  contractAlerts: RiskEntry[];
  /** Pode entrar em jogo oficial agora? */
  canPlayOfficialMatch: boolean;
  /** Mensagem única quando `canPlayOfficialMatch=false`. */
  blockingReason: string | null;
}

export interface EffectiveTeamStrength {
  /** OVR base do XI strict (sem ajustes). 0–100. */
  baseOverall: number;
  /** OVR efetivo após penalidades de fadiga/contrato/risco. 0–100. */
  effectiveOverall: number;
  /** Multiplicador final aplicado (effective/base). Usado por Fase 3. */
  depletionMultiplier: number;
  /** Quantos titulares pesando no cálculo. */
  startersCounted: number;
  /** Penalidades nomeadas — auditáveis pra UI/debug. */
  penalties: {
    fatigue: number;
    contractWarning: number;
    forcedPosition: number;
  };
}

// Categorias do feed — auditáveis e estáveis pra UI.
export type StatusFeedKind =
  | 'injury_in'
  | 'injury_out'
  | 'suspension_in'
  | 'suspension_out'
  | 'contract_warning'
  | 'contract_expired'
  | 'fatigue_warning'
  | 'fatigue_recovered';

export interface StatusFeedItem {
  playerId: string;
  playerName: string;
  kind: StatusFeedKind;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  /** Quando o estado mudou. Lido por consumidores pra ordenar. */
  atMs: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers de detalhe legível
// ──────────────────────────────────────────────────────────────────────────

function detailFromReason(
  reason: UnavailableReason,
  h: PlayerHealth | undefined,
  p: PlayerEntity,
): { detail: string; matchesUntilReturn: number | null } {
  switch (reason) {
    case 'injured': {
      const matches = h?.outForMatches ?? p.outForMatches ?? 0;
      return { detail: `Lesão · ${matches} jogo${matches === 1 ? '' : 's'}`, matchesUntilReturn: matches };
    }
    case 'suspended': {
      const matches = h?.suspendedMatches ?? 0;
      return { detail: `Suspenso · ${matches} jogo${matches === 1 ? '' : 's'}`, matchesUntilReturn: matches };
    }
    case 'exhausted':
      return { detail: `Sem energia (${100 - Math.round(h?.fatigue ?? 0)}%)`, matchesUntilReturn: null };
    case 'contract':
      return { detail: 'Contrato vencido — renovar', matchesUntilReturn: null };
    case 'no_player':
      return { detail: 'Slot vazio', matchesUntilReturn: null };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Selector 1 — AvailabilityReport
// ──────────────────────────────────────────────────────────────────────────

/**
 * Snapshot estruturado da disponibilidade do plantel.
 * Usado pelo pré-jogo, SmartHub e (no futuro) pelo Monte Carlo da Fase 1.
 */
export function selectAvailabilityReport(args: {
  players: Record<string, PlayerEntity>;
  health: Record<string, PlayerHealth> | undefined;
}): AvailabilityReport {
  const { players, health } = args;
  const allPlayers = Object.values(players);

  // XI strict-position (sem improviso) — bate com squadEligibility.
  const build = buildDefaultLineupWithMeta(players, { strictPosition: true });
  const startersIds = new Set(Object.values(build.lineup));

  const unavailable: PlayerAvailabilityEntry[] = [];
  const atRisk: RiskEntry[] = [];
  const contractAlerts: RiskEntry[] = [];

  for (const p of allPlayers) {
    const h = health?.[p.id];
    const reason = unavailableReason(p, health);

    if (reason !== null) {
      const { detail, matchesUntilReturn } = detailFromReason(reason, h, p);
      unavailable.push({ player: p, reason, detail, matchesUntilReturn });
      continue;
    }

    // Em risco mas escalável.
    const fatigue = h?.fatigue ?? p.fatigue ?? 0;
    const injuryRisk = h?.injuryRisk ?? p.injuryRisk ?? 0;
    if (fatigue >= 80) {
      atRisk.push({
        player: p,
        fatigue,
        injuryRisk,
        primaryRisk: 'fatigue',
        detail: `Fadiga ${Math.round(fatigue)}%`,
      });
    } else if (injuryRisk >= 70) {
      atRisk.push({
        player: p,
        fatigue,
        injuryRisk,
        primaryRisk: 'injury',
        detail: `Risco de lesão ${Math.round(injuryRisk)}%`,
      });
    }

    // Contrato em alerta (≤ 10% restante, mas ainda jogando).
    if (
      p.contractIsLifetime !== true &&
      typeof p.contractMatchesRemaining === 'number' &&
      typeof p.contractMatchesIncluded === 'number' &&
      p.contractMatchesIncluded > 0
    ) {
      const pct = p.contractMatchesRemaining / p.contractMatchesIncluded;
      if (pct > 0 && pct <= 0.1) {
        contractAlerts.push({
          player: p,
          fatigue,
          injuryRisk,
          primaryRisk: 'contract',
          detail: `Contrato · ${p.contractMatchesRemaining} jogo${p.contractMatchesRemaining === 1 ? '' : 's'} restante${p.contractMatchesRemaining === 1 ? '' : 's'}`,
        });
      }
    }
  }

  const startersAvailable = startersIds.size;
  const benchAvailable = allPlayers.filter(
    (p) => !startersIds.has(p.id) && unavailableReason(p, health) === null,
  ).length;

  const emptySlots = build.emptySlotIds.map((slotId) => ({
    slotId,
    positionLabel: PITCH_SLOT_ORDER.find((s) => s.id === slotId)?.label ?? slotId,
  }));

  const canPlayOfficialMatch = emptySlots.length === 0 && startersAvailable >= 11 && benchAvailable >= 5;
  const blockingReason = canPlayOfficialMatch
    ? null
    : emptySlots.length > 0
      ? `Sem jogador puro disponível para: ${emptySlots.map((s) => s.positionLabel).join(', ')}.`
      : startersAvailable < 11
        ? `Titulares disponíveis: ${startersAvailable}/11.`
        : `Banco insuficiente: ${benchAvailable}/5.`;

  return {
    startersAvailable,
    benchAvailable,
    emptySlots,
    unavailable,
    atRisk,
    contractAlerts,
    canPlayOfficialMatch,
    blockingReason,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Selector 2 — EffectiveTeamStrength
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calcula o OVR efetivo do XI provável descontando penalidades visíveis.
 *
 * Output é a entrada canônica de:
 *   - Fase 3 (squadDepletion multiplier no SpiritContext)
 *   - Fase 1 (homeTeamAvg fundo do Monte Carlo)
 *
 * Penalidades são limitadas e auditáveis — nada de número mágico.
 */
export function selectEffectiveTeamStrength(args: {
  players: Record<string, PlayerEntity>;
  health: Record<string, PlayerHealth> | undefined;
}): EffectiveTeamStrength {
  const { players, health } = args;
  const build = buildDefaultLineupWithMeta(players, { strictPosition: true });
  const starterIds = Object.values(build.lineup);

  if (starterIds.length === 0) {
    return {
      baseOverall: 0,
      effectiveOverall: 0,
      depletionMultiplier: 0,
      startersCounted: 0,
      penalties: { fatigue: 0, contractWarning: 0, forcedPosition: 0 },
    };
  }

  let baseSum = 0;
  let fatiguePenalty = 0;
  let contractPenalty = 0;
  const forcedPositionCount = build.forcedExhaustedIds.length;

  for (const pid of starterIds) {
    const p = players[pid];
    if (!p) continue;
    const ovr = overallFromAttributes(p.attrs, p.pos);
    baseSum += ovr;

    const f = fatigueOf(health, p);
    // Penalidade de fadiga: linear acima de 70%, máx -4 OVR por jogador.
    if (f > 70) {
      fatiguePenalty += Math.min(4, (f - 70) * 0.13);
    }

    // Penalidade de contrato em alerta (≤ 10% restante) — jogador menos motivado.
    if (
      p.contractIsLifetime !== true &&
      typeof p.contractMatchesRemaining === 'number' &&
      typeof p.contractMatchesIncluded === 'number' &&
      p.contractMatchesIncluded > 0
    ) {
      const pct = p.contractMatchesRemaining / p.contractMatchesIncluded;
      if (pct > 0 && pct <= 0.1) {
        contractPenalty += 1.5; // -1.5 OVR por starter em fim de contrato
      }
    }
  }

  const baseOverall = baseSum / starterIds.length;
  // Penalidade média por jogador.
  const avgFatigue = fatiguePenalty / starterIds.length;
  const avgContract = contractPenalty / starterIds.length;
  // Cada slot forçado custa -1.0 OVR no time (forçaram exausto pra cobrir).
  const avgForced = (forcedPositionCount * 1.0) / starterIds.length;

  const totalPenalty = Math.min(8, avgFatigue + avgContract + avgForced);
  const effectiveOverall = Math.max(0, baseOverall - totalPenalty);
  const depletionMultiplier = baseOverall > 0 ? effectiveOverall / baseOverall : 0;

  return {
    baseOverall,
    effectiveOverall,
    depletionMultiplier,
    startersCounted: starterIds.length,
    penalties: {
      fatigue: avgFatigue,
      contractWarning: avgContract,
      forcedPosition: avgForced,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Selector 3 — StatusFeed
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lista de "novidades do elenco" pra UI do SmartHub/pré-jogo.
 *
 * Diferente dos outros selectors, este compara o estado ATUAL contra um
 * snapshot anterior (passado como `previous`). Sem snapshot, só alertas
 * vigentes são emitidos (contract_warning, fatigue_warning).
 *
 * Consumidor armazena o último snapshot que viu (timestamp de leitura)
 * e passa de volta na próxima chamada pra ver as transições.
 */
export function selectStatusFeed(args: {
  players: Record<string, PlayerEntity>;
  health: Record<string, PlayerHealth> | undefined;
  previous?: Record<string, PlayerHealth>;
  /** Timestamp pra eventos derivados de "agora". */
  nowMs?: number;
}): StatusFeedItem[] {
  const { players, health, previous, nowMs = Date.now() } = args;
  const items: StatusFeedItem[] = [];

  for (const p of Object.values(players)) {
    const cur = health?.[p.id];
    const prev = previous?.[p.id];

    // Transições só se temos snapshot anterior.
    if (prev && cur) {
      // Entrou em recuperação (lesão nova).
      if (prev.outForMatches === 0 && cur.outForMatches > 0) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'injury_in',
          severity: 'critical',
          message: `${p.name} sofreu lesão — ${cur.outForMatches} jogo${cur.outForMatches === 1 ? '' : 's'} fora.`,
          atMs: cur.lastMatchAt || nowMs,
        });
      }
      // Retornou de lesão.
      if (prev.outForMatches > 0 && cur.outForMatches === 0) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'injury_out',
          severity: 'info',
          message: `${p.name} está de volta da lesão.`,
          atMs: cur.lastMatchAt || nowMs,
        });
      }
      // Entrou em suspensão.
      if (prev.suspendedMatches === 0 && cur.suspendedMatches > 0) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'suspension_in',
          severity: 'warning',
          message: `${p.name} suspenso — ${cur.suspendedMatches} jogo${cur.suspendedMatches === 1 ? '' : 's'}.`,
          atMs: cur.lastMatchAt || nowMs,
        });
      }
      // Saiu de suspensão.
      if (prev.suspendedMatches > 0 && cur.suspendedMatches === 0) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'suspension_out',
          severity: 'info',
          message: `${p.name} cumpriu suspensão.`,
          atMs: cur.lastMatchAt || nowMs,
        });
      }
      // Fadiga subindo pro crítico.
      if (prev.fatigue < FATIGUE_EXHAUSTED_THRESHOLD && cur.fatigue >= FATIGUE_EXHAUSTED_THRESHOLD) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'fatigue_warning',
          severity: 'warning',
          message: `${p.name} está exausto (${Math.round(cur.fatigue)}%).`,
          atMs: cur.lastMatchAt || nowMs,
        });
      }
      // Fadiga voltou ao saudável.
      if (prev.fatigue >= FATIGUE_EXHAUSTED_THRESHOLD && cur.fatigue < 60) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'fatigue_recovered',
          severity: 'info',
          message: `${p.name} recuperou energia.`,
          atMs: cur.lastMatchAt || nowMs,
        });
      }
    }

    // Alertas vigentes (sempre emitidos).
    if (p.contractExpired === true) {
      items.push({
        playerId: p.id,
        playerName: p.name,
        kind: 'contract_expired',
        severity: 'critical',
        message: `${p.name} com contrato vencido — não pode entrar em XI oficial.`,
        atMs: nowMs,
      });
    } else if (
      p.contractIsLifetime !== true &&
      typeof p.contractMatchesRemaining === 'number' &&
      typeof p.contractMatchesIncluded === 'number' &&
      p.contractMatchesIncluded > 0
    ) {
      const pct = p.contractMatchesRemaining / p.contractMatchesIncluded;
      if (pct > 0 && pct <= 0.1) {
        items.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'contract_warning',
          severity: 'warning',
          message: `${p.name} · ${p.contractMatchesRemaining} jogo${p.contractMatchesRemaining === 1 ? '' : 's'} de contrato.`,
          atMs: nowMs,
        });
      }
    }
  }

  return items.sort((a, b) => b.atMs - a.atMs);
}

/**
 * OLEFOOT PYTHON MODE — Dicas aditivas (quick hooks).
 *
 * Geração de "ganchos" curtos pra trazer manager de volta rapidinho.
 * Esses hooks viram push notifications, badges no PWA, ou banners no
 * topo do app quando manager está em sessão.
 *
 * Política: NUNCA mais que 3 hooks ativos simultâneos por manager,
 * priorização por urgência + relevância.
 */
import type { PastResult } from '@/entities/types';
import type { PersistentConsequence } from '@/systems/consequences/types';
import { MS_PER_HOUR } from '@/systems/timeCalibration';
import type { QuickHook } from './types';

const MAX_ACTIVE_HOOKS = 3;

let _hookCounter = 0;
function genHookId(prefix: string): string {
  _hookCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_hookCounter.toString(36)}`;
}

// ─── Builders ──────────────────────────────────────────────────────

export function buildStarPerformingHook(
  playerName: string,
  context: string,
  nowMs: number = Date.now(),
): QuickHook {
  return {
    id: genHookId('star'),
    kind: 'star_performing',
    title: `${playerName} tá voando`,
    body: context, // ex: "3 gols em 5 partidas"
    preferredSlotKind: 'short',
    validFrom: nowMs,
    validUntil: nowMs + 2 * MS_PER_HOUR,
    route: '/clube/elenco',
    priority: 70,
  };
}

export function buildCliffhangerHook(
  reason: string,
  nowMs: number = Date.now(),
): QuickHook {
  return {
    id: genHookId('cliff'),
    kind: 'cliffhanger',
    title: 'Algo aconteceu no vestiário',
    body: reason,
    preferredSlotKind: 'any',
    validFrom: nowMs,
    validUntil: nowMs + 4 * MS_PER_HOUR,
    route: '/clube/elenco',
    priority: 80,
  };
}

export function buildTimeLimitedOfferHook(
  playerName: string,
  msUntilExpiry: number,
  nowMs: number = Date.now(),
): QuickHook {
  const minutes = Math.round(msUntilExpiry / 60000);
  return {
    id: genHookId('offer'),
    kind: 'time_limited_offer',
    title: `Oferta pelo ${playerName} expira em ${minutes}min`,
    preferredSlotKind: 'any',
    validFrom: nowMs,
    validUntil: nowMs + msUntilExpiry,
    route: '/mercado/transfer',
    priority: 90,
  };
}

export function buildStreakPreservationHook(
  streakDays: number,
  msUntilBreak: number,
  nowMs: number = Date.now(),
): QuickHook {
  return {
    id: genHookId('streak'),
    kind: 'streak_preservation',
    title: `Não perca sua sequência de ${streakDays} dias`,
    body: 'Bastam 30s pra manter ativa.',
    preferredSlotKind: 'short',
    validFrom: nowMs,
    validUntil: nowMs + msUntilBreak,
    route: '/',
    priority: 85,
  };
}

export function buildMatchStartingHook(
  opponent: string,
  msUntilKickoff: number,
  nowMs: number = Date.now(),
): QuickHook {
  const minutes = Math.max(1, Math.round(msUntilKickoff / 60000));
  return {
    id: genHookId('kickoff'),
    kind: 'match_starting',
    title: `Próxima partida em ${minutes}min`,
    body: `vs ${opponent}`,
    preferredSlotKind: 'any',
    validFrom: nowMs,
    validUntil: nowMs + msUntilKickoff,
    route: '/live-match',
    priority: 95,
  };
}

export function buildRivalChallengeHook(
  rivalName: string,
  nowMs: number = Date.now(),
): QuickHook {
  return {
    id: genHookId('rival'),
    kind: 'rival_challenge',
    title: `${rivalName} te ofereceu amistoso`,
    preferredSlotKind: 'short',
    validFrom: nowMs,
    validUntil: nowMs + 3 * MS_PER_HOUR,
    route: '/manager/network',
    priority: 75,
  };
}

// ─── Auto-detect (a partir de estado) ──────────────────────────────

export interface AutoHookInput {
  recentResults: PastResult[];
  activeConsequences: PersistentConsequence[];
  streakDays?: number;
  nextMatchOpponent?: string;
  nextMatchAtMs?: number;
  pendingTransferOffers?: Array<{ playerName: string; expiresAtMs: number }>;
}

/** Gera hooks automaticamente a partir do estado atual do clube. */
export function autoDetectHooks(input: AutoHookInput, nowMs: number = Date.now()): QuickHook[] {
  const hooks: QuickHook[] = [];

  // Estrela performando: jogador que apareceu como scoutMvp 2+ vezes nos últimos 5 resultados
  if (input.recentResults.length >= 2) {
    const mvpCounts = new Map<string, { name: string; count: number }>();
    for (const r of input.recentResults.slice(-5)) {
      if (!r.scoutMvp) continue;
      const cur = mvpCounts.get(r.scoutMvp.playerId) ?? { name: r.scoutMvp.name ?? 'jogador', count: 0 };
      cur.count += 1;
      mvpCounts.set(r.scoutMvp.playerId, cur);
    }
    for (const [, entry] of mvpCounts) {
      if (entry.count >= 2) {
        hooks.push(buildStarPerformingHook(entry.name, `${entry.count} MVPs recentes`, nowMs));
        break;
      }
    }
  }

  // Lesão grave recente → cliffhanger
  const severeInjury = input.activeConsequences.find(
    (c) => c.kind === 'injury_severe_out' && (nowMs - c.startsAt) < 30 * 60 * 1000,
  );
  if (severeInjury) {
    hooks.push(buildCliffhangerHook('Lesão grave em jogador-chave', nowMs));
  }

  // Streak em risco (< 2h pra perder)
  if (input.streakDays && input.streakDays >= 3) {
    // Heurística simples: se já passou de 22h sem login, dispara
    // (próximo refino: usar lastLoginAt real)
    hooks.push(buildStreakPreservationHook(input.streakDays, 2 * MS_PER_HOUR, nowMs));
  }

  // Próxima partida iminente
  if (input.nextMatchOpponent && input.nextMatchAtMs) {
    const ms = input.nextMatchAtMs - nowMs;
    if (ms > 0 && ms < 10 * 60 * 1000) {
      hooks.push(buildMatchStartingHook(input.nextMatchOpponent, ms, nowMs));
    }
  }

  // Ofertas com prazo
  for (const offer of input.pendingTransferOffers ?? []) {
    const msLeft = offer.expiresAtMs - nowMs;
    if (msLeft > 0 && msLeft < 30 * 60 * 1000) {
      hooks.push(buildTimeLimitedOfferHook(offer.playerName, msLeft, nowMs));
    }
  }

  // Top N por prioridade
  hooks.sort((a, b) => b.priority - a.priority);
  return hooks.slice(0, MAX_ACTIVE_HOOKS);
}

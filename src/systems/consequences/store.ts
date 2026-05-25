/**
 * OLEFOOT PYTHON MODE — Store de consequências (CRUD puro + decay).
 *
 * Funções imutáveis: nunca mutam o estado de entrada, sempre retornam novo.
 * Reducer + Supabase consomem isto. Python lê do Supabase direto.
 */
import type {
  ConsequenceStoreState,
  EvaluatedConsequence,
  PersistentConsequence,
} from './types';
import { EMPTY_CONSEQUENCE_STORE } from './types';

// ─── CRUD ──────────────────────────────────────────────────────────

export function addConsequence(
  store: ConsequenceStoreState,
  c: PersistentConsequence,
): ConsequenceStoreState {
  return {
    ...store,
    active: { ...store.active, [c.id]: c },
  };
}

export function addManyConsequences(
  store: ConsequenceStoreState,
  list: PersistentConsequence[],
): ConsequenceStoreState {
  if (!list.length) return store;
  const active = { ...store.active };
  for (const c of list) active[c.id] = c;
  return { ...store, active };
}

export function removeConsequence(
  store: ConsequenceStoreState,
  id: string,
): ConsequenceStoreState {
  if (!store.active[id]) return store;
  const { [id]: _, ...rest } = store.active;
  return { ...store, active: rest };
}

/** Roda decay + remove expirados. Retorna store + ids removidos. */
export function tickConsequences(
  store: ConsequenceStoreState,
  nowMs: number,
): { next: ConsequenceStoreState; expiredIds: string[] } {
  const expiredIds: string[] = [];
  const active: Record<string, PersistentConsequence> = {};
  for (const [id, c] of Object.entries(store.active)) {
    if (nowMs >= c.expiresAt) {
      expiredIds.push(id);
    } else {
      active[id] = c;
    }
  }
  return {
    next: { active, lastTickAt: nowMs },
    expiredIds,
  };
}

// ─── Queries ───────────────────────────────────────────────────────

export function getActiveFor(
  store: ConsequenceStoreState,
  filter: { playerId?: string; clubId?: string; dimension?: string },
  nowMs: number = Date.now(),
): PersistentConsequence[] {
  return Object.values(store.active).filter((c) => {
    if (c.expiresAt <= nowMs) return false;
    if (filter.playerId && c.playerId !== filter.playerId) return false;
    if (filter.clubId && c.clubId !== filter.clubId) return false;
    if (filter.dimension && c.dimension !== filter.dimension) return false;
    return true;
  });
}

// ─── Decay ─────────────────────────────────────────────────────────

/** Valor efetivo agora segundo a curva de decay. */
export function evaluateConsequence(
  c: PersistentConsequence,
  nowMs: number = Date.now(),
): EvaluatedConsequence {
  const total = c.expiresAt - c.startsAt;
  const elapsed = Math.max(0, nowMs - c.startsAt);
  const lifeRemaining = Math.max(0, Math.min(1, 1 - elapsed / total));
  const msUntilExpiry = Math.max(0, c.expiresAt - nowMs);

  let currentValue = 0;
  if (msUntilExpiry > 0) {
    switch (c.decayCurve) {
      case 'step':
        currentValue = c.magnitude;
        break;
      case 'linear':
        currentValue = c.magnitude * lifeRemaining;
        break;
      case 'exponential': {
        // half-life = total/2 → após total/2 vale 50% da magnitude.
        const halfLife = total / 2;
        const decayFactor = Math.pow(0.5, elapsed / halfLife);
        currentValue = c.magnitude * decayFactor;
        break;
      }
    }
  }

  return { consequence: c, currentValue, lifeRemaining, msUntilExpiry };
}

/** Soma todos os valores efetivos de uma dimensão pra um alvo. */
export function sumEffectiveForTarget(
  store: ConsequenceStoreState,
  filter: { playerId?: string; clubId?: string; dimension: string; kindPrefix?: string },
  nowMs: number = Date.now(),
): number {
  let total = 0;
  for (const c of Object.values(store.active)) {
    if (c.expiresAt <= nowMs) continue;
    if (c.dimension !== filter.dimension) continue;
    if (filter.playerId && c.playerId !== filter.playerId) continue;
    if (filter.clubId && c.clubId !== filter.clubId) continue;
    if (filter.kindPrefix && !c.kind.startsWith(filter.kindPrefix)) continue;
    total += evaluateConsequence(c, nowMs).currentValue;
  }
  return total;
}

/**
 * Kinds que tornam o jogador indisponível pra escalação.
 * Whitelist explícita — espelha `UNAVAILABILITY_KINDS` em applyOverlay.ts.
 */
const UNAVAILABILITY_KINDS = new Set<string>([
  'red_card_suspension',
  'red_card_suspension_repeat',
  'injury_light_out',
  'injury_medium_out',
  'injury_severe_out',
  'forced_rest',
]);

/** Helper: jogador está indisponível (suspensão/lesão ativa)? */
export function isPlayerUnavailable(
  store: ConsequenceStoreState,
  playerId: string,
  nowMs: number = Date.now(),
): boolean {
  for (const c of Object.values(store.active)) {
    if (c.playerId !== playerId) continue;
    if (c.expiresAt <= nowMs) continue;
    if (!UNAVAILABILITY_KINDS.has(c.kind)) continue;
    if (evaluateConsequence(c, nowMs).currentValue > 0) return true;
  }
  return false;
}

export { EMPTY_CONSEQUENCE_STORE };

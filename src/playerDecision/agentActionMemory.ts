/**
 * agentActionMemory.ts — Lightweight per-agent action history.
 *
 * Resolve F1 low-margin warning + ambiguidade entre candidates de score
 * similar: o `applyInertiaBonus` no engine Utility AI requer um
 * `previousActionId` por agente. Este módulo provê a state minimalista
 * sem invadir tipos de DecisionContext.
 *
 * Escopo: 3 streams paralelos (shoot, fullback, attacking) — cada um
 * mantém seu próprio Map (não compartilham IDs entre domínios).
 *
 * Memory budget: ~22 agentes × 3 streams = ~66 entries × ~80 bytes ≈ 5 KB.
 * TTL implícito: substituído a cada decisão; nunca cresce além de N agentes.
 *
 * NÃO é singleton global por design — cada utility entry-point usa o
 * helper apropriado (shoot/fullback/attacking) sem cross-contamination.
 */

interface MemoryEntry {
  actionId: string;
  /** ms since module load — telemetria/debug only. */
  t: number;
}

const SHOOT_MEMORY = new Map<string, MemoryEntry>();
const FULLBACK_MEMORY = new Map<string, MemoryEntry>();
const ATTACKING_MEMORY = new Map<string, MemoryEntry>();

const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

// ---------------------------------------------------------------------------
// SHOOT (atualmente shoot_instinct é o único candidate; mantido por simetria)
// ---------------------------------------------------------------------------

export function recordShootAction(agentId: string, actionId: string): void {
  SHOOT_MEMORY.set(agentId, { actionId, t: nowMs() });
}

export function getLastShootAction(agentId: string): string | null {
  return SHOOT_MEMORY.get(agentId)?.actionId ?? null;
}

// ---------------------------------------------------------------------------
// FULLBACK (4 candidates: overlap_run, offer_short_line, defensive_cover, open_width)
// ---------------------------------------------------------------------------

export function recordFullbackAction(agentId: string, actionId: string): void {
  FULLBACK_MEMORY.set(agentId, { actionId, t: nowMs() });
}

export function getLastFullbackAction(agentId: string): string | null {
  return FULLBACK_MEMORY.get(agentId)?.actionId ?? null;
}

// ---------------------------------------------------------------------------
// ATTACKING (10 candidates do dispatcher)
// ---------------------------------------------------------------------------

export function recordAttackingAction(agentId: string, actionId: string): void {
  ATTACKING_MEMORY.set(agentId, { actionId, t: nowMs() });
}

export function getLastAttackingAction(agentId: string): string | null {
  return ATTACKING_MEMORY.get(agentId)?.actionId ?? null;
}

// ---------------------------------------------------------------------------
// Utility — clear all (HMR / test reset)
// ---------------------------------------------------------------------------

export function clearAllAgentMemories(): void {
  SHOOT_MEMORY.clear();
  FULLBACK_MEMORY.clear();
  ATTACKING_MEMORY.clear();
}

/** DEV inspection helper. */
if (typeof window !== 'undefined') {
  try {
    if (import.meta.env?.DEV === true) {
      const w = window as unknown as Record<string, unknown>;
      w.__agentMemory = () => ({
        shoot: Object.fromEntries(SHOOT_MEMORY),
        fullback: Object.fromEntries(FULLBACK_MEMORY),
        attacking: Object.fromEntries(ATTACKING_MEMORY),
      });
      w.__agentMemoryClear = clearAllAgentMemories;
    }
  } catch {
    // SSR / non-Vite environments — silent no-op.
  }
}

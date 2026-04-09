import type { PitchPoint, PossessionSide } from '@/engine/types';
import type { BallZone } from '@/gamespirit/types';

/** Fases lógicas do motor textual (minuto a minuto), independentes do FSM do pitch 3D. */
export type EngineSimPhase = 'LIVE' | 'GOAL_RESTART' | 'KICKOFF_PENDING' | 'STOPPED';

/**
 * Evento causal append-only: placar, bola e posse só mudam com entrada coerente no log.
 * `simTime` ordena eventos no mesmo minuto (fração decimal).
 */
export type CausalMatchEvent =
  | {
      seq: number;
      simTime: number;
      type: 'shot_attempt';
      payload: {
        side: PossessionSide;
        shooterId: string;
        zone: BallZone;
        minute: number;
        /** Alvo heurístico da trajetória (UI %), opcional */
        target?: PitchPoint;
      };
    }
  | {
      seq: number;
      simTime: number;
      type: 'shot_result';
      payload: {
        side: PossessionSide;
        shooterId: string;
        /** `post_in` conta como golo; `wide` = remate ao lado (reinício / posse). */
        outcome: 'goal' | 'save' | 'miss' | 'block' | 'post_in' | 'post_out' | 'wide';
      };
    }
  | {
      seq: number;
      simTime: number;
      type: 'phase_change';
      payload: { from: EngineSimPhase; to: EngineSimPhase; reason?: string };
    }
  | {
      seq: number;
      simTime: number;
      type: 'ball_state';
      payload: PitchPoint & { reason: string };
    }
  | {
      seq: number;
      simTime: number;
      type: 'possession_change';
      payload: { to: PossessionSide; reason?: string };
    };

export interface CausalLogState {
  /** Próximo seq a atribuir (monotónico na partida). */
  nextSeq: number;
  entries: CausalMatchEvent[];
}

const MAX_CAUSAL_ENTRIES = 2000;

export function appendCausalEntries(state: CausalLogState | undefined, batch: CausalMatchEvent[]): CausalLogState {
  const prev = state ?? { nextSeq: 1, entries: [] };
  if (batch.length === 0) return prev;
  const merged = [...prev.entries, ...batch];
  const trimmed = merged.length > MAX_CAUSAL_ENTRIES ? merged.slice(-MAX_CAUSAL_ENTRIES) : merged;
  const lastSeq = batch.length ? batch[batch.length - 1]!.seq : prev.nextSeq - 1;
  return {
    nextSeq: lastSeq + 1,
    entries: trimmed,
  };
}

/** Incrementa placar só a partir de `shot_result` com outcome goal neste lote. */
export function scoreDeltaFromEvents(events: CausalMatchEvent[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (
      e.type === 'shot_result' &&
      (e.payload.outcome === 'goal' || e.payload.outcome === 'post_in')
    ) {
      if (e.payload.side === 'home') home += 1;
      else away += 1;
    }
  }
  return { home, away };
}

/**
 * Validação para testes / debug: cada goal no lote tem shot_attempt do mesmo shooter antes do shot_result.
 */
export function validateGoalChain(events: CausalMatchEvent[]): boolean {
  let pendingShot: { side: PossessionSide; shooterId: string } | null = null;

  for (const e of events) {
    if (e.type === 'shot_attempt') {
      pendingShot = { side: e.payload.side, shooterId: e.payload.shooterId };
    } else if (e.type === 'shot_result') {
      if (e.payload.outcome === 'goal' || e.payload.outcome === 'post_in') {
        if (!pendingShot || pendingShot.shooterId !== e.payload.shooterId || pendingShot.side !== e.payload.side) {
          return false;
        }
      }
      pendingShot = null;
    }
  }
  return true;
}

export function createCausalBatch(minute: number, startSeq: number) {
  const out: CausalMatchEvent[] = [];
  let seq = startSeq;
  let ord = 0;
  const simT = () => minute + ord++ * 0.001;

  return {
    push(event: Omit<CausalMatchEvent, 'seq' | 'simTime'>): void {
      const simTime = simT();
      out.push({ ...event, seq: seq++, simTime } as CausalMatchEvent);
    },
    events: out,
    lastSeq: () => seq - 1,
  };
}

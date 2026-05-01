/**
 * Dummy Runs: atacante arrasta 2 zagueiros, bola não vem, freia e trota voltando.
 * Estado por agente.
 */

import { FIELD_LENGTH } from '@/simulation/field';

export type DummyRunPhase = 'idle' | 'running' | 'waiting' | 'returning';

export interface DummyRunState {
  agentId: string;
  phase: DummyRunPhase;
  targetX: number;
  targetZ: number;
  startedAt: number;
  /** Posição de retorno (onde estava antes) */
  returnX: number;
  returnZ: number;
  /** Quantos defensores foram arrastados */
  defendersDrawn: number;
}

/** Raio de proximidade para considerar defensor "arrastado" (metros) */
const DEFENDER_DRAW_RADIUS_M = 8;
/** Tempo máximo esperando a bola antes de retornar (segundos de sim) */
const WAIT_TIMEOUT_SEC = 4;
/** Probabilidade base de iniciar dummy run quando condições são atendidas */
const BASE_DUMMY_RUN_PROB = 0.18;
/** Terço ofensivo: X > 70m (home atacando +X) */
const OFFENSIVE_THIRD_THRESHOLD = FIELD_LENGTH * 0.67;

export function createDummyRunState(agentId: string): DummyRunState {
  return {
    agentId,
    phase: 'idle',
    targetX: 0,
    targetZ: 0,
    startedAt: 0,
    returnX: 0,
    returnZ: 0,
    defendersDrawn: 0,
  };
}

/**
 * Decide se o agente deve iniciar um dummy run.
 * Condições: time tem bola, agente está no terço ofensivo, 2+ defensores próximos.
 */
export function shouldStartDummyRun(
  agentX: number,
  agentZ: number,
  opponents: Array<{ x: number; z: number }>,
  teamHasBall: boolean,
  attackDir: 1 | -1,
  rng01: () => number,
): boolean {
  if (!teamHasBall) return false;

  // Verificar se está no terço ofensivo
  const attackProgress = attackDir === 1 ? agentX : FIELD_LENGTH - agentX;
  if (attackProgress < OFFENSIVE_THIRD_THRESHOLD) return false;

  // Contar defensores próximos
  let nearDefenders = 0;
  for (const opp of opponents) {
    const d = Math.hypot(opp.x - agentX, opp.z - agentZ);
    if (d <= DEFENDER_DRAW_RADIUS_M) nearDefenders++;
  }

  if (nearDefenders < 2) return false;

  return rng01() < BASE_DUMMY_RUN_PROB;
}

/**
 * Avança o estado do dummy run a cada tick.
 * - running: aguarda bola ou timeout → waiting
 * - waiting: se bola não veio após WAIT_TIMEOUT_SEC → returning
 * - returning: quando chega perto do returnX/Z → idle
 */
export function tickDummyRun(
  state: DummyRunState,
  ballCameToAgent: boolean,
  simTime: number,
  dt: number,
): DummyRunState {
  const next = { ...state };

  switch (state.phase) {
    case 'idle':
      // Nada a fazer — transição iniciada externamente via shouldStartDummyRun
      break;

    case 'running':
      if (ballCameToAgent) {
        // Bola veio — dummy run cumpriu propósito, volta ao idle
        next.phase = 'idle';
      } else {
        // Após 1.5s correndo sem bola, entra em espera
        if (simTime - state.startedAt > 1.5) {
          next.phase = 'waiting';
        }
      }
      break;

    case 'waiting':
      if (ballCameToAgent) {
        next.phase = 'idle';
      } else if (simTime - state.startedAt > WAIT_TIMEOUT_SEC) {
        // Timeout — começa a retornar
        next.phase = 'returning';
      }
      break;

    case 'returning': {
      // Simula movimento de retorno — verifica se chegou perto o suficiente
      const distToReturn = Math.hypot(
        state.targetX - state.returnX,
        state.targetZ - state.returnZ,
      );
      // Velocidade de retorno ~4 m/s (trote)
      const traveledThisTick = 4 * dt;
      if (traveledThisTick >= distToReturn || distToReturn < 2) {
        next.phase = 'idle';
        next.targetX = state.returnX;
        next.targetZ = state.returnZ;
      }
      break;
    }
  }

  return next;
}

/**
 * Retorna target de movimento baseado na fase atual.
 * null quando idle (sem target especial).
 */
export function getDummyRunTarget(
  state: DummyRunState,
): { x: number; z: number } | null {
  switch (state.phase) {
    case 'running':
    case 'waiting':
      return { x: state.targetX, z: state.targetZ };
    case 'returning':
      return { x: state.returnX, z: state.returnZ };
    case 'idle':
    default:
      return null;
  }
}

import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import type { MatchCameraMode } from '@/render-babylon/matchCameraTypes';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

/**
 * Camada 2 — interpreta o estado da partida (truth da simulação) e decide
 * apresentação: modo de câmera, ritmo visual. Sem Babylon; só regras.
 *
 * Regras v1 (heurísticas, baratas para mobile):
 * - TV: leitura geral em `live`.
 * - Drone: reinícios, bola parada, leitura tática espacial.
 * - Motion: highlights curtos (gol, bola rápida, finalização).
 */
export class MatchDirector {
  private motionHold = 0;
  private prevBall: { x: number; z: number } | null = null;
  private prevPhase: MatchTruthSnapshot['matchPhase'] | null = null;

  /** Reinicia estado ao trocar de partida / fase longa (opcional). */
  reset() {
    this.motionHold = 0;
    this.prevBall = null;
    this.prevPhase = null;
  }

  decide(truth: MatchTruthSnapshot, dt: number): MatchCameraMode {
    const d = Math.max(dt, 1e-4);
    const phase = truth.matchPhase;

    if (phase !== this.prevPhase) {
      this.prevPhase = phase;
      if (
        phase === 'goal_restart'
        || phase === 'kickoff'
        || phase === 'throw_in'
        || phase === 'corner_kick'
        || phase === 'goal_kick'
      ) {
        this.motionHold = 0;
      }
    }

    const cues = truth.cameraCues;
    if (cues?.length) {
      for (const c of cues) {
        if (c.kind === 'goal_shake') {
          this.motionHold = Math.max(this.motionHold, 2.6);
        }
        if (c.kind === 'zoom_finish') {
          this.motionHold = Math.max(this.motionHold, 1.4);
        }
      }
    }

    let stepSpeed = 0;
    if (this.prevBall) {
      const dx = truth.ball.x - this.prevBall.x;
      const dz = truth.ball.z - this.prevBall.z;
      stepSpeed = Math.sqrt(dx * dx + dz * dz) / d;
    }
    this.prevBall = { x: truth.ball.x, z: truth.ball.z };

    const vx = truth.ball.vx ?? 0;
    const vz = truth.ball.vz ?? 0;
    const vmag = Math.sqrt(vx * vx + vz * vz);

    if (this.motionHold > 0) {
      this.motionHold -= d;
      return 'motion';
    }

    if (
      phase === 'goal_restart' ||
      phase === 'throw_in' ||
      phase === 'corner_kick' ||
      phase === 'goal_kick' ||
      phase === 'kickoff'
    ) {
      return 'drone';
    }

    if (phase === 'dead_ball' || phase === 'pregame_visual') {
      return 'tv';
    }

    if (phase === 'live') {
      const attackHome = truth.ball.x > FIELD_LENGTH * 0.58;
      const attackAway = truth.ball.x < FIELD_LENGTH * 0.42;
      const inFinalThird = attackHome || attackAway;

      if (vmag > 9 || stepSpeed > 7) {
        this.motionHold = Math.max(this.motionHold, 1.05);
        return 'motion';
      }
      if (inFinalThird && (vmag > 3.8 || stepSpeed > 4.5)) {
        this.motionHold = Math.max(this.motionHold, 0.85);
        return 'motion';
      }
    }

    return 'tv';
  }
}

/** Foco “pack” perto da bola: média dos jogadores num raio (leitura de bloco / passe). */
export function computePackFocusNearBall(
  truth: MatchTruthSnapshot,
  radius = 20,
): { x: number; z: number; weight: number } {
  const bx = truth.ball.x;
  const bz = truth.ball.z;
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const p of truth.players) {
    const dx = p.x - bx;
    const dz = p.z - bz;
    if (dx * dx + dz * dz <= radius * radius) {
      sx += p.x;
      sz += p.z;
      n++;
    }
  }
  if (n === 0) {
    return { x: FIELD_LENGTH * 0.5, z: FIELD_WIDTH * 0.5, weight: 0 };
  }
  return { x: sx / n, z: sz / n, weight: Math.min(1, n / 10) };
}

import { FIELD_LENGTH, FIELD_WIDTH, clampToPitch } from './field';
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import { MATCH_TRUTH_SCHEMA_VERSION } from '@/bridge/matchTruthSchema';

/** Integração numérica leve da bola + limites; jogadores vêm dos agentes (Yuka). */
export class MatchTruthWorld {
  ball = { x: FIELD_LENGTH * 0.5, y: 0.12, z: FIELD_WIDTH * 0.5 };
  ballVel = { x: 0, z: 0 };
  simTime = 0;

  setBallTargetFromUi(ux: number, uy: number, pull = 0.18) {
    const tx = (ux / 100) * FIELD_LENGTH;
    const tz = (uy / 100) * FIELD_WIDTH;
    this.ballVel.x += (tx - this.ball.x) * pull;
    this.ballVel.z += (tz - this.ball.z) * pull;
  }

  step(dt: number) {
    const d = Math.min(dt, 0.05);
    this.simTime += d;
    this.ball.x += this.ballVel.x * d;
    this.ball.z += this.ballVel.z * d;
    const c = clampToPitch(this.ball.x, this.ball.z, 0.8);
    this.ball.x = c.x;
    this.ball.z = c.z;
    this.ballVel.x *= 0.92;
    this.ballVel.z *= 0.92;
  }

  buildSnapshot(
    players: MatchTruthSnapshot['players'],
    matchPhase: MatchTruthSnapshot['matchPhase'],
    cues?: MatchTruthSnapshot['cameraCues'],
    fieldSchemaVersion?: string,
  ): MatchTruthSnapshot {
    return {
      schemaVersion: MATCH_TRUTH_SCHEMA_VERSION,
      ...(fieldSchemaVersion ? { fieldSchemaVersion } : {}),
      t: this.simTime,
      ball: {
        ...this.ball,
        vx: this.ballVel.x,
        vz: this.ballVel.z,
      },
      players,
      matchPhase,
      cameraCues: cues,
    };
  }
}

import { FIELD_LENGTH, FIELD_WIDTH, clampToPitch } from './field';

export type BallMode = 'held' | 'flight' | 'loose' | 'dead';

export interface BallFlight {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  speed: number;
  progress: number;
  kind: 'pass' | 'shot' | 'cross' | 'clearance';
  targetPlayerId?: string;
}

export interface BallState {
  mode: BallMode;
  x: number;
  z: number;
  carrierId: string | null;
  flight: BallFlight | null;
}

export class BallSystem {
  state: BallState = {
    mode: 'dead',
    x: FIELD_LENGTH / 2,
    z: FIELD_WIDTH / 2,
    carrierId: null,
    flight: null,
  };

  reset() {
    this.state = {
      mode: 'dead',
      x: FIELD_LENGTH / 2,
      z: FIELD_WIDTH / 2,
      carrierId: null,
      flight: null,
    };
  }

  placeForKickoff() {
    this.state.x = FIELD_LENGTH / 2;
    this.state.z = FIELD_WIDTH / 2;
    this.state.mode = 'dead';
    this.state.carrierId = null;
    this.state.flight = null;
  }

  /** Bola parada (ex.: golo — rede) sem teletransporte para o centro até ao reinício. */
  setDeadAt(x: number, z: number) {
    this.state.mode = 'dead';
    this.state.x = x;
    this.state.z = z;
    this.state.carrierId = null;
    this.state.flight = null;
  }

  giveTo(playerId: string, x: number, z: number) {
    this.state.mode = 'held';
    this.state.carrierId = playerId;
    this.state.x = x;
    this.state.z = z;
    this.state.flight = null;
  }

  /** Mantém a bola colada ao portador antes de decisões físicas (evita “furar” o GR no mesmo tick). */
  syncHeldToCarrier(x: number, z: number): void {
    if (this.state.mode !== 'held') return;
    this.state.x = x;
    this.state.z = z;
  }

  setLoose(x: number, z: number) {
    this.state.mode = 'loose';
    this.state.carrierId = null;
    this.state.x = x;
    this.state.z = z;
    this.state.flight = null;
  }

  startFlight(from: { x: number; z: number }, to: { x: number; z: number }, speed: number, kind: BallFlight['kind'], targetPlayerId?: string) {
    this.state.mode = 'flight';
    this.state.carrierId = null;
    this.state.flight = {
      fromX: from.x,
      fromZ: from.z,
      toX: to.x,
      toZ: to.z,
      speed,
      progress: 0,
      kind,
      targetPlayerId,
    };
    this.state.x = from.x;
    this.state.z = from.z;
  }

  /** Advance flight; returns true when flight completes. */
  tick(dt: number, carrierPos?: { x: number; z: number }): boolean {
    if (this.state.mode === 'held' && carrierPos) {
      this.state.x = carrierPos.x;
      this.state.z = carrierPos.z;
      return false;
    }

    if (this.state.mode === 'flight' && this.state.flight) {
      const f = this.state.flight;
      const dist = Math.hypot(f.toX - f.fromX, f.toZ - f.fromZ);
      if (dist < 0.1) {
        this.state.mode = 'loose';
        this.state.flight = null;
        return true;
      }
      const travelPerSec = f.speed / dist;
      f.progress = Math.min(1, f.progress + travelPerSec * dt);
      this.state.x = f.fromX + (f.toX - f.fromX) * f.progress;
      this.state.z = f.fromZ + (f.toZ - f.fromZ) * f.progress;

      const c = clampToPitch(this.state.x, this.state.z, 0.5);
      this.state.x = c.x;
      this.state.z = c.z;

      if (f.progress >= 1) {
        this.state.mode = 'loose';
        this.state.flight = null;
        return true;
      }
    }

    if (this.state.mode === 'loose') {
      const c = clampToPitch(this.state.x, this.state.z, 0.5);
      this.state.x = c.x;
      this.state.z = c.z;
    }

    return false;
  }
}

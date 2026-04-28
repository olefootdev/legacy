import { FIELD_LENGTH, FIELD_WIDTH, clampToPitch } from './field';

// ---------------------------------------------------------------------------
// Physics constants
// ---------------------------------------------------------------------------

const GRAVITY = 9.81;
const GROUND_FRICTION = 6.5;
const AIR_DRAG = 0.35;
const BOUNCE_COEFF = 0.55;
const BOUNCE_FRICTION_LATERAL = 0.82;
/** Below this speed (m/s) the ball is considered stopped. */
const REST_SPEED_THRESHOLD = 0.4;
/** Below this height the ball is considered grounded. */
const REST_HEIGHT_THRESHOLD = 0.08;

/** Default launch angle (radians) per flight kind. */
const LAUNCH_ANGLE: Record<BallFlightKind, number> = {
  pass: 0.08,
  shot: 0.06,
  cross: 0.38,
  clearance: 0.52,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BallMode = 'held' | 'flight' | 'loose' | 'dead';
export type BallFlightKind = 'pass' | 'shot' | 'cross' | 'clearance';

export interface BallFlight {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  speed: number;
  progress: number;
  kind: BallFlightKind;
  targetPlayerId?: string;
}

export interface BallState {
  mode: BallMode;
  x: number;
  z: number;
  /** Height above ground (metres). */
  height: number;
  /** Ground-plane velocity (m/s). */
  vx: number;
  vz: number;
  /** Vertical velocity (m/s, positive = upward). */
  vy: number;
  carrierId: string | null;
  flight: BallFlight | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zeroVelocity(s: BallState) {
  s.vx = 0;
  s.vz = 0;
  s.vy = 0;
  s.height = 0;
}

function applyGroundFriction(s: BallState, dt: number) {
  const decay = Math.max(0, 1 - GROUND_FRICTION * dt);
  s.vx *= decay;
  s.vz *= decay;
}

function applyAirDrag(s: BallState, dt: number) {
  const decay = Math.max(0, 1 - AIR_DRAG * dt);
  s.vx *= decay;
  s.vz *= decay;
}

// Allow an optional multiplier to scale friction/drag (used by BallSystem instance)
function applyGroundFrictionScaled(s: BallState, dt: number, multiplier = 1) {
  const decay = Math.max(0, 1 - GROUND_FRICTION * multiplier * dt);
  s.vx *= decay;
  s.vz *= decay;
}

function applyAirDragScaled(s: BallState, dt: number, multiplier = 1) {
  const decay = Math.max(0, 1 - AIR_DRAG * multiplier * dt);
  s.vx *= decay;
  s.vz *= decay;
}

function groundSpeed(s: BallState): number {
  return Math.hypot(s.vx, s.vz);
}

// ---------------------------------------------------------------------------
// BallSystem
// ---------------------------------------------------------------------------

export class BallSystem {
  // Physical modifiers to tune "peso da bola" and control difficulty
  mass: number = 1.2; // higher = heavier, more inertia
  drag: number = 0.9; // higher = more friction/drag
  controlDifficulty: number = 0.25; // 0..1 higher = harder to control

  state: BallState = {
    mode: 'dead',
    x: FIELD_LENGTH / 2,
    z: FIELD_WIDTH / 2,
    height: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    carrierId: null,
    flight: null,
  };

  private static readonly EMPTY: BallState = {
    mode: 'dead',
    x: FIELD_LENGTH / 2,
    z: FIELD_WIDTH / 2,
    height: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    carrierId: null,
    flight: null,
  };

  // last touch bookkeeping (player id of last player who touched the ball)
  private lastTouchPlayerId: string | null = null;

  // throw-in / out-of-bounds hook
  private onThrowInCallback: ((info: { outSide: 'left' | 'right' | 'top' | 'bottom' | 'unknown'; lastTouchPlayerId?: string; x: number; z: number; timestamp: number }) => void) | null = null;
  private wasOutOfBounds = false;
  /**
   * Quando um CHUTE sai pela linha de fundo, atrasamos a emissão do out-of-bounds em
   * ~1 segundo pra que a bola continue o voo visualmente "fora do campo" antes do
   * reinício. Dá a ilusão de tiro pra fora de verdade.
   */
  private pendingShotOut: {
    info: { outSide: 'left' | 'right' | 'top' | 'bottom' | 'unknown'; lastTouchPlayerId?: string; x: number; z: number; timestamp: number };
    timer: number;
  } | null = null;
  private readonly SHOT_OUT_DELAY_S = 1.0;

  reset() {
    Object.assign(this.state, BallSystem.EMPTY);
  }

  /** Record last player that touched the ball (called by TacticalSimLoop when resolving actions). */
  registerLastTouch(playerId: string | null) {
    this.lastTouchPlayerId = playerId;
  }

  /** Q5 — Acessor pra Q5 (intercepção contínua). */
  getLastTouchPlayerId(): string | null {
    return this.lastTouchPlayerId;
  }

  setOnThrowIn(cb: (info: { outSide: 'left' | 'right' | 'top' | 'bottom' | 'unknown'; lastTouchPlayerId?: string; x: number; z: number; timestamp: number }) => void) {
    this.onThrowInCallback = cb;
  }

  placeForKickoff() {
    this.state.x = FIELD_LENGTH / 2;
    this.state.z = FIELD_WIDTH / 2;
    this.state.mode = 'dead';
    this.state.carrierId = null;
    this.state.flight = null;
    zeroVelocity(this.state);
  }

  setDeadAt(x: number, z: number) {
    this.state.mode = 'dead';
    this.state.x = x;
    this.state.z = z;
    this.state.carrierId = null;
    this.state.flight = null;
    zeroVelocity(this.state);
  }

  giveTo(playerId: string, x: number, z: number) {
    this.state.mode = 'held';
    this.state.carrierId = playerId;
    this.state.x = x;
    this.state.z = z;
    this.state.flight = null;
    zeroVelocity(this.state);
  }

  syncHeldToCarrier(x: number, z: number): void {
    if (this.state.mode !== 'held') return;
    this.state.x = x;
    this.state.z = z;
  }

  /**
   * Ball becomes loose with optional residual velocity.
   * Use for fumbles, deflections, tackles — anything where the ball
   * should roll/bounce after release instead of freezing.
   */
  setLoose(x: number, z: number, vx = 0, vz = 0, vy = 0) {
    this.state.mode = 'loose';
    this.state.carrierId = null;
    this.state.x = x;
    this.state.z = z;
    this.state.vx = vx;
    this.state.vz = vz;
    this.state.vy = vy;
    if (vy > 0) {
      this.state.height = Math.max(this.state.height, 0.05);
    } else {
      this.state.height = 0;
    }
    this.state.flight = null;
  }

  /**
   * Launch the ball from `from` to `to`.
   * Physics: the horizontal speed is `speed` m/s; the vertical component is
   * derived from a launch angle that depends on `kind` (cross/clearance = high
   * arc, pass/shot = low/flat).
   */
  startFlight(
    from: { x: number; z: number },
    to: { x: number; z: number },
    speed: number,
    kind: BallFlightKind,
    targetPlayerId?: string,
  ) {
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

    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    if (dist < 0.1) {
      zeroVelocity(this.state);
      return;
    }
    const dirX = (to.x - from.x) / dist;
    const dirZ = (to.z - from.z) / dist;

    const angle = LAUNCH_ANGLE[kind];
    const horizSpeed = speed * Math.cos(angle);
    const vertSpeed = speed * Math.sin(angle);

    this.state.vx = dirX * horizSpeed;
    this.state.vz = dirZ * horizSpeed;
    this.state.vy = vertSpeed;
    this.state.height = 0.15;
  }

  /** Advance physics; returns true when flight completes. */
  tick(dt: number, carrierPos?: { x: number; z: number }): boolean {
    if (dt <= 0) return false;

    // ── held ──
    if (this.state.mode === 'held' && carrierPos) {
      this.state.x = carrierPos.x;
      this.state.z = carrierPos.z;
      zeroVelocity(this.state);
      return false;
    }

    // ── flight ──
    if (this.state.mode === 'flight' && this.state.flight) {
      return this.tickFlight(dt);
    }

    // ── loose ──
    if (this.state.mode === 'loose') {
      this.tickLoose(dt);
    }

    return false;
  }

  // -----------------------------------------------------------------------
  // Flight physics
  // -----------------------------------------------------------------------

  private tickFlight(dt: number): boolean {
    const f = this.state.flight!;
    const dist = Math.hypot(f.toX - f.fromX, f.toZ - f.fromZ);
    if (dist < 0.1) {
      this.transitionToLoose();
      return true;
    }

  // scale drag by ball instance properties (heavier -> less deceleration)
  applyAirDragScaled(this.state, dt, this.drag / Math.max(0.2, this.mass));

    this.state.vy -= GRAVITY * dt;

    this.state.x += this.state.vx * dt;
    this.state.z += this.state.vz * dt;
    this.state.height += this.state.vy * dt;

  if (this.state.height <= 0) {
      this.state.height = 0;
      if (Math.abs(this.state.vy) > 1.2) {
        this.state.vy = -this.state.vy * BOUNCE_COEFF;
        this.state.vx *= BOUNCE_FRICTION_LATERAL;
        this.state.vz *= BOUNCE_FRICTION_LATERAL;
        this.state.height = 0.01;
      } else {
        this.state.vy = 0;
      }
    }

    const traveled = Math.hypot(this.state.x - f.fromX, this.state.z - f.fromZ);
    f.progress = Math.min(1, traveled / dist);

    // Se for CHUTE e a bola já passou da linha, deixa o voo continuar "fora" por ~1s
    // antes de clampar + emitir. Ilusão: a bola sai de verdade do campo visual.
    const rawX = this.state.x;
    const rawZ = this.state.z;
    const isShotFlight = f.kind === 'shot';
    const crossedLine =
      rawX <= 0.6 || rawX >= FIELD_LENGTH - 0.6 || rawZ <= 0.6 || rawZ >= FIELD_WIDTH - 0.6;

    if (isShotFlight && crossedLine && !this.pendingShotOut && !this.wasOutOfBounds) {
      // Inicia a janela de atraso; NÃO clampa, NÃO emite ainda — bola segue voando.
      let side: 'left' | 'right' | 'top' | 'bottom' | 'unknown' = 'unknown';
      if (rawX <= 0.6) side = 'left';
      else if (rawX >= FIELD_LENGTH - 0.6) side = 'right';
      else if (rawZ <= 0.6) side = 'top';
      else if (rawZ >= FIELD_WIDTH - 0.6) side = 'bottom';
      this.pendingShotOut = {
        info: {
          outSide: side,
          lastTouchPlayerId: this.lastTouchPlayerId ?? undefined,
          x: rawX,
          z: rawZ,
          timestamp: Date.now(),
        },
        timer: 0,
      };
    }

    if (this.pendingShotOut) {
      // Acumula tempo; ao atingir o limite, clampa + emite out-of-bounds.
      this.pendingShotOut.timer += dt;
      if (this.pendingShotOut.timer >= this.SHOT_OUT_DELAY_S) {
        const info = this.pendingShotOut.info;
        this.pendingShotOut = null;
        const c = clampToPitch(this.state.x, this.state.z, 0.5);
        this.state.x = c.x;
        this.state.z = c.z;
        this.wasOutOfBounds = true;
        if (this.onThrowInCallback) {
          try {
            this.onThrowInCallback({ ...info, x: this.state.x, z: this.state.z, timestamp: Date.now() });
          } catch {
            /* noop */
          }
        }
        // Termina o voo — bola fica parada no ponto de reinício atribuído pelo handler.
        this.transitionToLoose();
        return true;
      }
      // Durante o atraso, não clampa nem emite — deixa a bola seguir a física/drag.
      if (f.progress >= 1 || (groundSpeed(this.state) < REST_SPEED_THRESHOLD && this.state.height < REST_HEIGHT_THRESHOLD)) {
        // Mesmo que o voo "termine" (drag parou), continua o relógio até o deadline.
        return false;
      }
      return false;
    }

    // Fluxo normal (não-chute ou chute ainda dentro do campo).
    const c = clampToPitch(this.state.x, this.state.z, 0.5);
    this.state.x = c.x;
    this.state.z = c.z;
    this.checkOutOfBoundsAndEmit();

    if (f.progress >= 1 || (groundSpeed(this.state) < REST_SPEED_THRESHOLD && this.state.height < REST_HEIGHT_THRESHOLD)) {
      this.transitionToLoose();
      this.checkOutOfBoundsAndEmit();
      return true;
    }

    return false;
  }

  private transitionToLoose() {
    this.state.mode = 'loose';
    this.state.flight = null;
  // mark last touch as null when flight ends (loose ball may be last touched by environment)
  // keep lastTouchPlayerId as-is; detection of out-of-bounds will consult it.
  }

  // -----------------------------------------------------------------------
  // Loose physics (rolling / bouncing after release)
  // -----------------------------------------------------------------------

  private tickLoose(dt: number) {
    const airborne = this.state.height > REST_HEIGHT_THRESHOLD;

    if (airborne) {
  applyAirDragScaled(this.state, dt, this.drag / Math.max(0.2, this.mass));
      this.state.vy -= GRAVITY * dt;
      this.state.height += this.state.vy * dt;
      if (this.state.height <= 0) {
        this.state.height = 0;
        if (Math.abs(this.state.vy) > 1.0) {
          this.state.vy = -this.state.vy * BOUNCE_COEFF;
          this.state.vx *= BOUNCE_FRICTION_LATERAL;
          this.state.vz *= BOUNCE_FRICTION_LATERAL;
          this.state.height = 0.01;
        } else {
          this.state.vy = 0;
        }
      }
    } else {
      this.state.height = 0;
      this.state.vy = 0;
      // heavier ball -> longer roll: scale ground friction inversely with mass
      applyGroundFrictionScaled(this.state, dt, this.drag / Math.max(0.2, this.mass));
    }

    this.state.x += this.state.vx * dt;
    this.state.z += this.state.vz * dt;

    if (groundSpeed(this.state) < REST_SPEED_THRESHOLD && !airborne) {
      this.state.vx = 0;
      this.state.vz = 0;
    }

    const c = clampToPitch(this.state.x, this.state.z, 0.5);
    this.state.x = c.x;
    this.state.z = c.z;
    this.checkOutOfBoundsAndEmit();
  }

  private checkOutOfBoundsAndEmit() {
    if (this.state.mode === 'dead') return;
    const x = this.state.x;
    const z = this.state.z;
    // clampToPitch uses margin=0.5, so ball stops at 0.5/FIELD_LENGTH-0.5.
    // Use 0.6 threshold to reliably detect the clamped-at-boundary case.
    const BOUNDARY = 0.6;
    const outLeft = x <= BOUNDARY;
    const outRight = x >= FIELD_LENGTH - BOUNDARY;
    const outTop = z <= BOUNDARY;
    const outBottom = z >= FIELD_WIDTH - BOUNDARY;
    const isOut = outLeft || outRight || outTop || outBottom;
    if (isOut && !this.wasOutOfBounds) {
      this.wasOutOfBounds = true;
      let side: 'left' | 'right' | 'top' | 'bottom' | 'unknown' = 'unknown';
      if (outLeft) side = 'left';
      else if (outRight) side = 'right';
      else if (outTop) side = 'top';
      else if (outBottom) side = 'bottom';
      if (this.onThrowInCallback) {
        try {
          this.onThrowInCallback({ outSide: side, lastTouchPlayerId: this.lastTouchPlayerId ?? undefined, x: this.state.x, z: this.state.z, timestamp: Date.now() });
        } catch (e) {
          // swallow
        }
      }
    }
    if (!isOut && this.wasOutOfBounds) this.wasOutOfBounds = false;
  }
}

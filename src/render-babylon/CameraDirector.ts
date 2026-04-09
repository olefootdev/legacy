import { Vector3, type TargetCamera } from '@babylonjs/core';
import type { CameraCue } from '@/bridge/matchTruthSchema';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { MatchCameraMode } from './matchCameraTypes';

/** Apresentação: follow + shake (não altera simulação). */
export class CameraDirector {
  private shakeT = 0;
  private shakeMag = 0;
  private zoomT = 0;
  private mode: MatchCameraMode = 'tv';
  /** Zoom manual 0 = enquadramento padrão do modo, 1 = mais próximo do foco. */
  private userZoom = 0;

  setMode(mode: MatchCameraMode) {
    this.mode = mode;
  }

  getMode(): MatchCameraMode {
    return this.mode;
  }

  /** 0–1, aplicado em todos os modos. */
  setUserZoom(z: number) {
    this.userZoom = Math.max(0, Math.min(1, z));
  }

  getUserZoom(): number {
    return this.userZoom;
  }

  applyCue(cue: CameraCue) {
    if (cue.kind === 'goal_shake') {
      this.shakeT = 0.55;
      this.shakeMag = (cue.intensity ?? 0.8) * 2.2;
    }
    if (cue.kind === 'zoom_finish') {
      this.zoomT = 0.4;
    }
  }

  /** Aproxima a câmera do alvo mantendo altura mínima (efeito “zoom in” universal). */
  private applyUserZoom(desiredPos: Vector3, lookTarget: Vector3): Vector3 {
    const z = this.userZoom;
    if (z <= 0.001) return desiredPos;
    const k = 1 - z * 0.52;
    const ox = desiredPos.x - lookTarget.x;
    const oy = desiredPos.y - lookTarget.y;
    const oz = desiredPos.z - lookTarget.z;
    const minH = 14;
    const ny = Math.max(lookTarget.y + minH, lookTarget.y + oy * (0.58 + (1 - z) * 0.42));
    return new Vector3(lookTarget.x + ox * k, ny, lookTarget.z + oz * k);
  }

  update(
    camera: TargetCamera,
    ballX: number,
    ballZ: number,
    dt: number,
    opts?: { packX?: number; packZ?: number; packBlend?: number },
  ) {
    const center = new Vector3(FIELD_LENGTH * 0.5, 0, FIELD_WIDTH * 0.5);
    const ball = new Vector3(ballX, 0, ballZ);

    let desiredPos: Vector3;
    let lookTarget: Vector3;
    let posLerp = 2.2;
    let targetLerp = 3.0;

    switch (this.mode) {
      case 'cabine': {
        const pb = opts?.packBlend ?? 0;
        let lt = ball.clone();
        if (pb > 0.02 && opts?.packX !== undefined && opts?.packZ !== undefined) {
          const pack = new Vector3(opts.packX, 0, opts.packZ);
          lt = Vector3.Lerp(ball, pack, Math.min(0.34, pb));
        }
        lookTarget = Vector3.Lerp(center, lt, 0.8);
        const sideZ = -18;
        const camX = FIELD_LENGTH * 0.5 + (lt.x - FIELD_LENGTH * 0.5) * 0.91;
        const camY = 54 + this.zoomT * 7;
        desiredPos = new Vector3(camX, camY, sideZ + (lt.z - FIELD_WIDTH * 0.5) * 0.14);
        posLerp = 2.05;
        targetLerp = 2.75;
        break;
      }
      case 'drone': {
        lookTarget = Vector3.Lerp(center, ball, 0.22);
        desiredPos = new Vector3(
          FIELD_LENGTH * 0.48 + ballX * 0.08,
          112 + this.zoomT * 10,
          FIELD_WIDTH * 0.5 + 88 + ballZ * 0.06,
        );
        posLerp = 1.35;
        targetLerp = 2.2;
        break;
      }
      case 'motion': {
        lookTarget = Vector3.Lerp(center, ball, 0.88);
        const dx = ballX - center.x;
        const dz = ballZ - center.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        const pull = 36 + this.zoomT * 6;
        desiredPos = new Vector3(ballX - ux * pull, 44 + this.zoomT * 8, ballZ - uz * pull);
        posLerp = 3.2;
        targetLerp = 4.5;
        break;
      }
      case 'tv':
      default: {
        const cx = FIELD_LENGTH * 0.48 + ballX * 0.28;
        const cz = FIELD_WIDTH * 0.5 + (ballZ - FIELD_WIDTH * 0.5) * 0.18;
        const height = 68 + this.zoomT * 10;
        desiredPos = new Vector3(cx, height, cz - 12);
        const pb = opts?.packBlend ?? 0;
        if (pb > 0.02 && opts?.packX !== undefined && opts?.packZ !== undefined) {
          const pack = new Vector3(opts.packX, 0, opts.packZ);
          lookTarget = Vector3.Lerp(ball, pack, Math.min(0.32, pb));
        } else {
          lookTarget = Vector3.Lerp(center, ball, 0.65);
        }
        posLerp = 1.8;
        targetLerp = 2.4;
        break;
      }
    }

    desiredPos = this.applyUserZoom(desiredPos, lookTarget);

    camera.position = Vector3.Lerp(camera.position, desiredPos, Math.min(1, dt * posLerp));

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeMag * (this.shakeT / 0.55);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s * 0.35;
      camera.position.z += (Math.random() - 0.5) * s * 0.2;
    }
    if (this.zoomT > 0) {
      this.zoomT -= dt;
    }

    const cur = camera.getTarget();
    camera.setTarget(Vector3.Lerp(cur, lookTarget, Math.min(1, dt * targetLerp)));
  }
}

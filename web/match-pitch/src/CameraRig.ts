import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { FIELD_LENGTH, FIELD_WIDTH } from './formation433';

export type StadiumCameraMode = 'tv' | 'drone' | 'motion' | 'cabine';

/**
 * Modo TV: enquadramento **estático** estilo transmissão (sem micro-handheld).
 * Para demo estável e leitura das linhas. Ver README.
 */
export const TV_CAMERA_USE_SUBTLE_HANDHELD = false;

/** Centro do campo (pivô ArcRotate). */
const CX = FIELD_LENGTH / 2;
const CZ = FIELD_WIDTH / 2;

/**
 * ArcRotateCamera (Babylon): `beta` é o ângulo em relação ao eixo Y (0 = zenital).
 * Valores calibrados para enquadrar ~105×68 a partir da banda longa, altura moderada.
 */
export const TV_BROADCAST = {
  alpha: -Math.PI * 0.505,
  beta: 0.93,
  radius: 104,
} as const;

export const DRONE_PRESET = {
  alpha: -Math.PI / 2,
  beta: Math.PI / 2.42,
  radius: 118,
} as const;

export const MOTION_PRESET = {
  beta: Math.PI / 3.14,
  radius: 52,
} as const;

/** Banda lateral elevada: acompanha o eixo do jogo (comprimento do campo). */
export const CABINE_PRESET = {
  alpha: -Math.PI * 0.5,
  beta: 1.02,
  radius: 92,
} as const;

function handheldTvDelta(): { dAlpha: number; dRadius: number } {
  if (!TV_CAMERA_USE_SUBTLE_HANDHELD) return { dAlpha: 0, dRadius: 0 };
  const t = performance.now() * 0.0009;
  return {
    dAlpha: Math.sin(t * 1.1) * 0.004 + Math.sin(t * 2.3) * 0.002,
    dRadius: Math.sin(t * 0.85) * 0.35,
  };
}

/**
 * Atualiza câmera por modo (ArcRotate + bola em demo/motion).
 */
export function updateStadiumCamera(
  cam: ArcRotateCamera,
  mode: StadiumCameraMode,
  ballX: number,
  ballZ: number,
  dt: number,
  userZoom = 0,
) {
  const lerpK = (k: number) => Math.min(1, dt * k);
  const zoomFactor = 1 - Math.max(0, Math.min(1, userZoom)) * 0.48;

  if (mode === 'motion') {
    const tx = ballX;
    const tz = ballZ;
    cam.target = Vector3.Lerp(cam.target, new Vector3(tx, 0, tz), lerpK(7));
    const dx = tx - CX;
    const dz = tz - CZ;
    cam.alpha += (Math.atan2(dx, dz) + Math.PI - cam.alpha) * lerpK(5);
    cam.beta += (MOTION_PRESET.beta - cam.beta) * lerpK(4);
    cam.radius += (MOTION_PRESET.radius * zoomFactor - cam.radius) * lerpK(4);
    return;
  }

  if (mode === 'cabine') {
    const tx = CX + (ballX - CX) * 0.9;
    const tz = CZ + (ballZ - CZ) * 0.38;
    cam.target = Vector3.Lerp(cam.target, new Vector3(tx, 0, tz), lerpK(3.2));
    cam.alpha += (CABINE_PRESET.alpha - cam.alpha) * lerpK(2.6);
    cam.beta += (CABINE_PRESET.beta - cam.beta) * lerpK(2.6);
    const r = CABINE_PRESET.radius * zoomFactor;
    cam.radius += (r - cam.radius) * lerpK(2.9);
    return;
  }

  if (mode === 'drone') {
    cam.target = Vector3.Lerp(cam.target, new Vector3(CX, 0, CZ), lerpK(3.5));
    cam.alpha += (DRONE_PRESET.alpha - cam.alpha) * lerpK(2.8);
    cam.beta += (DRONE_PRESET.beta - cam.beta) * lerpK(2.8);
    cam.radius += (DRONE_PRESET.radius * zoomFactor - cam.radius) * lerpK(2.8);
    return;
  }

  // TV — broadcast
  cam.target = Vector3.Lerp(cam.target, new Vector3(CX, 0, CZ), lerpK(3.2));
  const { dAlpha, dRadius } = handheldTvDelta();
  const ta = TV_BROADCAST.alpha + dAlpha;
  const tr = (TV_BROADCAST.radius + dRadius) * zoomFactor;
  cam.alpha += (ta - cam.alpha) * lerpK(3.4);
  cam.beta += (TV_BROADCAST.beta - cam.beta) * lerpK(3.4);
  cam.radius += (tr - cam.radius) * lerpK(3.4);
}

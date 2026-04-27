/**
 * Modos de câmara do campo 2D (Partida Ao Vivo): Drone e Ação (zoom na bola).
 */

export type Live2dPitchCameraMode = 'drone' | 'action';

const STORAGE_KEY = 'olefoot_live2d_pitch_camera';

export function loadLive2dPitchCamera(): Live2dPitchCameraMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'action' || v === 'drone') return v;
    /** Valor antigo ou desconhecido (ex.: `broadcast` removido). */
    if (v === 'broadcast') return 'drone';
  } catch {
    /* ignore */
  }
  return 'drone';
}

export function saveLive2dPitchCamera(mode: Live2dPitchCameraMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export interface PitchCameraRig {
  scale: number;
  originXPct: number;
  originYPct: number;
  /** Soma ao tilt base (~5.5°) do painel 2D. */
  rotateXAdd: number;
  clipOverflow: boolean;
}

export function computePitchCameraRig(
  mode: Live2dPitchCameraMode,
  ballPx: number,
  ballPy: number,
  reducedMotion: boolean,
): PitchCameraRig {
  if (mode === 'drone') {
    return {
      scale: 1,
      originXPct: 50,
      originYPct: 50,
      rotateXAdd: 0,
      clipOverflow: false,
    };
  }

  if (reducedMotion) {
    return {
      scale: 1.12,
      originXPct: ballPx,
      originYPct: ballPy,
      rotateXAdd: 0.35,
      clipOverflow: true,
    };
  }

  const midDist = Math.abs(ballPx - 50) / 50;
  const boost = midDist * 0.14;
  return {
    scale: Math.min(1.62, 1.34 + boost),
    originXPct: ballPx,
    originYPct: ballPy,
    rotateXAdd: 2.1,
    clipOverflow: true,
  };
}

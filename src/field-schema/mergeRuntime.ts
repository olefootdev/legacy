import type { PlayerFieldProfile } from './adminArtifacts';

const DEFAULT_YUKA_WEIGHTS: Record<string, number> = {
  seek: 1,
  arrive: 1,
  separation: 1.2,
  alignment: 0.35,
};

/** Mescla perfil do jogador (Admin) com defaults do motor. */
export function mergeYukaWeights(profile: PlayerFieldProfile | null | undefined): Record<string, number> {
  return { ...DEFAULT_YUKA_WEIGHTS, ...profile?.yukaWeights };
}

/** Sliders do manager: viés numérico sobre o padrão tático base (não substitui o artefato). */
export function managerBiasFromSliders(mentality: number, defensiveLine: number): {
  blockDepthBias: number;
  widePlayBias: number;
} {
  return {
    blockDepthBias: (defensiveLine - 50) / 100,
    widePlayBias: (mentality - 50) / 100,
  };
}

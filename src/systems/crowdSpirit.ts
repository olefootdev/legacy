/** Modificadores de torcida para o GameSpirit (erro, finalização, narrativa). */
export interface CrowdSpiritPressure {
  /** 0–1 somado à chance de erro sob pressão */
  errorPenalty: number;
  /** 0–1 somado à chance de gol / construção */
  supportBoost: number;
  /** multiplicador de “pressão” em passes longos */
  longPassStress: number;
  label: string;
}

export function crowdSpiritFromSupport(supportPercent: number): CrowdSpiritPressure {
  const s = supportPercent;
  if (s < 35) {
    return {
      errorPenalty: 0.09 + (35 - s) / 200,
      supportBoost: -0.02,
      longPassStress: 1.15,
      label: 'hostil',
    };
  }
  if (s < 55) {
    return {
      errorPenalty: 0.04,
      supportBoost: 0,
      longPassStress: 1.05,
      label: 'neutra',
    };
  }
  if (s < 75) {
    return {
      errorPenalty: 0.02,
      supportBoost: 0.03,
      longPassStress: 1,
      label: 'apoiando',
    };
  }
  return {
    errorPenalty: 0.01,
    supportBoost: 0.055 + (s - 75) / 400,
    longPassStress: 0.92,
    label: 'empurrando',
  };
}

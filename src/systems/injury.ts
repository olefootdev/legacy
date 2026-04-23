import type { PlayerEntity } from '@/entities/types';
import { medicalDeptRecoverySpeedBonusPercent } from '@/clubStructures/benefits';

/**
 * Lesões em qualquer partida simulada (liga, amistoso, desafio) actualizam `outForMatches`
 * no jogador — o resto do game (escalação, WO, treinos, outras ligas) lê o mesmo estado.
 */

export type MatchInjuryRollOptions = {
  /** Multiplica o “stress” usado na probabilidade de lesão (Nutrição < 1). */
  stressMul?: number;
  /** Multiplica o incremento de `injuryRisk` quando não há lesão. */
  riskGrowthMul?: number;
};

export type InjurySeverity = 'leve' | 'forte' | 'gravissima';

/** Jogos fora por severidade — amistosos e jogos da liga contam iguais. */
export const INJURY_MATCHES_OUT: Record<InjurySeverity, number> = {
  leve: 5,
  forte: 10,
  gravissima: 15,
};

export const INJURY_LABEL_PT: Record<InjurySeverity, string> = {
  leve: 'Lesão leve',
  forte: 'Lesão forte',
  gravissima: 'Lesão gravíssima',
};

/** Sorteia a severidade dada a intensidade do minuto e risco acumulado. */
export function rollInjurySeverity(rng: number, minuteIntensity: number, injuryRisk: number): InjurySeverity {
  // Base: 58% leve · 28% forte · 14% gravíssima.
  // Minuto muito intenso / risco alto aumentam chance de severa.
  const severityBias = Math.min(0.35, minuteIntensity * 0.4 + injuryRisk / 400);
  const pGravissima = 0.14 + severityBias * 0.35;
  const pForte = 0.28 + severityBias * 0.25;
  // resto = leve
  if (rng < pGravissima) return 'gravissima';
  if (rng < pGravissima + pForte) return 'forte';
  return 'leve';
}

/** Risco extra após minuto extenuante; pode gerar lesão (leve/forte/gravíssima). */
export function rollMatchInjury(player: PlayerEntity, minuteIntensity: number, opts?: MatchInjuryRollOptions): PlayerEntity {
  if (player.outForMatches > 0) return player;
  const sm = opts?.stressMul ?? 1;
  const rg = opts?.riskGrowthMul ?? 1;
  const stress = (player.fatigue * 0.45 + player.injuryRisk * 0.35 + minuteIntensity * 8) * sm;
  if (Math.random() < stress / 420) {
    const severity = rollInjurySeverity(Math.random(), minuteIntensity, player.injuryRisk);
    const matchesOut = INJURY_MATCHES_OUT[severity];
    return {
      ...player,
      outForMatches: matchesOut,
      injuryRisk: Math.max(0, player.injuryRisk - (severity === 'gravissima' ? 25 : severity === 'forte' ? 20 : 15)),
      fatigue: Math.min(100, player.fatigue + (severity === 'gravissima' ? 14 : severity === 'forte' ? 11 : 8)),
    };
  }
  return {
    ...player,
    injuryRisk: Math.min(100, player.injuryRisk + minuteIntensity * 0.35 * rg),
  };
}

/** Variante que também retorna a severidade sorteada — útil pra narrativa/inbox. */
export function rollMatchInjuryWithSeverity(
  player: PlayerEntity,
  minuteIntensity: number,
  opts?: MatchInjuryRollOptions,
): { player: PlayerEntity; injured: false } | { player: PlayerEntity; injured: true; severity: InjurySeverity } {
  if (player.outForMatches > 0) return { player, injured: false };
  const sm = opts?.stressMul ?? 1;
  const rg = opts?.riskGrowthMul ?? 1;
  const stress = (player.fatigue * 0.45 + player.injuryRisk * 0.35 + minuteIntensity * 8) * sm;
  if (Math.random() < stress / 420) {
    const severity = rollInjurySeverity(Math.random(), minuteIntensity, player.injuryRisk);
    const matchesOut = INJURY_MATCHES_OUT[severity];
    const next: PlayerEntity = {
      ...player,
      outForMatches: matchesOut,
      injuryRisk: Math.max(0, player.injuryRisk - (severity === 'gravissima' ? 25 : severity === 'forte' ? 20 : 15)),
      fatigue: Math.min(100, player.fatigue + (severity === 'gravissima' ? 14 : severity === 'forte' ? 11 : 8)),
    };
    return { player: next, injured: true, severity };
  }
  return {
    player: { ...player, injuryRisk: Math.min(100, player.injuryRisk + minuteIntensity * 0.35 * rg) },
    injured: false,
  };
}

/**
 * Após cada jornada: decrementa `outForMatches`.
 * Com departamento médico evoluído, há chance de recuperar 2 jogos de uma vez (velocidade +10%…+50%).
 */
export function tickRecoveryMatches(
  players: Record<string, PlayerEntity>,
  medicalDeptLevel = 1,
): Record<string, PlayerEntity> {
  const bonusPct = medicalDeptRecoverySpeedBonusPercent(medicalDeptLevel);
  const next: Record<string, PlayerEntity> = {};
  for (const [id, p] of Object.entries(players)) {
    if (p.outForMatches <= 0) {
      next[id] = p;
      continue;
    }
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const dec = hash % 100 < bonusPct ? 2 : 1;
    next[id] = { ...p, outForMatches: Math.max(0, p.outForMatches - dec) };
  }
  return next;
}

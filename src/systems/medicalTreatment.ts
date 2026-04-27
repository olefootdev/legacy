import type { TreatmentPlan } from '@/game/types';
import type { PlayerEntity } from '@/entities/types';
import { medicalDeptRecoverySpeedBonusPercent } from '@/clubStructures/benefits';

export const TREATMENT_PLAN_DURATION_H = 8;

export function splitDueTreatments(
  plans: TreatmentPlan[],
  nowIso: string,
): { due: TreatmentPlan[]; rest: TreatmentPlan[] } {
  const due: TreatmentPlan[] = [];
  const rest: TreatmentPlan[] = [];
  for (const p of plans) {
    if (p.status === 'running' && p.endAt <= nowIso) due.push(p);
    else rest.push(p);
  }
  return { due, rest };
}

/** Efeito ao concluir um slot de tratamento (escala com bónus % do departamento). */
export function applyTreatmentCompletionToPlayer(
  player: PlayerEntity,
  medicalDeptLevel: number,
): PlayerEntity {
  const pct = medicalDeptRecoverySpeedBonusPercent(medicalDeptLevel);
  const mult = 1 + pct / 100;
  const fatigueDrop = Math.round(22 * mult);
  const riskDrop = Math.round(12 * mult);
  let outForMatches = player.outForMatches;
  if (outForMatches > 0) {
    const hash = player.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const dec = hash % 100 < pct ? 2 : 1;
    outForMatches = Math.max(0, outForMatches - dec);
  }
  return {
    ...player,
    fatigue: Math.max(0, player.fatigue - fatigueDrop),
    injuryRisk: Math.max(0, player.injuryRisk - riskDrop),
    outForMatches,
  };
}

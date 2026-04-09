import type { ClubStructureId } from './types';

/**
 * EXP costs for levels 1→2 and 2→3.
 * Levels 3→4 and 4→5 are BRO-only (see broDefaults.ts).
 * Values tuned for ~2.8k–5.6k total EXP per structure to reach L3.
 */
export const EXP_UPGRADE_COSTS: Record<ClubStructureId, { level1to2: number; level2to3: number }> = {
  stadium:         { level1to2: 1_400, level2to3: 4_200 },
  training_center: { level1to2: 1_100, level2to3: 3_400 },
  youth_academy:   { level1to2: 1_000, level2to3: 3_000 },
  medical_dept:    { level1to2:   850, level2to3: 2_600 },
  megastore:       { level1to2:   700, level2to3: 2_100 },
};

export function getExpCost(id: ClubStructureId, currentLevel: number): number | null {
  const row = EXP_UPGRADE_COSTS[id];
  if (currentLevel === 1) return row.level1to2;
  if (currentLevel === 2) return row.level2to3;
  return null;
}

/**
 * Catálogo unificado de Coach Skills — merge de seed + custom.
 *
 * Exporta FULL_SKILL_CATALOG (seed + catalog) e helpers de lookup.
 */

import { COACH_SKILLS_SEED } from './seedCatalog';
import { SKILL_CATALOG } from './catalog';
import type { CoachSkill } from './playbookV1';

/** Catálogo completo: seed (genéricas) + catalog (custom). */
export const FULL_SKILL_CATALOG: readonly CoachSkill[] = [
  ...COACH_SKILLS_SEED,
  ...SKILL_CATALOG,
] as const;

/** Lookup por ID (O(1)). */
export const SKILLS_BY_ID: Readonly<Record<string, CoachSkill>> = Object.freeze(
  Object.fromEntries(FULL_SKILL_CATALOG.map((s) => [s.id, s])),
);

export function getSkillById(id: string): CoachSkill | undefined {
  return SKILLS_BY_ID[id];
}

export function getSkillsByRole(role: CoachSkill['role']): readonly CoachSkill[] {
  return FULL_SKILL_CATALOG.filter((s) => s.role === role);
}

export function getSkillsByTier(tier: CoachSkill['tier']): readonly CoachSkill[] {
  return FULL_SKILL_CATALOG.filter((s) => s.tier === tier);
}

export function getPlayerSkills(skillIds?: string[]): CoachSkill[] {
  if (!skillIds || skillIds.length === 0) return [];
  return skillIds.map((id) => SKILLS_BY_ID[id]).filter(Boolean) as CoachSkill[];
}

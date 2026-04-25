/**
 * Coach Skills · PlaybookV1 — schema + validador (sem dependência externa).
 *
 * Spec: docs/COACH_SKILLS_PLAYBOOK_V1.md
 * Runtime: src/skills/skillEngine.ts (já integrado em GameSpirit)
 *
 * Política do validador:
 *   - Estrito no formato (id regex, behaviors length, bias clamp)
 *   - Permissivo no `when` DSL (ainda não há parser oficial — Fase 3)
 *   - Permissivo no `bias` keys (vocabulário ainda não fechado — Fase 3)
 */

import type { PlayerAttributes } from '@/entities/types';

export type SkillRole =
  | 'goleiro'
  | 'zagueiro'
  | 'lateral'
  | 'volante'
  | 'meia'
  | 'ponta'
  | 'atacante';

export type SkillTier = 'generica' | 'historica' | 'lendaria';

export const SKILL_ROLES: readonly SkillRole[] = [
  'goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'ponta', 'atacante',
] as const;

export const SKILL_TIERS: readonly SkillTier[] = [
  'generica', 'historica', 'lendaria',
] as const;

/** Mapa <chave-do-score: ajuste-aditivo>. Clamp ±0.30 por chave. */
export interface BehaviorBias {
  [scoreKey: string]: number;
}

export interface SkillBehaviorTeammateEffect {
  scope: SkillRole | 'all';
  /** Raio em metros, default 25. */
  radius?: number;
  bias: BehaviorBias;
}

export interface SkillBehavior {
  id: string;
  name: string;
  /**
   * DSL avaliada pelo runtime sem eval. Combina campos do contexto:
   *   carrier_is_me, team_has_ball, zone, opp_press_nearby, no_press_nearby,
   *   ball_in_my_box_zone, opp_through_ball, attacker_isolated, etc.
   * Parser oficial chega na Fase 3.
   */
  when: string;
  bias: BehaviorBias;
  /** Cooldown em segundos (de jogo) entre ativações deste behavior. */
  cooldownSec?: number;
  teammateEffect?: SkillBehaviorTeammateEffect;
  /** Behavior só ativo a partir de skill.level >= este valor. */
  minSkillLevel?: number;
}

export interface SkillUnlockRequirements {
  /** Tier mínimo de carreira (1=Fraldinha … 8=Lenda). Default 1. */
  minCareerTier?: number;
  priceExp?: number;
  priceBroCents?: number;
  requiredAchievementIds?: string[];
  availableFromIso?: string;
  availableUntilIso?: string;
}

export interface CoachSkill {
  schema: 'playbook_v1';
  id: string;
  name: string;
  role: SkillRole;
  tier: SkillTier;
  philosophy: string;
  /** 1-5 (manager pode evoluir). */
  level: number;
  attrRequirements?: Partial<Record<keyof PlayerAttributes, number>>;
  behaviors: SkillBehavior[];
  unlock: SkillUnlockRequirements;
  presentation?: {
    badgeColor?: string;
    iconKey?: string;
    heroImageUrl?: string;
  };
  research?: { seeds: string[] };
}

// ── Validador ─────────────────────────────────────────────────────

/** Constantes do validador (espelham a spec). */
export const PLAYBOOK_V1_LIMITS = {
  ID_REGEX: /^skl_[a-z0-9_]{3,40}$/,
  BEHAVIOR_ID_REGEX: /^bh_[a-z0-9_]{2,48}$/,
  BIAS_CLAMP: 0.30,
  ATTR_MIN: 0,
  ATTR_MAX: 100,
  BEHAVIORS_MIN: 2,
  BEHAVIORS_MAX: 12,
  LEVEL_MIN: 1,
  LEVEL_MAX: 5,
} as const;

export interface PlaybookValidationIssue {
  path: string;
  message: string;
}

export interface PlaybookValidationResult {
  ok: boolean;
  issues: PlaybookValidationIssue[];
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

/**
 * Valida um CoachSkill conforme PlaybookV1.
 *
 * Não lança — retorna lista de issues. Caller decide se aborta ou clamp.
 * Para clamp automático de bias use {@link clampSkillBiases}.
 */
export function validateCoachSkill(input: unknown): PlaybookValidationResult {
  const issues: PlaybookValidationIssue[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });

  if (!input || typeof input !== 'object') {
    return { ok: false, issues: [{ path: '$', message: 'must be an object' }] };
  }
  const s = input as Record<string, unknown>;

  if (s.schema !== 'playbook_v1') push('schema', `expected 'playbook_v1', got ${String(s.schema)}`);
  if (!isString(s.id) || !PLAYBOOK_V1_LIMITS.ID_REGEX.test(s.id)) {
    push('id', `must match ${PLAYBOOK_V1_LIMITS.ID_REGEX} (got ${String(s.id)})`);
  }
  if (!isString(s.name) || s.name.trim().length < 2) push('name', 'required, ≥2 chars');
  if (!isString(s.philosophy) || s.philosophy.trim().length < 4) {
    push('philosophy', 'required, ≥4 chars (texto curto de venda)');
  }
  if (!isString(s.role) || !SKILL_ROLES.includes(s.role as SkillRole)) {
    push('role', `must be one of ${SKILL_ROLES.join('|')}`);
  }
  if (!isString(s.tier) || !SKILL_TIERS.includes(s.tier as SkillTier)) {
    push('tier', `must be one of ${SKILL_TIERS.join('|')}`);
  }
  if (
    !isFiniteNumber(s.level) ||
    s.level < PLAYBOOK_V1_LIMITS.LEVEL_MIN ||
    s.level > PLAYBOOK_V1_LIMITS.LEVEL_MAX ||
    !Number.isInteger(s.level)
  ) {
    push('level', `int in [${PLAYBOOK_V1_LIMITS.LEVEL_MIN}, ${PLAYBOOK_V1_LIMITS.LEVEL_MAX}]`);
  }

  // attrRequirements
  if (s.attrRequirements != null) {
    if (typeof s.attrRequirements !== 'object') {
      push('attrRequirements', 'must be object<attr,number>|undefined');
    } else {
      for (const [k, v] of Object.entries(s.attrRequirements as Record<string, unknown>)) {
        if (!isFiniteNumber(v) || v < PLAYBOOK_V1_LIMITS.ATTR_MIN || v > PLAYBOOK_V1_LIMITS.ATTR_MAX) {
          push(`attrRequirements.${k}`, `must be number in [${PLAYBOOK_V1_LIMITS.ATTR_MIN}, ${PLAYBOOK_V1_LIMITS.ATTR_MAX}]`);
        }
      }
    }
  }

  // behaviors
  if (!Array.isArray(s.behaviors)) {
    push('behaviors', 'must be array');
  } else {
    if (s.behaviors.length < PLAYBOOK_V1_LIMITS.BEHAVIORS_MIN || s.behaviors.length > PLAYBOOK_V1_LIMITS.BEHAVIORS_MAX) {
      push('behaviors', `length in [${PLAYBOOK_V1_LIMITS.BEHAVIORS_MIN}, ${PLAYBOOK_V1_LIMITS.BEHAVIORS_MAX}] (got ${s.behaviors.length})`);
    }
    s.behaviors.forEach((b, i) => validateBehavior(b, `behaviors[${i}]`, push));
  }

  // unlock — pelo menos um requisito
  if (!s.unlock || typeof s.unlock !== 'object') {
    push('unlock', 'required object');
  } else {
    const u = s.unlock as Record<string, unknown>;
    const hasAny =
      isFiniteNumber(u.minCareerTier) ||
      isFiniteNumber(u.priceExp) ||
      isFiniteNumber(u.priceBroCents) ||
      (Array.isArray(u.requiredAchievementIds) && u.requiredAchievementIds.length > 0);
    if (!hasAny) push('unlock', 'must define at least one of minCareerTier|priceExp|priceBroCents|requiredAchievementIds');
    if (u.priceExp != null && (!isFiniteNumber(u.priceExp) || u.priceExp < 0)) push('unlock.priceExp', '≥0');
    if (u.priceBroCents != null && (!isFiniteNumber(u.priceBroCents) || u.priceBroCents < 0)) push('unlock.priceBroCents', '≥0');
    if (u.minCareerTier != null && (!isFiniteNumber(u.minCareerTier) || u.minCareerTier < 1 || u.minCareerTier > 8)) {
      push('unlock.minCareerTier', 'int in [1, 8]');
    }
  }

  return { ok: issues.length === 0, issues };
}

function validateBehavior(
  b: unknown,
  path: string,
  push: (p: string, m: string) => void,
): void {
  if (!b || typeof b !== 'object') {
    push(path, 'must be object');
    return;
  }
  const o = b as Record<string, unknown>;
  if (!isString(o.id) || !PLAYBOOK_V1_LIMITS.BEHAVIOR_ID_REGEX.test(o.id)) {
    push(`${path}.id`, `must match ${PLAYBOOK_V1_LIMITS.BEHAVIOR_ID_REGEX}`);
  }
  if (!isString(o.name) || o.name.trim().length < 2) push(`${path}.name`, '≥2 chars');
  if (!isString(o.when) || o.when.trim().length === 0) push(`${path}.when`, 'required (DSL string)');

  if (!o.bias || typeof o.bias !== 'object') {
    push(`${path}.bias`, 'required object');
  } else {
    for (const [k, v] of Object.entries(o.bias as Record<string, unknown>)) {
      if (!isFiniteNumber(v)) {
        push(`${path}.bias.${k}`, 'must be number');
      } else if (Math.abs(v) > PLAYBOOK_V1_LIMITS.BIAS_CLAMP + 1e-9) {
        push(`${path}.bias.${k}`, `|value| must be ≤ ${PLAYBOOK_V1_LIMITS.BIAS_CLAMP} (got ${v})`);
      }
    }
  }

  if (o.cooldownSec != null && (!isFiniteNumber(o.cooldownSec) || o.cooldownSec < 0)) {
    push(`${path}.cooldownSec`, '≥0 seconds');
  }

  if (o.teammateEffect != null) {
    const t = o.teammateEffect as Record<string, unknown>;
    if (!isString(t.scope) || (t.scope !== 'all' && !SKILL_ROLES.includes(t.scope as SkillRole))) {
      push(`${path}.teammateEffect.scope`, `must be one of ${SKILL_ROLES.join('|')} or 'all'`);
    }
    if (t.radius != null && (!isFiniteNumber(t.radius) || t.radius <= 0)) {
      push(`${path}.teammateEffect.radius`, '>0 meters');
    }
    if (!t.bias || typeof t.bias !== 'object') {
      push(`${path}.teammateEffect.bias`, 'required object');
    } else {
      for (const [k, v] of Object.entries(t.bias as Record<string, unknown>)) {
        if (!isFiniteNumber(v)) {
          push(`${path}.teammateEffect.bias.${k}`, 'must be number');
        } else if (Math.abs(v) > PLAYBOOK_V1_LIMITS.BIAS_CLAMP + 1e-9) {
          push(`${path}.teammateEffect.bias.${k}`, `|value| must be ≤ ${PLAYBOOK_V1_LIMITS.BIAS_CLAMP}`);
        }
      }
    }
  }

  if (o.minSkillLevel != null) {
    if (
      !isFiniteNumber(o.minSkillLevel) ||
      !Number.isInteger(o.minSkillLevel) ||
      o.minSkillLevel < 1 ||
      o.minSkillLevel > PLAYBOOK_V1_LIMITS.LEVEL_MAX
    ) {
      push(`${path}.minSkillLevel`, `int in [1, ${PLAYBOOK_V1_LIMITS.LEVEL_MAX}]`);
    }
  }
}

/**
 * Aplica clamp ±0.30 in-place em todos os bias (skill + teammateEffect).
 * Útil ao importar JSON gerado por LLM antes de salvar no catálogo.
 */
export function clampSkillBiases(skill: CoachSkill): CoachSkill {
  const clamp = (v: number) =>
    Math.max(-PLAYBOOK_V1_LIMITS.BIAS_CLAMP, Math.min(PLAYBOOK_V1_LIMITS.BIAS_CLAMP, v));
  for (const b of skill.behaviors) {
    for (const k of Object.keys(b.bias)) b.bias[k] = clamp(b.bias[k]!);
    if (b.teammateEffect) {
      for (const k of Object.keys(b.teammateEffect.bias)) {
        b.teammateEffect.bias[k] = clamp(b.teammateEffect.bias[k]!);
      }
    }
  }
  return skill;
}

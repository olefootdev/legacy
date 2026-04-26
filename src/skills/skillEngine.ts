/**
 * SkillEngine — camada unificada de resolução de skills.
 *
 * Reusa `skillZoneIntegration` (compatibilidade + multiplicador zonal) e
 * `awareness` (pressão local). Skills no Olefoot são derivadas de atributos
 * do PlayerEntity; este motor:
 *   - mapeia evento → SkillType
 *   - calcula triggerChance (proxy de atributo) modificado por zona/pressão
 *   - aplica teamSkillMultiplier do legacyTeamBooster
 *   - respeita cooldown por (playerId, skillType)
 *   - retorna { fired, finalEffect } pro caller modular o resultado
 *
 * Não substitui lógica existente — se nada dispara, retorna modifier=1.0
 * (no-op). Caller multiplica o finalEffect onde fizer sentido.
 */

import type { PitchPlayerState } from '@/engine/types';
import type { ZoneInfo } from '@/match/spatialZones';
import {
  isSkillCompatibleWithZone,
  zoneMultiplierForSkill,
  type SkillType,
} from '@/smartfield/skillZoneIntegration';
import {
  isCreationZone,
  isFinalThird,
  isBox,
  isDefThird,
} from '@/match/spatialZones';
import type { AwarenessContext } from '@/smartfield/awareness';

export const SKILL_DEBUG = false;

const COOLDOWN_EVENTS = 3;
const BASE_EFFECT = 0.20;
const TECHNICAL_SKILLS: ReadonlySet<SkillType> = new Set([
  'SHOOT', 'DRIBBLE', 'CROSS', 'HEADER', 'PASS', 'FREEKICK',
]);

/** Cooldown ring: chave `${playerId}::${type}` → tickCount restante. */
const cooldown = new Map<string, number>();

/** Decrementa todos os cooldowns; chamar 1x por tick do match engine. */
export function tickSkillCooldowns(): void {
  for (const [k, v] of cooldown) {
    if (v <= 1) cooldown.delete(k);
    else cooldown.set(k, v - 1);
  }
}

export interface SkillResolution {
  fired: boolean;
  type: SkillType;
  triggerChance: number;
  finalEffect: number;
  modifier: number;
  reason: string;
}

/** Atributo proxy → triggerChance base. */
function attrFor(type: SkillType, p: PitchPlayerState): number {
  const a = p.attributes;
  if (!a) return 50;
  switch (type) {
    case 'SHOOT': return a.finalizacao ?? 50;
    case 'DRIBBLE': return a.drible ?? 50;
    case 'CROSS': return a.passeCurto ?? 50;
    case 'HEADER': return ((a.finalizacao ?? 50) + (a.fisico ?? 50)) / 2;
    case 'PASS': return a.passeCurto ?? 50;
    case 'PRESS': return a.marcacao ?? 50;
    case 'BUILD_UP': return a.passeCurto ?? 50;
    case 'DEFEND': return a.marcacao ?? 50;
    case 'FREEKICK': return a.finalizacao ?? 50;
    case 'SAVE': return a.mentalidade ?? 50;
  }
}

/** Categoria zonal explícita conforme spec. */
function zoneCategoryMult(z: ZoneInfo): number {
  if (isBox(z) || isFinalThird(z)) return 1.30;
  if (isDefThird(z)) return 0.60;
  if (isCreationZone(z)) return 1.10;
  return 1.0;
}

/** legacyTeamBooster → multiplicador clamp [0.8, 1.5]. */
export function teamSkillMultiplier(booster?: Record<string, number>): number {
  if (!booster) return 1.0;
  const sum = Object.values(booster).reduce((a, b) => a + b, 0);
  // sum típico 0–20 → mapeia 0→1.0, 20→1.5, neg→0.8
  const m = 1 + sum / 40;
  return Math.max(0.8, Math.min(1.5, m));
}

export interface ResolveSkillsArgs {
  player: PitchPlayerState;
  type: SkillType;
  zone?: ZoneInfo;
  awareness?: AwarenessContext;
  legacyTeamBooster?: Record<string, number>;
}

export function resolveSkills(args: ResolveSkillsArgs): SkillResolution {
  const { player, type, zone, awareness, legacyTeamBooster } = args;
  const reasonParts: string[] = [];

  // Compatibilidade zonal: se zona não comporta, skip.
  if (zone && !isSkillCompatibleWithZone(type, zone)) {
    return logAndReturn({
      fired: false, type, triggerChance: 0, finalEffect: 0, modifier: 1,
      reason: `incompat_zone:${zone.macro}`,
    }, player);
  }

  // Cooldown: bloqueia se ainda em cooldown.
  const cdKey = `${player.playerId}::${type}`;
  if (cooldown.has(cdKey)) {
    return logAndReturn({
      fired: false, type, triggerChance: 0, finalEffect: 0, modifier: 1,
      reason: `cooldown:${cooldown.get(cdKey)}`,
    }, player);
  }

  // triggerChance base = (atributo/100) * 0.5 → 80 de atributo = 40% de chance.
  const attr = attrFor(type, player);
  let triggerChance = Math.max(0.05, (attr / 100) * 0.5);

  // Mod zona (categoria) + mod zona (bias granular do skillZoneIntegration).
  if (zone) {
    triggerChance *= zoneCategoryMult(zone);
    if (awareness) {
      triggerChance *= zoneMultiplierForSkill(type, zone, awareness);
    }
    reasonParts.push(`zone=${zone.macro}`);
  }

  // Pressão alta penaliza skills técnicas em até 50%.
  if (awareness && TECHNICAL_SKILLS.has(type)) {
    if (awareness.pressureLevel > 0.7) triggerChance *= 0.5;
    else if (awareness.pressureLevel > 0.5) triggerChance *= 0.75;
    reasonParts.push(`p=${awareness.pressureLevel.toFixed(2)}`);
  }

  triggerChance = Math.max(0.02, Math.min(0.95, triggerChance));

  const fired = Math.random() < triggerChance;
  const teamMult = teamSkillMultiplier(legacyTeamBooster);
  const finalEffect = fired ? BASE_EFFECT * teamMult : 0;
  const modifier = 1 + finalEffect;

  if (fired) {
    cooldown.set(cdKey, COOLDOWN_EVENTS);
    reasonParts.push(`team=${teamMult.toFixed(2)}`);
  }

  return logAndReturn({
    fired,
    type,
    triggerChance,
    finalEffect,
    modifier,
    reason: reasonParts.join(',') || 'no_ctx',
  }, player);
}

function logAndReturn(r: SkillResolution, p: PitchPlayerState): SkillResolution {
  if (SKILL_DEBUG) {
    // eslint-disable-next-line no-console
    console.log(
      '[SkillEngine]',
      r.type,
      p.name ?? p.playerId,
      `chance=${r.triggerChance.toFixed(3)}`,
      `fired=${r.fired}`,
      r.reason,
    );
  }
  return r;
}

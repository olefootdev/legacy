/**
 * /src/tactical/zonePositioning.ts
 *
 * Funções utilitárias para posicionamento baseado em zones12 + roles.
 * Consumido pelo TacticalSimLoop para substituir o sistema 18-zonas + SmartField.
 *
 * Coordenadas:
 *   zones12:  x=largura(0–100), y=profundidade(0–100, home→away)
 *   world:    x=profundidade(0–105m), z=largura(0–68m)
 *
 * Conversão via fieldGeometry: worldToNormalized / normalizedToWorld
 */

import {
  FIELD_ZONE_BY_ID,
  getZoneFromNormalizedPosition,
  type FieldZoneId,
} from './zones12';
import {
  worldToNormalized,
  normalizedToWorld,
  type NormalizedPos,
  type WorldPos,
} from './fieldGeometry';
import { slotToTacticalRole } from './slotToTacticalRole';
import type { TacticalRoleId } from './roleTypes';

// ── Utilitário: centro geométrico de uma zona em coords normalizadas ──────────

function zoneCenterNorm(id: FieldZoneId): NormalizedPos {
  const b = FIELD_ZONE_BY_ID[id].boundsNormalized;
  return { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
}

// ── Utilitário: distância euclidiana entre dois pontos normalizados ────────────

function normDist(a: NormalizedPos, b: NormalizedPos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Encontra o centro da zona mais próxima de `pos` dentro de `zoneIds`.
 * Retorna a posição normalizada do centro dessa zona.
 */
export function findNearestZoneCenter(
  pos: NormalizedPos,
  zoneIds: readonly FieldZoneId[],
): NormalizedPos {
  if (zoneIds.length === 0) return pos;

  let best = zoneCenterNorm(zoneIds[0]!);
  let bestDist = normDist(pos, best);

  for (let i = 1; i < zoneIds.length; i++) {
    const c = zoneCenterNorm(zoneIds[i]!);
    const d = normDist(pos, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/**
 * Verifica se uma posição world está dentro de uma zona permitida para o slot.
 * Considera fase (ataque/defesa) para escolher allowedZones.
 */
export function isInAllowedZone(
  worldPos: WorldPos,
  slotId: string | undefined,
  teamHasBall: boolean,
  overrideRole?: TacticalRoleId,
): boolean {
  const role = slotToTacticalRole(slotId, overrideRole);
  const norm = worldToNormalized(worldPos);
  const zone = getZoneFromNormalizedPosition(norm);
  if (!zone) return true; // fora do campo → não penalizar
  return role.allowedZones.includes(zone.id);
}

/**
 * Retorna a posição world do centro da zona alvo mais próxima para o slot.
 * Usa attackShape (posse) ou defenseShape (sem posse) como zonas alvo.
 * Fallback para allowedZones se shape estiver vazio.
 *
 * Para o time away no 1º tempo: as zonas são espelhadas em y (profundidade).
 * Para o 2º tempo: o TacticalSimLoop já inverte attackDir — as zonas são
 * interpretadas do ponto de vista do time (home sempre ataca para +x).
 */
export function getTargetZoneCenter(
  worldPos: WorldPos,
  slotId: string | undefined,
  teamHasBall: boolean,
  side: 'home' | 'away',
  half: 1 | 2,
  overrideRole?: TacticalRoleId,
): WorldPos {
  const role = slotToTacticalRole(slotId, overrideRole);

  // Zonas alvo: shape da fase atual, fallback para allowedZones
  const shapeZones = teamHasBall ? role.attackShape : role.defenseShape;
  const targetZones = shapeZones.length > 0 ? shapeZones : role.allowedZones;

  // Posição atual em coords normalizadas
  // Para away: espelhar y para que as zonas sejam do ponto de vista do time
  const rawNorm = worldToNormalized(worldPos);
  const norm: NormalizedPos = needsMirror(side, half)
    ? { x: rawNorm.x, y: 100 - rawNorm.y }
    : rawNorm;

  // Zona alvo mais próxima
  const bestNorm = findNearestZoneCenter(norm, targetZones);

  // Desespelhar antes de converter para world
  const finalNorm: NormalizedPos = needsMirror(side, half)
    ? { x: bestNorm.x, y: 100 - bestNorm.y }
    : bestNorm;

  return normalizedToWorld(finalNorm);
}

/**
 * Verifica se a posição world está dentro das zonas permitidas (do ponto de
 * vista do time — espelhado para away).
 */
export function isInAllowedZoneSided(
  worldPos: WorldPos,
  slotId: string | undefined,
  teamHasBall: boolean,
  side: 'home' | 'away',
  half: 1 | 2,
  overrideRole?: TacticalRoleId,
): boolean {
  const role = slotToTacticalRole(slotId, overrideRole);
  const rawNorm = worldToNormalized(worldPos);
  const norm: NormalizedPos = needsMirror(side, half)
    ? { x: rawNorm.x, y: 100 - rawNorm.y }
    : rawNorm;
  const zone = getZoneFromNormalizedPosition(norm);
  if (!zone) return true;
  return role.allowedZones.includes(zone.id);
}

/**
 * Away no 1º tempo ataca para +x (y crescente no zones12 = profundidade home→away).
 * Away no 2º tempo ataca para -x (espelhar y).
 * Home no 1º tempo: sem espelho.
 * Home no 2º tempo: espelhar (ataca para -x).
 */
function needsMirror(side: 'home' | 'away', half: 1 | 2): boolean {
  // Home ataca +x no 1T, -x no 2T → espelhar no 2T
  // Away ataca -x no 1T, +x no 2T → espelhar no 1T
  if (side === 'home') return half === 2;
  return half === 1;
}

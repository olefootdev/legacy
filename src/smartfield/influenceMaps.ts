import type { SfZone } from './smartfieldBridge';
import { uiPercentToWorld } from '@/simulation/field';

export type InfluenceMap = Record<string, {
  home: number;
  away: number;
  dominant: 'home' | 'away' | 'contested';
}>;

/**
 * Count how many players from each side occupy each subzone.
 * Players are in engine coords (0-100); subzone rects are in world meters.
 */
export function computeZoneInfluence(
  homePlayers: { x: number; y: number }[],
  awayPlayers: { x: number; y: number }[],
  subzones: SfZone[],
): InfluenceMap {
  const result: InfluenceMap = {};

  for (const zone of subzones) {
    const r = zone.rect;
    let home = 0;
    let away = 0;

    for (const p of homePlayers) {
      const { x, z } = uiPercentToWorld(p.x, p.y);
      if (x >= r.x_min && x <= r.x_max && z >= r.z_min && z <= r.z_max) home++;
    }
    for (const p of awayPlayers) {
      const { x, z } = uiPercentToWorld(p.x, p.y);
      if (x >= r.x_min && x <= r.x_max && z >= r.z_min && z <= r.z_max) away++;
    }

    let dominant: 'home' | 'away' | 'contested';
    if (Math.abs(home - away) <= 1) dominant = 'contested';
    else dominant = home > away ? 'home' : 'away';

    result[zone.id] = { home, away, dominant };
  }

  return result;
}

/**
 * Returns subzone IDs where `side` has at least one player and the opponent has zero.
 */
export function getOpenChannels(influence: InfluenceMap, side: 'home' | 'away'): string[] {
  const opp: 'home' | 'away' = side === 'home' ? 'away' : 'home';
  return Object.entries(influence)
    .filter(([, v]) => v[side] > 0 && v[opp] === 0)
    .map(([id]) => id);
}

/**
 * Campograma 18 zonas (3 linhas × 6 faixas) — referencial da equipa (IFAB, 1.º/2.º tempo).
 * Clamp duro à união base ∪ active ∪ support para manter GK na área, atacantes na linha de finalização, etc.
 *
 * `Admin`: no futuro poderá sobrepor `baseZone` / conjuntos por slot; por ora defaults estáveis por formação.
 */
import type { FormationSchemeId } from '@/match-engine/types';
import { FORMATION_BASES, type LineRole } from '@/match-engine/formations/catalog';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import {
  depthFromOwnGoal,
  getDefendingGoalX,
  getSideAttackDir,
  type MatchHalf,
  type TeamPitchContext,
  type TeamSide,
} from '@/match/fieldZones';

export type Tactical18ZoneId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export type TacticalBehaviorProfile =
  | 'gk'
  | 'fullback'
  | 'center_back'
  | 'midfield'
  | 'winger'
  | 'striker'
  | 'shadow';

/** Rótulos padrão (Admin poderá substituir mapeamentos por posição). */
export const TACTICAL18_ZONE_NAMES: Record<Tactical18ZoneId, string> = {
  1: 'Z1-LWB',
  2: 'Z2-LB',
  3: 'Z3-LCB',
  4: 'Z4-GK',
  5: 'Z5-RCB',
  6: 'Z6-RB',
  7: 'Z7-ML',
  8: 'Z8-LCM',
  9: 'Z9-CM',
  10: 'Z10-RCM',
  11: 'Z11-MR',
  12: 'Z12-AM',
  13: 'Z13-LW',
  14: 'Z14-SS-L',
  15: 'Z15-ST',
  16: 'Z16-SS-R',
  17: 'Z17-RW',
  18: 'Z18-CF',
};

export interface PlayerTacticalFieldModel {
  role: string;
  baseZone: Tactical18ZoneId;
  activeZones: readonly Tactical18ZoneId[];
  supportZones: readonly Tactical18ZoneId[];
  behaviorProfile: TacticalBehaviorProfile;
}

export type PlayerZoneTacticalModel = PlayerTacticalFieldModel;
export type ZoneEngagementMode = 'engage' | 'support' | 'structure';

export interface Tactical18OverlayCell {
  id: Tactical18ZoneId;
  label: string;
  uxLo: number;
  uxHi: number;
  uyLo: number;
  uyHi: number;
}

export function zoneRow18(z: Tactical18ZoneId): 0 | 1 | 2 {
  return Math.floor((z - 1) / 6) as 0 | 1 | 2;
}

export function zoneCol18(z: Tactical18ZoneId): number {
  return (z - 1) % 6;
}

function at18(r: number, c: number): Tactical18ZoneId | null {
  if (r < 0 || r > 2 || c < 0 || c > 5) return null;
  return (r * 6 + c + 1) as Tactical18ZoneId;
}

export function neighbors8Zone18(z: Tactical18ZoneId): Tactical18ZoneId[] {
  const r = zoneRow18(z);
  const c = zoneCol18(z);
  const out: Tactical18ZoneId[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const zz = at18(r + dr, c + dc);
      if (zz) out.push(zz);
    }
  }
  return out;
}

function sortZones18(ids: Tactical18ZoneId[]): Tactical18ZoneId[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

function behaviorProfileForSlot(slotId: string, line: LineRole): TacticalBehaviorProfile {
  const s = slotId.toLowerCase();
  if (s === 'gol') return 'gk';
  if (s === 'vol' && line === 'def') return 'fullback';
  if (s === 'le' || s === 'ld') return line === 'def' ? 'fullback' : 'winger';
  if (s.startsWith('zag')) return 'center_back';
  if (s === 'pe' || s === 'pd') return line === 'att' ? 'winger' : 'midfield';
  if (s === 'ata') return 'striker';
  if (s === 'vol') return line === 'att' ? 'shadow' : 'midfield';
  if (s.startsWith('mc')) return 'midfield';
  return 'midfield';
}

/** Faixa [x0,x1] no mundo para o terço `row` no referencial da equipa. */
export function worldXRangeForDepthRow18(
  team: TeamSide,
  half: MatchHalf,
  row: 0 | 1 | 2,
): [number, number] {
  const L = FIELD_LENGTH;
  const third = L / 3;
  const d0 = row * third;
  const d1 = (row + 1) * third;
  const gx = getDefendingGoalX(team, half);
  if (gx <= L * 0.25) {
    return [d0, d1];
  }
  return [L - d1, L - d0];
}

export function zoneBoundsWorld18(
  zoneId: Tactical18ZoneId,
  ctx: TeamPitchContext,
  margin = 0.85,
): { x0: number; x1: number; z0: number; z1: number } {
  const r = zoneRow18(zoneId);
  const c = zoneCol18(zoneId);
  const [xa, xb] = worldXRangeForDepthRow18(ctx.team, ctx.half, r);
  const xLo = Math.min(xa, xb) + margin;
  const xHi = Math.max(xa, xb) - margin;
  const zLo = (c * FIELD_WIDTH) / 6 + margin;
  const zHi = ((c + 1) * FIELD_WIDTH) / 6 - margin;
  return { x0: xLo, x1: xHi, z0: zLo, z1: zHi };
}

export function worldPosToTactical18Zone(
  x: number,
  z: number,
  ctx: TeamPitchContext,
): Tactical18ZoneId {
  const depth = Math.min(FIELD_LENGTH, Math.max(0, depthFromOwnGoal(x, ctx.team, ctx.half)));
  const third = FIELD_LENGTH / 3;
  const row = Math.min(2, Math.floor(depth / third));
  const u = Math.min(FIELD_WIDTH - 1e-6, Math.max(0, z));
  const col = Math.min(5, Math.floor((u / FIELD_WIDTH) * 6));
  return (row * 6 + col + 1) as Tactical18ZoneId;
}

export function worldPositionToTactical18ShortLabel(
  xm: number,
  zm: number,
  team: TeamSide,
  half: MatchHalf,
): string {
  const z = worldPosToTactical18Zone(xm, zm, { team, half });
  return `Z${z}`;
}

export function buildTactical18OverlayCells(team: TeamSide, half: MatchHalf): Tactical18OverlayCell[] {
  const ctx: TeamPitchContext = { team, half };
  const out: Tactical18OverlayCell[] = [];
  for (let id = 1; id <= 18; id++) {
    const zid = id as Tactical18ZoneId;
    const b = zoneBoundsWorld18(zid, ctx, 0);
    const uxLo = (Math.min(b.x0, b.x1) / FIELD_LENGTH) * 100;
    const uxHi = (Math.max(b.x0, b.x1) / FIELD_LENGTH) * 100;
    const uyLo = (b.z0 / FIELD_WIDTH) * 100;
    const uyHi = (b.z1 / FIELD_WIDTH) * 100;
    out.push({
      id: zid,
      label: String(id),
      uxLo,
      uxHi,
      uyLo,
      uyHi,
    });
  }
  return out;
}

function expandActiveZones18(base: Tactical18ZoneId, profile: TacticalBehaviorProfile): Tactical18ZoneId[] {
  const r = zoneRow18(base);
  const c = zoneCol18(base);
  const set = new Set<Tactical18ZoneId>([base]);
  const add = (z: Tactical18ZoneId | null) => {
    if (z != null) set.add(z);
  };

  switch (profile) {
    case 'gk':
      add(at18(0, 1));
      add(at18(0, 2));
      add(at18(0, 3));
      add(at18(0, 4));
      break;
    case 'center_back': {
      add(at18(r, c - 1));
      add(at18(r, c + 1));
      add(at18(1, c));
      add(at18(1, c - 1));
      add(at18(1, c + 1));
      break;
    }
    case 'fullback': {
      add(at18(r, c - 1));
      add(at18(r, c + 1));
      add(at18(1, c));
      if (c > 0) add(at18(1, c - 1));
      if (c < 5) add(at18(1, c + 1));
      add(at18(2, c));
      break;
    }
    case 'midfield': {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          add(at18(r + dr, c + dc));
        }
      }
      break;
    }
    case 'winger': {
      add(at18(r, c - 1));
      add(at18(r, c + 1));
      if (r > 0) add(at18(r - 1, c));
      if (r < 2) add(at18(r + 1, c));
      if (r < 2 && c > 0) add(at18(r + 1, c - 1));
      if (r < 2 && c < 5) add(at18(r + 1, c + 1));
      if (r > 0 && c > 0) add(at18(r - 1, c - 1));
      if (r > 0 && c < 5) add(at18(r - 1, c + 1));
      break;
    }
    case 'striker': {
      add(at18(r, c - 1));
      add(at18(r, c + 1));
      if (r > 0) {
        add(at18(r - 1, c));
        add(at18(r - 1, c - 1));
        add(at18(r - 1, c + 1));
      }
      if (r < 2) add(at18(r + 1, c));
      break;
    }
    case 'shadow': {
      add(at18(r, c - 1));
      add(at18(r, c + 1));
      add(at18(r, c - 2));
      add(at18(r, c + 2));
      if (r > 0) {
        add(at18(r - 1, c));
        add(at18(r - 1, c - 1));
        add(at18(r - 1, c + 1));
      }
      if (r < 2) add(at18(r + 1, c));
      break;
    }
    default:
      break;
  }

  return sortZones18([...set]);
}

function computeSupportZones18(active: readonly Tactical18ZoneId[]): Tactical18ZoneId[] {
  const a = new Set(active);
  const s = new Set<Tactical18ZoneId>();
  for (const z of active) {
    for (const n of neighbors8Zone18(z)) {
      if (!a.has(n)) s.add(n);
    }
  }
  return sortZones18([...s]);
}

export function operativeZoneIdSet18(model: PlayerTacticalFieldModel): Set<Tactical18ZoneId> {
  return new Set<Tactical18ZoneId>([model.baseZone, ...model.activeZones, ...model.supportZones]);
}

/** Mantém o GR atrás da linha da grande área (aprox.). */
export function clampWorldXToMaxDepthFromOwnGoal18(
  x: number,
  team: TeamSide,
  half: MatchHalf,
  maxDepthM: number,
): number {
  const d = depthFromOwnGoal(x, team, half);
  if (d <= maxDepthM) return x;
  const gx = getDefendingGoalX(team, half);
  if (gx <= FIELD_LENGTH * 0.25) {
    return Math.min(FIELD_LENGTH - 1.2, gx + maxDepthM);
  }
  return Math.max(1.2, gx - maxDepthM);
}

export function buildSlotZoneProfile(
  slotId: string,
  role: string,
  scheme: FormationSchemeId,
  side: 'home' | 'away',
  half: MatchHalf,
): PlayerTacticalFieldModel {
  const ctx: TeamPitchContext = { team: side, half };
  const bases = FORMATION_BASES[scheme];
  const b = bases[slotId];
  const profile = b ? behaviorProfileForSlot(slotId, b.line) : 'midfield';

  if (!b) {
    const mid = worldPosToTactical18Zone(FIELD_LENGTH * 0.5, FIELD_WIDTH * 0.5, ctx);
    const fullActive = expandActiveZones18(mid, profile);
    return {
      role,
      baseZone: mid,
      activeZones: fullActive.filter((z) => z !== mid),
      supportZones: computeSupportZones18(fullActive),
      behaviorProfile: profile,
    };
  }

  let nx = b.nx;
  if (side === 'away') nx = 1 - nx;
  const x = nx * FIELD_LENGTH;
  const z = b.nz * FIELD_WIDTH;
  let base = worldPosToTactical18Zone(x, z, ctx);
  if (slotId === 'gol' || role === 'gk') {
    base = 4;
  }

  const fullActive = expandActiveZones18(base, profile);
  return {
    role,
    baseZone: base,
    activeZones: fullActive.filter((z) => z !== base),
    supportZones: computeSupportZones18(fullActive),
    behaviorProfile: profile,
  };
}

export function resolveZoneEngagement(
  ballX: number,
  ballZ: number,
  model: PlayerTacticalFieldModel,
  ctx: TeamPitchContext,
): ZoneEngagementMode {
  const bz = worldPosToTactical18Zone(ballX, ballZ, ctx);
  if (bz === model.baseZone || model.activeZones.includes(bz)) return 'engage';
  if (model.supportZones.includes(bz)) return 'support';
  return 'structure';
}

/**
 * Força (x,z) para dentro da união das zonas operacionais — núcleo da “inteligência” de manutenção de forma.
 */
export function clampWorldToOperativeTactical18(
  x: number,
  z: number,
  slotId: string,
  role: string,
  scheme: FormationSchemeId,
  side: 'home' | 'away',
  half: MatchHalf,
  margin = 0.75,
): { x: number; z: number } {
  const model = buildSlotZoneProfile(slotId, role, scheme, side, half);
  const allowed = operativeZoneIdSet18(model);
  const ctx: TeamPitchContext = { team: side, half };
  const cur = worldPosToTactical18Zone(x, z, ctx);

  const clampInside = (zid: Tactical18ZoneId, px: number, pz: number) => {
    const b = zoneBoundsWorld18(zid, ctx, margin);
    return {
      x: Math.min(b.x1, Math.max(b.x0, px)),
      z: Math.min(b.z1, Math.max(b.z0, pz)),
    };
  };

  if (allowed.has(cur)) {
    const o = clampInside(cur, x, z);
    if (slotId === 'gol' || role === 'gk') {
      o.x = clampWorldXToMaxDepthFromOwnGoal18(o.x, side, half, 17);
    }
    return o;
  }

  let bestX = x;
  let bestZ = z;
  let bestDist = Infinity;
  for (const zid of allowed) {
    const b = zoneBoundsWorld18(zid, ctx, margin);
    const px = Math.min(b.x1, Math.max(b.x0, x));
    const pz = Math.min(b.z1, Math.max(b.z0, z));
    const d = Math.hypot(x - px, z - pz);
    if (d < bestDist) {
      bestDist = d;
      bestX = px;
      bestZ = pz;
    }
  }

  if (slotId === 'gol' || role === 'gk') {
    bestX = clampWorldXToMaxDepthFromOwnGoal18(bestX, side, half, 17);
  }
  return { x: bestX, z: bestZ };
}

/** Deslocamento do bloco — atenuado para não destruir o clamp 18-zonas. */
export function applyBallCentricShiftToSlotMap(
  slots: Map<string, { x: number; z: number }>,
  opts: {
    ballX: number;
    ballZ: number;
    side: 'home' | 'away';
    half: MatchHalf;
    strength?: number;
  },
): void {
  const { ballX, ballZ, side, half, strength = 0.04 } = opts;
  const ad = getSideAttackDir(side, half);
  const shiftX = ad * (ballX - FIELD_LENGTH * 0.5) * strength;
  const shiftZ = (ballZ - FIELD_WIDTH * 0.5) * strength * 0.55;

  const ballCor = ballZ < FIELD_WIDTH / 3 ? 0 : ballZ < (2 * FIELD_WIDTH) / 3 ? 1 : 2;

  for (const [slot, p] of slots) {
    const cor = p.z < FIELD_WIDTH / 3 ? 0 : p.z < (2 * FIELD_WIDTH) / 3 ? 1 : 2;
    const corridorDelta = Math.abs(cor - ballCor);
    const weakSide = corridorDelta >= 2 ? 0.38 : corridorDelta === 1 ? 0.72 : 1;

    const nx = Math.min(FIELD_LENGTH - 1, Math.max(1, p.x + shiftX * weakSide));
    const nz = Math.min(FIELD_WIDTH - 1, Math.max(1, p.z + shiftZ * weakSide));
    slots.set(slot, { x: nx, z: nz });
  }
}

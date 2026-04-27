import type { PitchPlayerState } from './types';
import type { PlayerEntity } from '@/entities/types';
import { behaviorToCognitiveArchetype, matchAttributesFromPlayerEntity } from '@/match/playerInMatch';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  loadGameSpiritPositionOverrideMap,
  normalizePositionCode,
} from '@/gamespirit/positionOverridesFromKnowledge';
import { kickoffEngineXPercent, outfieldCatalogNxBounds } from '@/engine/kickoffFormationLayout';

export function roleFromPos(pos: string): PitchPlayerState['role'] {
  const p = pos.toUpperCase();
  if (p === 'GOL') return 'gk';
  if (p === 'ZAG' || p === 'LE' || p === 'LD' || p === 'VOL') return 'def';
  if (p === 'MC') return 'mid';
  return 'attack';
}

/** Fallback 4-3-3 se slot não existir na formação (não deveria ocorrer). */
const SLOT_COORD_FALLBACK: Record<string, { x: number; y: number }> = {
  pe: { x: 72, y: 22 },
  ata: { x: 78, y: 50 },
  pd: { x: 72, y: 78 },
  mc1: { x: 58, y: 32 },
  vol: { x: 48, y: 50 },
  mc2: { x: 58, y: 68 },
  le: { x: 32, y: 18 },
  zag1: { x: 28, y: 38 },
  zag2: { x: 28, y: 62 },
  ld: { x: 32, y: 82 },
  gol: { x: 12, y: 50 },
};

/** nx/nz normalizados → % do campo (OLE ataca para +x). */
function coordsFromFormationSlot(scheme: FormationSchemeId, slotId: string): { x: number; y: number } {
  const b = FORMATION_BASES[scheme]?.[slotId];
  if (b) {
    return { x: Math.round(b.nx * 100), y: Math.round(b.nz * 100) };
  }
  return SLOT_COORD_FALLBACK[slotId] ?? { x: 50, y: 50 };
}

function coordsForPlayerOnPitch(
  scheme: FormationSchemeId,
  slotId: string,
  playerPos: string,
  gsMap: Record<string, { x: number; y: number }> | null,
): { x: number; y: number } {
  const key = normalizePositionCode(playerPos);
  if (gsMap && key && gsMap[key]) {
    return { ...gsMap[key]! };
  }
  return coordsFromFormationSlot(scheme, slotId);
}

export function pitchPlayersFromLineup(
  lineup: Record<string, string>,
  players: Record<string, PlayerEntity>,
  scheme: FormationSchemeId = '4-3-3',
): PitchPlayerState[] {
  const gsMap = loadGameSpiritPositionOverrideMap();
  const nxBounds = outfieldCatalogNxBounds(scheme);
  const out: PitchPlayerState[] = [];
  for (const [slotId, pid] of Object.entries(lineup)) {
    const p = players[pid];
    if (!p) continue;
    const base = coordsForPlayerOnPitch(scheme, slotId, p.pos, gsMap);
    const slotBase = FORMATION_BASES[scheme]?.[slotId];
    const catalogNx = slotBase?.nx ?? base.x / 100;
    const kickX = kickoffEngineXPercent('home', catalogNx, nxBounds.nxMin, nxBounds.nxMax, slotId === 'gol');
    out.push({
      playerId: p.id,
      slotId,
      name: p.name,
      num: p.num,
      pos: p.pos,
      x: kickX + (p.num % 3) - 1,
      y: base.y + (p.id.length % 3) - 1,
      fatigue: Math.round(p.fatigue),
      role: roleFromPos(p.pos),
      attributes: matchAttributesFromPlayerEntity(p),
      cognitiveArchetype: behaviorToCognitiveArchetype(p.behavior),
      strongFoot: p.strongFoot,
      archetype: p.archetype,
    });
  }
  return out;
}

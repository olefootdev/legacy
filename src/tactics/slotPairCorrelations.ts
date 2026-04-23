import type { FormationSchemeId } from '@/match-engine/types';
import { FIELD_WIDTH } from '@/simulation/field';
import { getThird, getSideAttackDir, type MatchHalf } from '@/match/fieldZones';
import type { CollectivePlayPhase } from '@/playerDecision/teamCollectiveState';

export interface SlotPairCorrelationInput {
  slotId: string;
  side: 'home' | 'away';
  selfX: number;
  selfZ: number;
  ballX: number;
  ballZ: number;
  teammatesBySlot: Map<string, { x: number; z: number }>;
  teamHasBall: boolean;
  half: MatchHalf;
  scheme: FormationSchemeId;
  collectivePhase?: CollectivePlayPhase;
}

export function computeSlotPairWorldDelta(input: SlotPairCorrelationInput): { dx: number; dz: number } {
  const { slotId, side, selfX, selfZ, ballX, ballZ, teammatesBySlot, teamHasBall, half } = input;
  let dx = 0;
  let dz = 0;
  if (!teamHasBall) return { dx, dz };

  const atk = getSideAttackDir(side, half);
  const ballThird = getThird({ x: ballX, z: ballZ }, { team: side, half });

  const posPd = teammatesBySlot.get('pd');
  const posPe = teammatesBySlot.get('pe');
  const posLd = teammatesBySlot.get('ld');
  const posLe = teammatesBySlot.get('le');
  const posVol = teammatesBySlot.get('vol');
  const posMc1 = teammatesBySlot.get('mc1');
  const posMc2 = teammatesBySlot.get('mc2');
  const posAta = teammatesBySlot.get('ata');
  const posZag1 = teammatesBySlot.get('zag1');
  const posZag2 = teammatesBySlot.get('zag2');

  const ahead = (px: number) => (px - selfX) * atk;

  // Centre-backs split when building from the back
  if (ballThird === 'defensive' && (slotId === 'zag1' || slotId === 'zag2')) {
    const onSide =
      (slotId === 'zag1' && ballZ < FIELD_WIDTH * 0.5)
      || (slotId === 'zag2' && ballZ >= FIELD_WIDTH * 0.5);
    if (onSide && Math.abs(ballZ - selfZ) < 16) {
      dz += ballZ < FIELD_WIDTH / 2 ? -1.3 : 1.3;
    }
  }

  // Volante drops when interiors push high
  if (slotId === 'vol' && posMc1 && posMc2) {
    const centralBall = Math.abs(ballZ - FIELD_WIDTH / 2) < 8.5;
    const midsHigh = ahead(posMc1.x) > 0.5 && ahead(posMc2.x) > 0.5;
    if (centralBall && midsHigh && (ballThird === 'middle' || ballThird === 'attacking')) {
      dx -= atk * 1.2;
    }
  }

  // Volante widens when ball goes to the wing (cover passing lane)
  if (slotId === 'vol' && ballThird === 'middle') {
    const ballWide = Math.abs(ballZ - FIELD_WIDTH / 2) > FIELD_WIDTH * 0.25;
    if (ballWide) {
      dz += ballZ < FIELD_WIDTH / 2 ? -0.8 : 0.8;
    }
  }

  // -----------------------------------------------------------------------
  // Phase-aware synchronized movements (collective play phase) — all thirds
  // -----------------------------------------------------------------------
  const phase = input.collectivePhase;
  if (phase) {
    if (phase === 'progression') {
      if (slotId === 'vol' && posMc1 && posMc2) {
        const midAvgZ = (posMc1.z + posMc2.z) / 2;
        dz += (midAvgZ - selfZ) * 0.06;
      }
      if ((slotId === 'ld' || slotId === 'le') && ballThird === 'middle') {
        dx += atk * 0.6;
      }
    }

    if (phase === 'build_up') {
      if (slotId === 'zag1') dz -= 0.7;
      if (slotId === 'zag2') dz += 0.7;
      if (slotId === 'vol') dx -= atk * 0.5;
    }

    if (phase === 'transition_attack') {
      if (slotId === 'pd' || slotId === 'pe') dx += atk * 1.5;
      if (slotId === 'ld' || slotId === 'le') dx -= atk * 0.4;
    }
  }

  if (ballThird !== 'attacking') {
    return { dx, dz };
  }

  // Fullback overlaps when winger is ahead and ball is nearby
  if (slotId === 'ld' && posPd) {
    if (ahead(posPd.x) > 1.2 && Math.abs(posPd.z - ballZ) < 11) {
      dx += atk * 2.0;
      dz += ballZ < FIELD_WIDTH * 0.48 ? 0.8 : -0.7;
    }
  }
  if (slotId === 'pd' && posLd) {
    if (ahead(posLd.x) > 2.4) {
      dz += posLd.z > selfZ ? -1.6 : 1.6;
    }
  }

  // LE + PE mirror
  if (slotId === 'le' && posPe) {
    if (ahead(posPe.x) > 1.2 && Math.abs(posPe.z - ballZ) < 11) {
      dx += atk * 2.0;
      dz += ballZ > FIELD_WIDTH * 0.52 ? -0.8 : 0.7;
    }
  }
  if (slotId === 'pe' && posLe) {
    if (ahead(posLe.x) > 2.4) {
      dz += posLe.z < selfZ ? 1.6 : -1.6;
    }
  }

  // Interior half-space run when striker pins between centre-backs
  if ((slotId === 'mc1' || slotId === 'mc2') && posAta && posZag1 && posZag2) {
    const zMin = Math.min(posZag1.z, posZag2.z);
    const zMax = Math.max(posZag1.z, posZag2.z);
    const ataBetweenZags = posAta.z > zMin - 1.5 && posAta.z < zMax + 1.5;
    if (ataBetweenZags && ahead(posAta.x) > -2) {
      const towardRightHalf = posAta.z < FIELD_WIDTH / 2;
      dz += towardRightHalf ? 2.1 : -2.1;
      dx += atk * 0.9;
    }
  }

  // Striker depth when channel exists (CBs narrow)
  if (slotId === 'ata' && posZag1 && posZag2) {
    const gapZ = Math.abs(posZag1.z - posZag2.z);
    if (gapZ < 12 && ahead(selfX) < ahead(ballX) + 4) {
      dx += atk * 2.0;
    }
  }

  // Striker drops toward ball when both CBs are tight (link play)
  if (slotId === 'ata' && posZag1 && posZag2 && posMc1) {
    const gapZ = Math.abs(posZag1.z - posZag2.z);
    if (gapZ >= 12 && ahead(posMc1.x) < -1.5) {
      dx -= atk * 1.2;
    }
  }

  // Final-third phase-aware movements (only when ballThird === 'attacking')
  if (phase === 'final_third') {
    const ballOnWing = Math.abs(ballZ - FIELD_WIDTH / 2) > FIELD_WIDTH * 0.22;
    if (ballOnWing) {
      if (slotId === 'mc1' || slotId === 'mc2') {
        const farSideZ = ballZ < FIELD_WIDTH / 2 ? FIELD_WIDTH * 0.65 : FIELD_WIDTH * 0.35;
        dz += (farSideZ - selfZ) * 0.12;
        dx += atk * 1.0;
      }
      if (slotId === 'ata') {
        const nearPostZ = ballZ < FIELD_WIDTH / 2 ? FIELD_WIDTH * 0.38 : FIELD_WIDTH * 0.62;
        dz += (nearPostZ - selfZ) * 0.1;
        dx += atk * 0.8;
      }
    }
  }

  return { dx, dz };
}

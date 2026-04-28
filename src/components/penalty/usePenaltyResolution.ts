import {
  GOAL,
  POST_TOLERANCE,
  POWER_SWEET_HIGH,
  POWER_SWEET_LOW,
  slotCol,
  slotRect,
} from './constants';
import type {
  PenaltyKeeper,
  PenaltyOutcome,
  PenaltyShootResult,
  PenaltyShooter,
  SlotIndex,
} from './types';

/**
 * Decide para qual slot o goleiro vai mergulhar.
 * Sprint P1 mantém random com leve bias por tendency. Sprint P2 vai usar
 * readingRating + positioningRating pra "ler" o batedor de verdade.
 */
export function chooseKeeperSlot(keeper: PenaltyKeeper, _shooterSlot: SlotIndex): SlotIndex {
  const r = Math.random();

  if (keeper.tendency === 'left' && r < 0.45) {
    // Goleiro com tendência ao lado esquerdo: vai mais pra cols 0
    const rows = [0, 3, 6] as const;
    return rows[Math.floor(Math.random() * 3)] as SlotIndex;
  }
  if (keeper.tendency === 'right' && r < 0.45) {
    const rows = [2, 5, 8] as const;
    return rows[Math.floor(Math.random() * 3)] as SlotIndex;
  }
  if (keeper.tendency === 'center' && r < 0.45) {
    const rows = [1, 4, 7] as const;
    return rows[Math.floor(Math.random() * 3)] as SlotIndex;
  }

  return Math.floor(Math.random() * 9) as SlotIndex;
}

export interface ResolvePenaltyInput {
  slot: SlotIndex;
  power: number; // 0..1
  shooter: PenaltyShooter;
  keeper: PenaltyKeeper;
  /**
   * Permite injetar a escolha do goleiro (caller pode usar IA mais sofisticada).
   * Se omitido, usa `chooseKeeperSlot()`.
   */
  keeperSlot?: SlotIndex;
}

/**
 * Decide outcome + posição final coerente da bola para um pênalti.
 *
 * Ordem de resolução:
 *   1. Chute fraco (power < 32%) → weak-save (goleiro vai pro mesmo lado)
 *   2. Pancada (power > 88%) → wide pela lateral OU over-bar (depende do slot)
 *   3. Drift cai na trave → post (snap visual)
 *   4. Drift mandou pra fora → wide
 *   5. Goleiro acertou slot → save
 *   6. Resto → goal
 */
export function resolvePenalty(input: ResolvePenaltyInput): PenaltyShootResult {
  const { slot, power, shooter, keeper } = input;
  const keeperSlot = input.keeperSlot ?? chooseKeeperSlot(keeper, slot);

  // Rotação final aleatória (consistente com a força)
  const finalRotation = (540 + power * 540 + Math.random() * 360) % 360;

  const target = slotRect(slot);
  const col = slotCol(slot);

  // ── 1. CHUTE FRACO ──
  if (power < POWER_SWEET_LOW) {
    return {
      outcome: 'weak-save',
      pickedSlot: slot,
      keeperSlot: slot, // goleiro vai pro mesmo lado da bola
      power,
      landing: { x: target.cx, y: target.cy },
      finalRotation,
    };
  }

  // Drift baseado em finalização + força
  const finishingFactor = 1 - shooter.finishingRating / 100;
  const powerWobble = power > POWER_SWEET_HIGH ? 0.9 : 0.25;
  const driftMag = (finishingFactor + powerWobble) * 28;
  const driftX = (Math.random() - 0.5) * 2 * driftMag;
  const driftY = (Math.random() - 0.5) * 2 * driftMag;

  let finalX = target.cx + driftX;
  let finalY = target.cy + driftY;

  // ── 2. PANCADA (>88%) — perde controle direcional ──
  if (power > POWER_SWEET_HIGH) {
    if (col === 0) {
      // Sai pela lateral esquerda
      return {
        outcome: 'wide',
        pickedSlot: slot,
        keeperSlot,
        power,
        landing: {
          x: GOAL.x - 40 - Math.random() * 50,
          y: target.cy + (Math.random() - 0.5) * 40,
        },
        finalRotation,
      };
    }
    if (col === 2) {
      // Sai pela lateral direita
      return {
        outcome: 'wide',
        pickedSlot: slot,
        keeperSlot,
        power,
        landing: {
          x: GOAL.x + GOAL.w + 40 + Math.random() * 50,
          y: target.cy + (Math.random() - 0.5) * 40,
        },
        finalRotation,
      };
    }
    // Central → por cima do travessão
    return {
      outcome: 'over-bar',
      pickedSlot: slot,
      keeperSlot,
      power,
      landing: {
        x: target.cx + driftX * 0.4,
        y: GOAL.y - 50 - Math.random() * 30,
      },
      finalRotation,
    };
  }

  // ── 3. TRAVE ──
  const distLeft = Math.abs(finalX - GOAL.x);
  const distRight = Math.abs(finalX - (GOAL.x + GOAL.w));
  const distTop = Math.abs(finalY - GOAL.y);
  const insideVerticalRange = finalY >= GOAL.y - 4 && finalY <= GOAL.y + GOAL.h + 4;
  const insideHorizontalRange = finalX >= GOAL.x - 4 && finalX <= GOAL.x + GOAL.w + 4;

  const onLeftPost = distLeft < POST_TOLERANCE && insideVerticalRange;
  const onRightPost = distRight < POST_TOLERANCE && insideVerticalRange;
  const onCrossbar = distTop < POST_TOLERANCE && insideHorizontalRange;

  if (onLeftPost || onRightPost || onCrossbar) {
    if (onLeftPost) finalX = GOAL.x;
    else if (onRightPost) finalX = GOAL.x + GOAL.w;
    if (onCrossbar) finalY = GOAL.y;
    return {
      outcome: 'post',
      pickedSlot: slot,
      keeperSlot,
      power,
      landing: { x: finalX, y: finalY },
      finalRotation,
    };
  }

  // ── 4. PRA FORA ──
  const insideGoal =
    finalX > GOAL.x + 2 &&
    finalX < GOAL.x + GOAL.w - 2 &&
    finalY > GOAL.y + 2 &&
    finalY < GOAL.y + GOAL.h - 2;
  if (!insideGoal) {
    return {
      outcome: 'wide',
      pickedSlot: slot,
      keeperSlot,
      power,
      landing: { x: finalX, y: finalY },
      finalRotation,
    };
  }

  // ── 5. DEFESA / 6. GOL ──
  const outcome: PenaltyOutcome = slot === keeperSlot ? 'save' : 'goal';
  return {
    outcome,
    pickedSlot: slot,
    keeperSlot,
    power,
    landing: { x: finalX, y: finalY },
    finalRotation,
  };
}

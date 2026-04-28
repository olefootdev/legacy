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
 *
 * Modelo Sprint P2 (calibrado pra ser justo contra humano):
 *   - Reading: chance de ler a COLUNA correta. Cap em ~50% mesmo pra Neuer.
 *   - Positioning: dado coluna, chance de acertar a LINHA. Cap em ~45%.
 *   - Lucky escape: mesmo com slot exato, chute "no ângulo" tem 15% de chance
 *     de entrar (top-corner vibe — goleiro toca mas não segura).
 *
 * Taxas reais de defesa esperadas:
 *   GK 95/95 (elite): ~25% saves
 *   GK 80/80 (top):   ~18% saves
 *   GK 60/60 (médio): ~12% saves
 *   GK 40/40 (fraco): ~7%  saves
 *
 * Mais 15-25% de drift natural do batedor (trave/fora/over-bar/weak)
 * → taxa global de gol fica em ~60-75% — coerente com pênalti real.
 */
export function chooseKeeperSlot(keeper: PenaltyKeeper, shooterSlot: SlotIndex): SlotIndex {
  const SLOT_COLS = 3;
  const shooterCol = (shooterSlot % SLOT_COLS) as 0 | 1 | 2;
  const shooterRow = Math.floor(shooterSlot / SLOT_COLS) as 0 | 1 | 2;

  // ── 1. Reading: chance de ler a coluna ──
  // 100 → 50% | 70 → 38% | 50 → 30% | 30 → 22%
  const readingChance = 0.15 + (keeper.readingRating / 100) * 0.35;
  const readsCorrectly = Math.random() < readingChance;

  let chosenCol: 0 | 1 | 2;
  if (readsCorrectly) {
    chosenCol = shooterCol;
  } else {
    // Não leu: chuta numa coluna. Tendency tem efeito leve (50% chance), senão random.
    const tendBias = Math.random();
    if (keeper.tendency === 'left' && tendBias < 0.5) chosenCol = 0;
    else if (keeper.tendency === 'center' && tendBias < 0.5) chosenCol = 1;
    else if (keeper.tendency === 'right' && tendBias < 0.5) chosenCol = 2;
    else chosenCol = Math.floor(Math.random() * 3) as 0 | 1 | 2;
  }

  // ── 2. Positioning: dado coluna, acertar linha. Cap ~45% ──
  // 100 → 45% | 70 → 35% | 50 → 28% | 30 → 22%
  const positioningChance = 0.15 + (keeper.positioningRating / 100) * 0.3;
  const acertaLinha = readsCorrectly && Math.random() < positioningChance;

  let chosenRow: 0 | 1 | 2;
  if (acertaLinha) {
    chosenRow = shooterRow;
  } else {
    // Linha aleatória dentro da coluna (não bias adjacente — mais imprevisível)
    chosenRow = Math.floor(Math.random() * 3) as 0 | 1 | 2;
  }

  return (chosenRow * SLOT_COLS + chosenCol) as SlotIndex;
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
  // Lucky escape: chute na zona doce + slot de canto → 15% de chance de entrar
  // mesmo com goleiro no slot certo (ele toca mas não segura, "no ângulo")
  const slotIsCorner =
    slot === 0 || slot === 2 || slot === 6 || slot === 8;
  const inSweetZone = power >= POWER_SWEET_LOW && power <= POWER_SWEET_HIGH;
  const luckyEscape = slot === keeperSlot && slotIsCorner && inSweetZone && Math.random() < 0.15;

  const outcome: PenaltyOutcome =
    slot === keeperSlot && !luckyEscape ? 'save' : 'goal';
  return {
    outcome,
    pickedSlot: slot,
    keeperSlot,
    power,
    landing: { x: finalX, y: finalY },
    finalRotation,
  };
}

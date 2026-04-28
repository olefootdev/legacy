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
 * Modelo Sprint P2:
 *   1. **Reading roll**: probabilidade de "ler" o batedor = readingRating/100 ajustado.
 *      Se passa, GK escolhe a coluna correta (lado certo) com bias da tendency.
 *   2. **Positioning roll**: dado que leu a coluna, prob. de acertar a linha = positioningRating/100.
 *      Se passa: slot exato. Se falha: slot adjacente na mesma coluna.
 *   3. Se NÃO leu: GK chuta numa coluna baseada em tendency (ou random),
 *      linha aleatória.
 *
 * Resultado: goleiros "Manuel Neuer" (reading 90, positioning 88) acertam slot
 * exato ~60% das vezes. Goleiros "amador" (reading 50, positioning 50) caem
 * pra ~25%. A diferença vira ATIVO de gestão.
 */
export function chooseKeeperSlot(keeper: PenaltyKeeper, shooterSlot: SlotIndex): SlotIndex {
  const SLOT_COLS = 3;
  const shooterCol = (shooterSlot % SLOT_COLS) as 0 | 1 | 2;
  const shooterRow = Math.floor(shooterSlot / SLOT_COLS) as 0 | 1 | 2;

  // ── 1. Reading roll: chance de ler a coluna correta ──
  // readingRating 100 = ~85% lê | 50 = ~42% lê | 30 = ~25%
  const readingRoll = Math.random();
  const readingThreshold = 0.15 + (keeper.readingRating / 100) * 0.7;
  const readsCorrectly = readingRoll < readingThreshold;

  let chosenCol: 0 | 1 | 2;

  if (readsCorrectly) {
    chosenCol = shooterCol;
  } else {
    // Não leu: cai na tendência (se houver) ou aleatório
    if (keeper.tendency === 'left') chosenCol = 0;
    else if (keeper.tendency === 'center') chosenCol = 1;
    else if (keeper.tendency === 'right') chosenCol = 2;
    else chosenCol = Math.floor(Math.random() * 3) as 0 | 1 | 2;
  }

  // ── 2. Positioning roll: dado a coluna, acertar a linha ──
  // positioningRating 100 = ~80% acerta linha | 50 = ~40% | 30 = ~24%
  const positioningRoll = Math.random();
  const positioningThreshold = 0.1 + (keeper.positioningRating / 100) * 0.7;
  const acertaLinha = readsCorrectly && positioningRoll < positioningThreshold;

  let chosenRow: 0 | 1 | 2;
  if (acertaLinha) {
    chosenRow = shooterRow;
  } else {
    // Erra a linha: cai numa adjacente (se leu coluna) ou totalmente aleatória
    if (readsCorrectly) {
      // Leu coluna mas não a linha: ±1 da linha do batedor
      const drift = Math.random() < 0.5 ? -1 : 1;
      const r = shooterRow + drift;
      chosenRow = (r < 0 ? 1 : r > 2 ? 1 : r) as 0 | 1 | 2;
    } else {
      chosenRow = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    }
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

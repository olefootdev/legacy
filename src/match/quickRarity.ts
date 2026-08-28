/**
 * quickRarity — shim de compatibilidade.
 *
 * A "raridade estimada" deixou de ser exclusiva da Partida Rápida em 2026-08-26
 * e virou o detector de momento de TODO o jogo: `@/systems/moments/detectMoment`.
 * Liga Ole, Legends Cup e Liga Global passaram a usar a mesma matemática.
 *
 * Este arquivo continua existindo pra não mexer nos consumidores da Quick — a
 * conta é literalmente a mesma (com `competition: 'quick'` os multiplicadores
 * de contexto são neutros). Código novo deve importar de `@/systems/moments`.
 */

import {
  detectMoment,
  momentTierLabel,
  type Moment,
  type MomentInput,
  type MomentTier,
} from '@/systems/moments/detectMoment';

export type RarityTier = MomentTier;
export type QuickRarity = Moment;
export type QuickRarityInput = Omit<MomentInput, 'competition' | 'stage' | 'isTitle' | 'wentToPens'>;

export const rarityTierLabel = momentTierLabel;

export function computeQuickRarity(i: QuickRarityInput): QuickRarity {
  return detectMoment({ ...i, competition: 'quick' });
}

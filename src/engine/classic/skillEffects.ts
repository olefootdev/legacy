/**
 * Skill Effect Layer — habilidades visíveis dos arquétipos no modo CLASSIC.
 *
 * Cada arquétipo tem skills que podem ativar durante a decisão de jogada,
 * modificando pesos de passe/chute/cruzamento e gerando logs visíveis.
 */

import type { ClassicPlayer } from './types';
import type { ArchetypeId } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillBiasOverride {
  shotProb?: number;    // multiplicador de probabilidade de chute
  passWeight?: number;  // multiplicador de peso de passe progressivo
  crossWeight?: number; // multiplicador de peso de cruzamento
}

export interface SkillEffectResult {
  id: string;
  label: string;
  biasOverride: SkillBiasOverride;
}

interface SkillEffectDef {
  id: string;
  label: string;
  /** Condição extra para ativar (além do roll de probabilidade). */
  condition: (player: ClassicPlayer, intention: string, xG: number) => boolean;
  biasOverride: SkillBiasOverride;
}

// ─── Skill Definitions por Arquétipo ────────────────────────────────────────

const SKILL_DEFS: Partial<Record<ArchetypeId, SkillEffectDef[]>> = {
  MAESTRO: [
    {
      id: 'creative_passer',
      label: 'Creative Passer activated',
      condition: (_p, intention) => intention === 'progress' || intention === 'create_chance',
      biasOverride: { passWeight: 2.0 },
    },
  ],
  FINISHER: [
    {
      id: 'box_striker',
      label: 'Box Striker moved into high xG zone',
      condition: (_p, intention, xG) => (intention === 'attack_box' || intention === 'finish') && xG >= 0.15,
      biasOverride: { shotProb: 1.3 },
    },
  ],
  COLD_BLOOD: [
    {
      id: 'ice_finisher',
      label: 'Cold Blood — clinical finish',
      condition: (_p, intention, xG) => intention === 'finish' && xG >= 0.20,
      biasOverride: { shotProb: 1.4 },
    },
  ],
  WILD: [
    {
      id: 'long_shot',
      label: 'Long Shot attempted from edge',
      condition: (p, intention, xG) => intention === 'attack_box' && xG >= 0.08 && xG < 0.25,
      biasOverride: { shotProb: 1.5 },
    },
  ],
  HUNTER: [
    {
      id: 'defensive_reader',
      label: 'Defensive Reader blocked passing lane',
      condition: (_p, intention) => intention === 'build_up' || intention === 'progress',
      biasOverride: {}, // efeito é narrativo (interceptação no eventGenerator)
    },
  ],
  ENGINE: [
    {
      id: 'wide_progression',
      label: 'Engine created wide progression',
      condition: (p, intention) => {
        const role = p.role.toUpperCase();
        return (role === 'LB' || role === 'RB' || role === 'LW' || role === 'RW') &&
               (intention === 'progress' || intention === 'create_chance');
      },
      biasOverride: { crossWeight: 1.5 },
    },
  ],
  BOX_INVADER: [
    {
      id: 'target_man',
      label: 'Target Man positioned in box',
      condition: (_p, intention, xG) => (intention === 'attack_box' || intention === 'finish') && xG >= 0.12,
      biasOverride: { passWeight: 1.8, shotProb: 1.2 },
    },
  ],
  DESTROYER: [
    {
      id: 'shield_recovery',
      label: 'Destroyer recovered possession',
      condition: (_p, intention) => intention === 'build_up' || intention === 'reset_possession',
      biasOverride: { passWeight: 0.8 }, // prefere passe seguro
    },
  ],
  VETERAN: [
    {
      id: 'game_reader',
      label: 'Veteran read the game',
      condition: (_p, intention) => intention === 'progress' || intention === 'create_chance',
      biasOverride: { passWeight: 1.6 },
    },
  ],
};

// ─── Resolver ───────────────────────────────────────────────────────────────

/**
 * Tenta ativar uma skill do arquétipo do portador.
 * Retorna null se não ativou, ou o efeito se ativou.
 *
 * Trigger chance: (OVR / 100) * 0.4 → ~30-40% para OVR 75-99.
 * Cooldown implícito: como é por evento, não precisa de timer.
 */
export function resolveSkillEffect(
  player: ClassicPlayer,
  intention: string,
  xG: number,
): SkillEffectResult | null {
  const defs = SKILL_DEFS[player.archetype];
  if (!defs || defs.length === 0) return null;

  // Trigger chance baseada em OVR
  const triggerChance = (player.ovr / 100) * 0.4;
  if (Math.random() > triggerChance) return null;

  // Tenta cada skill do arquétipo (primeira que passa a condição)
  for (const def of defs) {
    if (def.condition(player, intention, xG)) {
      return {
        id: def.id,
        label: def.label,
        biasOverride: def.biasOverride,
      };
    }
  }

  return null;
}

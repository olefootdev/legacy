/**
 * Catálogo de Coach Skills — instâncias concretas validadas.
 *
 * Cada skill segue o schema PlaybookV1 (src/skills/playbookV1.ts).
 * Validação: npm run test:skill-engine
 *
 * Este catálogo complementa o seedCatalog.ts (skills genéricas).
 * Ambos são mergeados no runtime para formar o catálogo completo.
 */

import type { CoachSkill } from './playbookV1';

export const SKILL_CATALOG: readonly CoachSkill[] = [
  {
    schema: 'playbook_v1',
    id: 'skl_lateral_overlap_cross',
    name: 'Sobreposição Ofensiva',
    role: 'lateral',
    tier: 'generica',
    philosophy: 'Avança até próximo do escanteio e cruza na área com precisão',
    level: 1,
    attrRequirements: {
      velocidade: 70,
      passe: 65,
      fisico: 60,
    },
    behaviors: [
      {
        id: 'bh_overlap_trigger',
        name: 'Detectar oportunidade de sobreposição',
        when: 'team_has_ball AND zone IN [mid_attack, final_third] AND no_press_nearby AND winger_has_ball',
        bias: {
          overlap_intent: 0.25,
          forward_run_urgency: 0.20,
        },
        cooldownSec: 15,
      },
      {
        id: 'bh_advance_to_byline',
        name: 'Avançar até linha de fundo',
        when: 'carrier_is_me AND zone IN [final_third, wide_channel] AND space_ahead',
        bias: {
          sprint_intensity: 0.30,
          dribble_forward: 0.25,
          hold_width: 0.20,
        },
        cooldownSec: 8,
      },
      {
        id: 'bh_cross_from_byline',
        name: 'Cruzamento da linha de fundo',
        when: 'carrier_is_me AND zone = wide_channel AND x_pos > 85 AND teammates_in_box >= 2',
        bias: {
          cross_accuracy: 0.30,
          cross_power: 0.20,
          target_far_post: 0.15,
        },
        cooldownSec: 12,
        teammateEffect: {
          scope: 'atacante',
          radius: 20,
          bias: {
            attack_box_positioning: 0.20,
            header_anticipation: 0.15,
          },
        },
      },
      {
        id: 'bh_recovery_run',
        name: 'Retorno defensivo após cruzamento',
        when: 'NOT team_has_ball AND zone IN [final_third, mid_attack] AND opp_counter_threat',
        bias: {
          sprint_back_urgency: 0.25,
          track_runner: 0.20,
        },
        cooldownSec: 10,
      },
    ],
    unlock: {
      minCareerTier: 2,
      priceExp: 500,
      priceBroCents: 0,
    },
    presentation: {
      badgeColor: '#10b981',
      iconKey: 'arrow-right-circle',
      heroImageUrl: '/skills/lateral-overlap.jpg',
    },
    research: {
      seeds: [
        'Dani Alves overlap runs',
        'Trent Alexander-Arnold crossing technique',
        'Cafu attacking fullback positioning',
        'Marcelo offensive contribution',
      ],
    },
  },
] as const;

export function getSkillById(id: string): CoachSkill | undefined {
  return SKILL_CATALOG.find((s) => s.id === id);
}

export function getSkillsByRole(role: CoachSkill['role']): readonly CoachSkill[] {
  return SKILL_CATALOG.filter((s) => s.role === role);
}

export function getSkillsByTier(tier: CoachSkill['tier']): readonly CoachSkill[] {
  return SKILL_CATALOG.filter((s) => s.tier === tier);
}

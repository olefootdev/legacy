/**
 * SkillRegistry — Catálogo de skills offline para agentes
 *
 * Skills são comportamentos equipáveis que modificam decisões durante a partida.
 * Cada skill tem:
 * - when: condição para ativar
 * - score: peso adicional (0-1)
 * - bias: modificadores de ação
 * - cooldown: tempo de recarga
 */

import type { SkillDefinition, AgentDecisionContext } from './types';

/** Helper para acessar propriedades opcionais do contexto */
function getFieldZone(ctx: AgentDecisionContext): string | undefined {
  return (ctx as any).fieldZone;
}

function getPressure(ctx: AgentDecisionContext): any {
  return (ctx as any).pressure;
}

function getCollectivePhase(ctx: AgentDecisionContext): string | undefined {
  return ctx.collective?.phase;
}

function getDistToGoal(ctx: AgentDecisionContext): number | undefined {
  return (ctx as any).distToGoal;
}

/** Catálogo de skills disponíveis */
export const SKILL_REGISTRY: Record<string, SkillDefinition> = {
  // ─────────────────────────────────────────────────────────────
  // SPATIAL AWARENESS
  // ─────────────────────────────────────────────────────────────
  skl_spatial_awareness: {
    id: 'skl_spatial_awareness',
    name: 'Consciência Espacial',
    description: 'Melhor leitura de espaços e posicionamento',
    category: 'spatial',
    positions: ['*'], // Todas
    when: () => true, // Sempre ativa
    score: (ctx) => {
      // Bônus em zonas de criação
      const zone = getFieldZone(ctx);
      if (zone === 'mid_third' || zone === 'att_third') {
        return 0.08;
      }
      return 0.05;
    },
    bias: {
      pass_progressive: +0.08,
      carry: +0.05,
    },
    cooldown: 0,
  },

  skl_scan_before_receive: {
    id: 'skl_scan_before_receive',
    name: 'Scan Antes de Receber',
    description: 'Olha ao redor antes de receber a bola',
    category: 'spatial',
    positions: ['VOL', 'MC', 'LE', 'LD', 'ZAG'],
    when: (ctx) => ctx.isReceiver === true,
    score: (ctx) => {
      // Maior bônus sob pressão
      const pressure = getPressure(ctx);
      if (pressure && pressure.intensity === 'high') return 0.15;
      if (pressure && pressure.intensity === 'extreme') return 0.20;
      return 0.10;
    },
    bias: {
      pass_safe: +0.10,
      pass_progressive: +0.12,
      clearance: -0.08,
    },
    cooldown: 0,
  },

  // ─────────────────────────────────────────────────────────────
  // TEAM SUPPORT
  // ─────────────────────────────────────────────────────────────
  skl_team_support: {
    id: 'skl_team_support',
    name: 'Suporte ao Time',
    description: 'Oferece opções de passe constantemente',
    category: 'team',
    positions: ['MC', 'VOL', 'LE', 'LD'],
    when: (ctx) => !ctx.isCarrier,
    score: (ctx) => {
      // Bônus quando time está construindo
      const phase = getCollectivePhase(ctx);
      if (phase === 'buildup') return 0.12;
      return 0.08;
    },
    bias: {
      off_ball_support: +0.15,
    },
    cooldown: 0,
  },

  skl_overlap_run: {
    id: 'skl_overlap_run',
    name: 'Corrida de Sobreposição',
    description: 'Corre por fora para receber em profundidade',
    category: 'team',
    positions: ['LE', 'LD', 'PE', 'PD'],
    when: (ctx) => {
      const zone = getFieldZone(ctx);
      const phase = getCollectivePhase(ctx);
      return (
        !ctx.isCarrier &&
        zone === 'att_third' &&
        phase === 'attack'
      );
    },
    score: (ctx) => 0.18,
    bias: {
      off_ball_attack_space: +0.20,
    },
    cooldown: 15,
  },

  // ─────────────────────────────────────────────────────────────
  // INDIVIDUAL DECISION
  // ─────────────────────────────────────────────────────────────
  skl_safe_pass_under_pressure: {
    id: 'skl_safe_pass_under_pressure',
    name: 'Passe Seguro Sob Pressão',
    description: 'Prioriza passes seguros quando pressionado',
    category: 'individual',
    positions: ['*'],
    when: (ctx) => {
      const pressure = getPressure(ctx);
      return (
        ctx.isCarrier &&
        pressure &&
        (pressure.intensity === 'high' || pressure.intensity === 'extreme')
      );
    },
    score: (ctx) => {
      const pressure = getPressure(ctx);
      if (pressure?.intensity === 'extreme') return 0.25;
      return 0.18;
    },
    bias: {
      pass_safe: +0.25,
      pass_progressive: -0.10,
      carry: -0.15,
      shoot: -0.20,
    },
    cooldown: 0,
  },

  skl_progressive_pass: {
    id: 'skl_progressive_pass',
    name: 'Passe Progressivo',
    description: 'Busca passes que avançam o jogo',
    category: 'individual',
    positions: ['MC', 'VOL', 'LE', 'LD', 'ZAG'],
    when: (ctx) => {
      const zone = getFieldZone(ctx);
      const pressure = getPressure(ctx);
      return (
        ctx.isCarrier &&
        zone !== 'opp_box' &&
        (!pressure || pressure.intensity === 'none')
      );
    },
    score: (ctx) => 0.15,
    bias: {
      pass_progressive: +0.20,
      pass_safe: -0.08,
    },
    cooldown: 0,
  },

  // ─────────────────────────────────────────────────────────────
  // DEFENSIVE
  // ─────────────────────────────────────────────────────────────
  skl_defensive_recovery: {
    id: 'skl_defensive_recovery',
    name: 'Recomposição Defensiva',
    description: 'Volta rápido para posição defensiva',
    category: 'team',
    positions: ['ZAG', 'LE', 'LD', 'VOL'],
    when: (ctx) => {
      const zone = getFieldZone(ctx);
      const phase = getCollectivePhase(ctx);
      return (
        !ctx.isCarrier &&
        phase === 'defend' &&
        zone !== 'att_third'
      );
    },
    score: (ctx) => 0.15,
    bias: {
      off_ball_hold_position: +0.18,
      off_ball_press: -0.10,
    },
    cooldown: 0,
  },

  skl_hold_position: {
    id: 'skl_hold_position',
    name: 'Manter Posição',
    description: 'Mantém disciplina tática e não sai da posição',
    category: 'team',
    positions: ['ZAG', 'VOL', 'GOL'],
    when: (ctx) => !ctx.isCarrier,
    score: (ctx) => 0.10,
    bias: {
      off_ball_hold_position: +0.20,
      off_ball_attack_space: -0.15,
    },
    cooldown: 0,
  },

  // ─────────────────────────────────────────────────────────────
  // ATTACKING
  // ─────────────────────────────────────────────────────────────
  skl_attack_space: {
    id: 'skl_attack_space',
    name: 'Atacar Espaço',
    description: 'Corre para espaços vazios no ataque',
    category: 'individual',
    positions: ['ATA', 'CA', 'PE', 'PD'],
    when: (ctx) => {
      const zone = getFieldZone(ctx);
      const phase = getCollectivePhase(ctx);
      return (
        !ctx.isCarrier &&
        (zone === 'att_third' || zone === 'opp_box') &&
        phase === 'attack'
      );
    },
    score: (ctx) => 0.20,
    bias: {
      off_ball_attack_space: +0.25,
    },
    cooldown: 10,
  },

  skl_shoot_window: {
    id: 'skl_shoot_window',
    name: 'Janela de Chute',
    description: 'Identifica momentos ideais para finalizar',
    category: 'individual',
    positions: ['ATA', 'CA', 'PE', 'PD', 'MC'],
    when: (ctx) => {
      const zone = getFieldZone(ctx);
      const dist = getDistToGoal(ctx);
      return (
        ctx.isCarrier &&
        (zone === 'opp_box' || zone === 'att_third') &&
        dist !== undefined &&
        dist < 25
      );
    },
    score: (ctx) => {
      const dist = getDistToGoal(ctx);
      if (dist && dist < 18) return 0.25;
      return 0.18;
    },
    bias: {
      shoot: +0.22,
      pass_safe: -0.10,
    },
    cooldown: 8,
  },

  skl_selfish_finish_bias: {
    id: 'skl_selfish_finish_bias',
    name: 'Instinto Finalizador',
    description: 'Prioriza finalização mesmo com companheiros livres',
    category: 'critical',
    positions: ['ATA', 'CA', 'PE', 'PD'],
    when: (ctx) => {
      const zone = getFieldZone(ctx);
      const dist = getDistToGoal(ctx);
      return (
        ctx.isCarrier &&
        zone === 'opp_box' &&
        dist !== undefined &&
        dist < 20
      );
    },
    score: (ctx) => 0.20,
    bias: {
      shoot: +0.30,
      pass_progressive: -0.15,
      pass_safe: -0.20,
    },
    cooldown: 12,
  },

  // ─────────────────────────────────────────────────────────────
  // CRITICAL MOMENTS
  // ─────────────────────────────────────────────────────────────
  skl_critical_composure: {
    id: 'skl_critical_composure',
    name: 'Compostura Crítica',
    description: 'Mantém calma em momentos decisivos',
    category: 'critical',
    positions: ['*'],
    when: (ctx) => {
      // Ativa em momentos críticos: placar apertado, final de jogo, área
      const zone = getFieldZone(ctx);
      const isCritical =
        zone === 'opp_box' ||
        (ctx.minute && ctx.minute > 80);
      return ctx.isCarrier && isCritical;
    },
    score: (ctx) => {
      if (ctx.minute && ctx.minute > 85) return 0.25;
      return 0.18;
    },
    bias: {
      pass_safe: +0.10,
      shoot: +0.12,
      clearance: -0.15,
    },
    cooldown: 0,
  },

  // ─────────────────────────────────────────────────────────────
  // GOALKEEPER
  // ─────────────────────────────────────────────────────────────
  skl_gk_positioning: {
    id: 'skl_gk_positioning',
    name: 'Posicionamento de Goleiro',
    description: 'Posicionamento ideal para defesas',
    category: 'spatial',
    positions: ['GOL'],
    when: (ctx) => !ctx.isCarrier,
    score: () => 0.15,
    bias: {
      off_ball_hold_position: +0.25,
    },
    cooldown: 0,
  },
};

/**
 * Busca skills por IDs
 */
export function getSkillsByIds(ids: string[]): SkillDefinition[] {
  return ids.map((id) => SKILL_REGISTRY[id]).filter(Boolean);
}

/**
 * Busca skills por posição
 */
export function getSkillsByPosition(position: string): SkillDefinition[] {
  return Object.values(SKILL_REGISTRY).filter((skill) => {
    return skill.positions.includes('*') || skill.positions.includes(position);
  });
}

/**
 * Busca skills por categoria
 */
export function getSkillsByCategory(
  category: SkillDefinition['category'],
): SkillDefinition[] {
  return Object.values(SKILL_REGISTRY).filter(
    (skill) => skill.category === category,
  );
}

/**
 * Valida se skill pode ser equipada em jogador
 */
export function canEquipSkill(
  skill: SkillDefinition,
  position: string,
): boolean {
  return skill.positions.includes('*') || skill.positions.includes(position);
}

/**
 * Lista todas as skills disponíveis
 */
export function getAllSkills(): SkillDefinition[] {
  return Object.values(SKILL_REGISTRY);
}

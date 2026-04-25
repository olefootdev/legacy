/**
 * Seed inicial do catálogo de Coach Skills (Fase 1 do PlaybookV1).
 *
 * 3 Camada 1 (genéricas, free) + 3 Camada 2 (compráveis ou por conquista).
 * Exportado como const tipado — fonte única para:
 *   - bundling no build (offline-first)
 *   - migration SQL inicial (insert into coach_skills_catalog)
 *   - testes
 *
 * Conteúdo derivado de docs/COACH_SKILLS_PLAYBOOK_V1.md §284-460.
 */

import type { CoachSkill } from '@/skills/playbookV1';

// ── Camada 1: Genéricas (free, behaviors curtos) ────────────────────

const skl_goleiro_padrao: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_goleiro_padrao',
  name: 'Goleiro Padrão',
  role: 'goleiro',
  tier: 'generica',
  philosophy: 'Defesa segura + distribuição básica.',
  level: 1,
  behaviors: [
    {
      id: 'bh_passe_curto_seguro',
      name: 'Passe curto pro zagueiro mais próximo',
      when: 'team_has_ball && carrier_is_me && no_press_nearby',
      bias: { passShortToDefender: 0.20, clearBall: -0.10 },
    },
    {
      id: 'bh_chutao_sob_pressao',
      name: 'Afastar quando pressionado',
      when: 'team_has_ball && carrier_is_me && opp_press_nearby',
      bias: { clearBall: 0.25, passShortToDefender: -0.15 },
    },
  ],
  unlock: { minCareerTier: 1 },
};

const skl_atacante_padrao: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_atacante_padrao',
  name: 'Atacante Padrão',
  role: 'atacante',
  tier: 'generica',
  philosophy: 'Chute na área, recupera no rival quando perde.',
  level: 1,
  behaviors: [
    {
      id: 'bh_chute_na_area',
      name: 'Finaliza ao receber dentro da área',
      when: 'carrier_is_me && isBox(zone)',
      bias: { shotPlaced: 0.22, passShortBack: -0.12 },
    },
    {
      id: 'bh_pressao_imediata',
      name: 'Pressiona o zagueiro adversário ao perder a bola',
      when: '!team_has_ball && my_zone == "att"',
      bias: { pressNearestOpp: 0.18, dropBack: -0.10 },
    },
  ],
  unlock: { minCareerTier: 1 },
};

const skl_meia_padrao: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_meia_padrao',
  name: 'Meia Padrão',
  role: 'meia',
  tier: 'generica',
  philosophy: 'Passe pra frente quando livre, recompõe quando precisa.',
  level: 1,
  behaviors: [
    {
      id: 'bh_passe_progressivo',
      name: 'Passe vertical para o ataque quando livre',
      when: 'carrier_is_me && no_press_nearby && team_has_ball',
      bias: { passProgressive: 0.20, passShortBack: -0.10 },
    },
    {
      id: 'bh_recompoe_meio',
      name: 'Volta ao meio sem bola',
      when: '!team_has_ball && my_zone == "mid"',
      bias: { recoverMid: 0.15, holdLine: -0.08 },
    },
  ],
  unlock: { minCareerTier: 1 },
};

// ── Camada 2: Históricas (compráveis) ───────────────────────────────

const skl_escola_taffarel: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_escola_taffarel',
  name: 'Escola Taffarel',
  role: 'goleiro',
  tier: 'historica',
  philosophy: 'Defesa segura, reflexo elite e comando de linha defensiva.',
  level: 3,
  attrRequirements: { mentalidade: 70 },
  behaviors: [
    {
      id: 'bh_saida_curta',
      name: 'Saída curta pro zagueiro',
      when: 'team_has_ball && carrier_is_me && no_press_nearby',
      bias: { passShortToDefender: 0.30, clearBall: -0.18 },
    },
    {
      id: 'bh_antecipar_cruzamento',
      name: 'Sair pra cortar cruzamento',
      when: 'opp_crossing && ball_in_my_box_zone',
      bias: { cornerCatch: 0.28, stayOnLine: -0.15 },
      cooldownSec: 30,
    },
    {
      id: 'bh_defender_1v1',
      name: 'Fechar ângulo em 1v1',
      when: 'opp_through_ball && attacker_isolated',
      bias: { advanceToCloseAngle: 0.30, diveEarly: -0.22 },
    },
    {
      id: 'bh_reflexo_rebote',
      name: 'Espalmar pro lado em rebote',
      when: 'shot_incoming && shot_power == "power"',
      bias: { parryToSide: 0.28, holdRisk: -0.18 },
    },
    {
      id: 'bh_comando_linha',
      name: 'Organiza linha de defesa',
      when: 'zone == "def" && team_defending',
      bias: { organizeLine: 0.18 },
      teammateEffect: {
        scope: 'zagueiro',
        radius: 22,
        bias: { holdLine: 0.10, trackRunner: 0.08 },
      },
    },
  ],
  unlock: {
    minCareerTier: 2,
    priceExp: 120000,
    priceBroCents: 999,
  },
  research: {
    seeds: ['Cláudio Taffarel Copa 94 Brasil', 'Liverpool Alisson saída curta'],
  },
};

const skl_ferrolho_italiano: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_ferrolho_italiano',
  name: 'Ferrolho Italiano',
  role: 'zagueiro',
  tier: 'historica',
  philosophy: 'Antecipação + leitura + falta calculada quando necessário.',
  level: 3,
  attrRequirements: { marcacao: 75, mentalidade: 70 },
  behaviors: [
    {
      id: 'bh_antecipar_passe',
      name: 'Roubar antes do atacante',
      when: 'opp_through_ball && my_distance_to_ball < 6',
      bias: { interceptionAttempt: 0.30, stayInLine: -0.15 },
    },
    {
      id: 'bh_falta_estrategica',
      name: 'Falta tática pra parar o contra-ataque',
      when: 'opp_counter && my_zone_depth < 0.4 && no_other_defender',
      bias: { tacticalFoul: 0.30, letRunGo: -0.25 },
    },
    {
      id: 'bh_marca_homem',
      name: 'Marcação individual no homem-gol',
      when: 'opp_in_box && opponent_is_top_scorer',
      bias: { manMark: 0.30, zonalMark: -0.20 },
    },
    {
      id: 'bh_lider_defesa',
      name: 'Sobe linha quando time tem posse',
      when: 'team_has_ball && my_zone == "def"',
      bias: { stepUpLine: 0.20 },
      teammateEffect: {
        scope: 'zagueiro',
        bias: { stepUpLine: 0.15 },
      },
    },
  ],
  unlock: {
    minCareerTier: 3,
    priceExp: 180000,
    priceBroCents: 1499,
  },
};

const skl_artilheiro_clutch: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_artilheiro_clutch',
  name: 'Artilheiro Clutch',
  role: 'atacante',
  tier: 'historica',
  philosophy: 'Sangue frio nos minutos finais. Decide o jogo.',
  level: 3,
  attrRequirements: { mentalidade: 80, finalizacao: 75 },
  behaviors: [
    {
      id: 'bh_chute_clutch',
      name: 'Finaliza com calma na pressão',
      when: 'minute > 75 && score_diff <= 1',
      bias: { shotPlaced: 0.30, shotPower: -0.15 },
    },
    {
      id: 'bh_busca_jogada',
      name: 'Pede a bola no minuto final',
      when: 'minute > 85 && team_has_ball',
      bias: { callForBall: 0.30, stayPositioned: -0.20 },
    },
    {
      id: 'bh_chute_panico_inverso',
      name: 'Não força em vantagem',
      when: 'score_diff > 1 && minute > 70',
      bias: { passSafe: 0.25, shotForce: -0.20 },
    },
  ],
  unlock: {
    minCareerTier: 3,
    requiredAchievementIds: ['clutch_goal_5x'],
  },
};

export const COACH_SKILLS_SEED: readonly CoachSkill[] = [
  skl_goleiro_padrao,
  skl_atacante_padrao,
  skl_meia_padrao,
  skl_escola_taffarel,
  skl_ferrolho_italiano,
  skl_artilheiro_clutch,
];

/** Lookup por id (usado no runtime + nos testes). */
export const COACH_SKILLS_BY_ID: Readonly<Record<string, CoachSkill>> = Object.freeze(
  Object.fromEntries(COACH_SKILLS_SEED.map((s) => [s.id, s])),
);

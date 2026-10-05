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
import { L } from '@/i18n/L';

// ── Camada 1: Genéricas (free, behaviors curtos) ────────────────────

const skl_goleiro_padrao: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_goleiro_padrao',
  name: L('Goleiro Padrão', 'Standard Goalkeeper'),
  role: 'goleiro',
  tier: 'generica',
  philosophy: L('Defesa segura + distribuição básica.', 'Safe saves + basic distribution.'),
  level: 1,
  behaviors: [
    {
      id: 'bh_passe_curto_seguro',
      name: L('Passe curto pro zagueiro mais próximo', 'Short pass to the nearest centre-back'),
      when: 'team_has_ball && carrier_is_me && no_press_nearby',
      bias: { passShortToDefender: 0.20, clearBall: -0.10 },
    },
    {
      id: 'bh_chutao_sob_pressao',
      name: L('Afastar quando pressionado', 'Clear it when pressed'),
      when: 'team_has_ball && carrier_is_me && opp_press_nearby',
      bias: { clearBall: 0.25, passShortToDefender: -0.15 },
    },
  ],
  unlock: { minCareerTier: 1 },
};

const skl_atacante_padrao: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_atacante_padrao',
  name: L('Atacante Padrão', 'Standard Striker'),
  role: 'atacante',
  tier: 'generica',
  philosophy: L('Chute na área, recupera no rival quando perde.', 'Shoots in the box, presses to win it back when lost.'),
  level: 1,
  behaviors: [
    {
      id: 'bh_chute_na_area',
      name: L('Finaliza ao receber dentro da área', 'Shoots on receiving inside the box'),
      when: 'carrier_is_me && isBox(zone)',
      bias: { shotPlaced: 0.22, passShortBack: -0.12 },
    },
    {
      id: 'bh_pressao_imediata',
      name: L('Pressiona o zagueiro adversário ao perder a bola', 'Presses the opposing centre-back after losing the ball'),
      when: '!team_has_ball && my_zone == "att"',
      bias: { pressNearestOpp: 0.18, dropBack: -0.10 },
    },
  ],
  unlock: { minCareerTier: 1 },
};

const skl_meia_padrao: CoachSkill = {
  schema: 'playbook_v1',
  id: 'skl_meia_padrao',
  name: L('Meia Padrão', 'Standard Midfielder'),
  role: 'meia',
  tier: 'generica',
  philosophy: L('Passe pra frente quando livre, recompõe quando precisa.', 'Passes forward when free, tracks back when needed.'),
  level: 1,
  behaviors: [
    {
      id: 'bh_passe_progressivo',
      name: L('Passe vertical para o ataque quando livre', 'Vertical pass to the attack when free'),
      when: 'carrier_is_me && no_press_nearby && team_has_ball',
      bias: { passProgressive: 0.20, passShortBack: -0.10 },
    },
    {
      id: 'bh_recompoe_meio',
      name: L('Volta ao meio sem bola', 'Drops back to midfield off the ball'),
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
  name: L('Escola Taffarel', 'Taffarel School'),
  role: 'goleiro',
  tier: 'historica',
  philosophy: L('Defesa segura, reflexo elite e comando de linha defensiva.', 'Safe hands, elite reflexes and command of the back line.'),
  level: 3,
  attrRequirements: { mentalidade: 70 },
  behaviors: [
    {
      id: 'bh_saida_curta',
      name: L('Saída curta pro zagueiro', 'Short distribution to the centre-back'),
      when: 'team_has_ball && carrier_is_me && no_press_nearby',
      bias: { passShortToDefender: 0.30, clearBall: -0.18 },
    },
    {
      id: 'bh_antecipar_cruzamento',
      name: L('Sair pra cortar cruzamento', 'Come out to claim crosses'),
      when: 'opp_crossing && ball_in_my_box_zone',
      bias: { cornerCatch: 0.28, stayOnLine: -0.15 },
      cooldownSec: 30,
    },
    {
      id: 'bh_defender_1v1',
      name: L('Fechar ângulo em 1v1', 'Close the angle in a 1v1'),
      when: 'opp_through_ball && attacker_isolated',
      bias: { advanceToCloseAngle: 0.30, diveEarly: -0.22 },
    },
    {
      id: 'bh_reflexo_rebote',
      name: L('Espalmar pro lado em rebote', 'Parry wide on rebounds'),
      when: 'shot_incoming && shot_power == "power"',
      bias: { parryToSide: 0.28, holdRisk: -0.18 },
    },
    {
      id: 'bh_comando_linha',
      name: L('Organiza linha de defesa', 'Organises the back line'),
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
  name: L('Ferrolho Italiano', 'Italian Catenaccio'),
  role: 'zagueiro',
  tier: 'historica',
  philosophy: L('Antecipação + leitura + falta calculada quando necessário.', 'Anticipation + reading + a calculated foul when needed.'),
  level: 3,
  attrRequirements: { marcacao: 75, mentalidade: 70 },
  behaviors: [
    {
      id: 'bh_antecipar_passe',
      name: L('Roubar antes do atacante', 'Win it before the striker'),
      when: 'opp_through_ball && my_distance_to_ball < 6',
      bias: { interceptionAttempt: 0.30, stayInLine: -0.15 },
    },
    {
      id: 'bh_falta_estrategica',
      name: L('Falta tática pra parar o contra-ataque', 'Tactical foul to stop the counter'),
      when: 'opp_counter && my_zone_depth < 0.4 && no_other_defender',
      bias: { tacticalFoul: 0.30, letRunGo: -0.25 },
    },
    {
      id: 'bh_marca_homem',
      name: L('Marcação individual no homem-gol', 'Man-mark the goal threat'),
      when: 'opp_in_box && opponent_is_top_scorer',
      bias: { manMark: 0.30, zonalMark: -0.20 },
    },
    {
      id: 'bh_lider_defesa',
      name: L('Sobe linha quando time tem posse', 'Push the line up when the team has the ball'),
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
  name: L('Artilheiro Clutch', 'Clutch Goalscorer'),
  role: 'atacante',
  tier: 'historica',
  philosophy: L('Sangue frio nos minutos finais. Decide o jogo.', 'Ice-cold in the final minutes. Decides the game.'),
  level: 3,
  attrRequirements: { mentalidade: 80, finalizacao: 75 },
  behaviors: [
    {
      id: 'bh_chute_clutch',
      name: L('Finaliza com calma na pressão', 'Finishes calmly under pressure'),
      when: 'minute > 75 && score_diff <= 1',
      bias: { shotPlaced: 0.30, shotPower: -0.15 },
    },
    {
      id: 'bh_busca_jogada',
      name: L('Pede a bola no minuto final', 'Demands the ball in the final minute'),
      when: 'minute > 85 && team_has_ball',
      bias: { callForBall: 0.30, stayPositioned: -0.20 },
    },
    {
      id: 'bh_chute_panico_inverso',
      name: L('Não força em vantagem', 'Doesn\'t force it when ahead'),
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

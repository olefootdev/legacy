/**
 * Templates de AgentProfile por posição
 *
 * Cada posição tem perfis base para:
 * - Conhecimento espacial
 * - Comportamento coletivo
 * - Comportamento individual
 * - Perfil de risco
 * - Perfil crítico
 * - Skills padrão
 */

import type { ProfileTemplate } from './types';

export const PROFILE_TEMPLATES: Record<string, ProfileTemplate> = {
  // ─────────────────────────────────────────────────────────────
  // GOLEIRO
  // ─────────────────────────────────────────────────────────────
  GOL: {
    position: 'GOL',
    role: 'gk',
    spatialProfile: {
      preferredZones: ['own_box', 'def_third'],
      spatialAwareness: 85,
      scanBeforeReceive: 90,
      runTiming: 40,
      defensivePositioning: 95,
    },
    teamProfile: {
      supportCarrier: 60,
      tacticalDiscipline: 90,
      teamCommunication: 85,
      defensiveCover: 95,
      collectiveMovement: 50,
    },
    individualProfile: {
      creativity: 50,
      decisionUnderPressure: 80,
      ballConfidence: 70,
      vision: 85,
      technicalExecution: 75,
    },
    riskProfile: {
      baseRisk: 20,
      riskUnderPressure: -15,
      riskWhenLosing: +5,
      riskWhenWinning: -10,
      dribbleVsPass: 10,
    },
    criticalProfile: {
      criticalComposure: 90,
      ego: 40,
      crowdPressureReaction: 85,
      selfishVsTeam: 10,
      finishingConfidence: 0,
    },
    defaultSkills: ['skl_gk_positioning', 'skl_safe_pass_under_pressure'],
  },

  // ─────────────────────────────────────────────────────────────
  // ZAGUEIROS
  // ─────────────────────────────────────────────────────────────
  ZAG: {
    position: 'ZAG',
    role: 'def',
    spatialProfile: {
      preferredZones: ['own_box', 'def_third'],
      spatialAwareness: 80,
      scanBeforeReceive: 75,
      runTiming: 50,
      defensivePositioning: 90,
    },
    teamProfile: {
      supportCarrier: 65,
      tacticalDiscipline: 85,
      teamCommunication: 80,
      defensiveCover: 90,
      collectiveMovement: 70,
    },
    individualProfile: {
      creativity: 40,
      decisionUnderPressure: 75,
      ballConfidence: 60,
      vision: 70,
      technicalExecution: 65,
    },
    riskProfile: {
      baseRisk: 25,
      riskUnderPressure: -20,
      riskWhenLosing: +10,
      riskWhenWinning: -15,
      dribbleVsPass: 15,
    },
    criticalProfile: {
      criticalComposure: 85,
      ego: 35,
      crowdPressureReaction: 75,
      selfishVsTeam: 15,
      finishingConfidence: 20,
    },
    defaultSkills: ['skl_defensive_recovery', 'skl_safe_pass_under_pressure', 'skl_hold_position'],
  },

  // ─────────────────────────────────────────────────────────────
  // LATERAIS
  // ─────────────────────────────────────────────────────────────
  LE: {
    position: 'LE',
    role: 'def',
    spatialProfile: {
      preferredZones: ['def_third', 'mid_third', 'att_third'],
      spatialAwareness: 75,
      scanBeforeReceive: 70,
      runTiming: 80,
      defensivePositioning: 75,
    },
    teamProfile: {
      supportCarrier: 80,
      tacticalDiscipline: 75,
      teamCommunication: 75,
      defensiveCover: 80,
      collectiveMovement: 85,
    },
    individualProfile: {
      creativity: 60,
      decisionUnderPressure: 70,
      ballConfidence: 65,
      vision: 75,
      technicalExecution: 70,
    },
    riskProfile: {
      baseRisk: 45,
      riskUnderPressure: -10,
      riskWhenLosing: +15,
      riskWhenWinning: +5,
      dribbleVsPass: 40,
    },
    criticalProfile: {
      criticalComposure: 70,
      ego: 50,
      crowdPressureReaction: 65,
      selfishVsTeam: 30,
      finishingConfidence: 40,
    },
    defaultSkills: ['skl_overlap_run', 'skl_progressive_pass', 'skl_defensive_recovery'],
  },

  LD: {
    position: 'LD',
    role: 'def',
    spatialProfile: {
      preferredZones: ['def_third', 'mid_third', 'att_third'],
      spatialAwareness: 75,
      scanBeforeReceive: 70,
      runTiming: 80,
      defensivePositioning: 75,
    },
    teamProfile: {
      supportCarrier: 80,
      tacticalDiscipline: 75,
      teamCommunication: 75,
      defensiveCover: 80,
      collectiveMovement: 85,
    },
    individualProfile: {
      creativity: 60,
      decisionUnderPressure: 70,
      ballConfidence: 65,
      vision: 75,
      technicalExecution: 70,
    },
    riskProfile: {
      baseRisk: 45,
      riskUnderPressure: -10,
      riskWhenLosing: +15,
      riskWhenWinning: +5,
      dribbleVsPass: 40,
    },
    criticalProfile: {
      criticalComposure: 70,
      ego: 50,
      crowdPressureReaction: 65,
      selfishVsTeam: 30,
      finishingConfidence: 40,
    },
    defaultSkills: ['skl_overlap_run', 'skl_progressive_pass', 'skl_defensive_recovery'],
  },

  // ─────────────────────────────────────────────────────────────
  // VOLANTES
  // ─────────────────────────────────────────────────────────────
  VOL: {
    position: 'VOL',
    role: 'mid',
    spatialProfile: {
      preferredZones: ['def_third', 'mid_third'],
      spatialAwareness: 85,
      scanBeforeReceive: 85,
      runTiming: 70,
      defensivePositioning: 85,
    },
    teamProfile: {
      supportCarrier: 75,
      tacticalDiscipline: 90,
      teamCommunication: 85,
      defensiveCover: 85,
      collectiveMovement: 80,
    },
    individualProfile: {
      creativity: 55,
      decisionUnderPressure: 80,
      ballConfidence: 70,
      vision: 85,
      technicalExecution: 75,
    },
    riskProfile: {
      baseRisk: 35,
      riskUnderPressure: -15,
      riskWhenLosing: +10,
      riskWhenWinning: -10,
      dribbleVsPass: 25,
    },
    criticalProfile: {
      criticalComposure: 80,
      ego: 45,
      crowdPressureReaction: 75,
      selfishVsTeam: 20,
      finishingConfidence: 35,
    },
    defaultSkills: ['skl_scan_before_receive', 'skl_safe_pass_under_pressure', 'skl_hold_position'],
  },

  // ─────────────────────────────────────────────────────────────
  // MEIAS
  // ─────────────────────────────────────────────────────────────
  MC: {
    position: 'MC',
    role: 'mid',
    spatialProfile: {
      preferredZones: ['mid_third', 'att_third'],
      spatialAwareness: 80,
      scanBeforeReceive: 85,
      runTiming: 75,
      defensivePositioning: 70,
    },
    teamProfile: {
      supportCarrier: 85,
      tacticalDiscipline: 80,
      teamCommunication: 85,
      defensiveCover: 70,
      collectiveMovement: 85,
    },
    individualProfile: {
      creativity: 75,
      decisionUnderPressure: 75,
      ballConfidence: 80,
      vision: 85,
      technicalExecution: 80,
    },
    riskProfile: {
      baseRisk: 50,
      riskUnderPressure: -5,
      riskWhenLosing: +15,
      riskWhenWinning: 0,
      dribbleVsPass: 35,
    },
    criticalProfile: {
      criticalComposure: 75,
      ego: 55,
      crowdPressureReaction: 70,
      selfishVsTeam: 35,
      finishingConfidence: 50,
    },
    defaultSkills: ['skl_scan_before_receive', 'skl_progressive_pass', 'skl_team_support'],
  },

  // ─────────────────────────────────────────────────────────────
  // PONTAS
  // ─────────────────────────────────────────────────────────────
  PE: {
    position: 'PE',
    role: 'attack',
    spatialProfile: {
      preferredZones: ['mid_third', 'att_third', 'opp_box'],
      spatialAwareness: 75,
      scanBeforeReceive: 70,
      runTiming: 85,
      defensivePositioning: 50,
    },
    teamProfile: {
      supportCarrier: 70,
      tacticalDiscipline: 65,
      teamCommunication: 70,
      defensiveCover: 55,
      collectiveMovement: 75,
    },
    individualProfile: {
      creativity: 85,
      decisionUnderPressure: 70,
      ballConfidence: 85,
      vision: 75,
      technicalExecution: 85,
    },
    riskProfile: {
      baseRisk: 70,
      riskUnderPressure: +5,
      riskWhenLosing: +20,
      riskWhenWinning: -5,
      dribbleVsPass: 70,
    },
    criticalProfile: {
      criticalComposure: 65,
      ego: 75,
      crowdPressureReaction: 60,
      selfishVsTeam: 60,
      finishingConfidence: 75,
    },
    defaultSkills: ['skl_attack_space', 'skl_shoot_window', 'skl_selfish_finish_bias'],
  },

  PD: {
    position: 'PD',
    role: 'attack',
    spatialProfile: {
      preferredZones: ['mid_third', 'att_third', 'opp_box'],
      spatialAwareness: 75,
      scanBeforeReceive: 70,
      runTiming: 85,
      defensivePositioning: 50,
    },
    teamProfile: {
      supportCarrier: 70,
      tacticalDiscipline: 65,
      teamCommunication: 70,
      defensiveCover: 55,
      collectiveMovement: 75,
    },
    individualProfile: {
      creativity: 85,
      decisionUnderPressure: 70,
      ballConfidence: 85,
      vision: 75,
      technicalExecution: 85,
    },
    riskProfile: {
      baseRisk: 70,
      riskUnderPressure: +5,
      riskWhenLosing: +20,
      riskWhenWinning: -5,
      dribbleVsPass: 70,
    },
    criticalProfile: {
      criticalComposure: 65,
      ego: 75,
      crowdPressureReaction: 60,
      selfishVsTeam: 60,
      finishingConfidence: 75,
    },
    defaultSkills: ['skl_attack_space', 'skl_shoot_window', 'skl_selfish_finish_bias'],
  },

  // ─────────────────────────────────────────────────────────────
  // ATACANTES
  // ─────────────────────────────────────────────────────────────
  ATA: {
    position: 'ATA',
    role: 'attack',
    spatialProfile: {
      preferredZones: ['att_third', 'opp_box'],
      spatialAwareness: 70,
      scanBeforeReceive: 65,
      runTiming: 90,
      defensivePositioning: 40,
    },
    teamProfile: {
      supportCarrier: 65,
      tacticalDiscipline: 60,
      teamCommunication: 65,
      defensiveCover: 45,
      collectiveMovement: 70,
    },
    individualProfile: {
      creativity: 75,
      decisionUnderPressure: 75,
      ballConfidence: 85,
      vision: 70,
      technicalExecution: 85,
    },
    riskProfile: {
      baseRisk: 75,
      riskUnderPressure: +10,
      riskWhenLosing: +25,
      riskWhenWinning: 0,
      dribbleVsPass: 60,
    },
    criticalProfile: {
      criticalComposure: 70,
      ego: 85,
      crowdPressureReaction: 65,
      selfishVsTeam: 75,
      finishingConfidence: 90,
    },
    defaultSkills: ['skl_attack_space', 'skl_shoot_window', 'skl_selfish_finish_bias', 'skl_critical_composure'],
  },

  CA: {
    position: 'CA',
    role: 'attack',
    spatialProfile: {
      preferredZones: ['att_third', 'opp_box'],
      spatialAwareness: 70,
      scanBeforeReceive: 65,
      runTiming: 90,
      defensivePositioning: 40,
    },
    teamProfile: {
      supportCarrier: 65,
      tacticalDiscipline: 60,
      teamCommunication: 65,
      defensiveCover: 45,
      collectiveMovement: 70,
    },
    individualProfile: {
      creativity: 75,
      decisionUnderPressure: 75,
      ballConfidence: 85,
      vision: 70,
      technicalExecution: 85,
    },
    riskProfile: {
      baseRisk: 75,
      riskUnderPressure: +10,
      riskWhenLosing: +25,
      riskWhenWinning: 0,
      dribbleVsPass: 60,
    },
    criticalProfile: {
      criticalComposure: 70,
      ego: 85,
      crowdPressureReaction: 65,
      selfishVsTeam: 75,
      finishingConfidence: 90,
    },
    defaultSkills: ['skl_attack_space', 'skl_shoot_window', 'skl_selfish_finish_bias', 'skl_critical_composure'],
  },
};

/** Fallback para posições não mapeadas */
export const DEFAULT_TEMPLATE: ProfileTemplate = {
  position: 'UNKNOWN',
  role: 'mid',
  spatialProfile: {
    preferredZones: ['mid_third'],
    spatialAwareness: 65,
    scanBeforeReceive: 65,
    runTiming: 65,
    defensivePositioning: 65,
  },
  teamProfile: {
    supportCarrier: 70,
    tacticalDiscipline: 70,
    teamCommunication: 70,
    defensiveCover: 70,
    collectiveMovement: 70,
  },
  individualProfile: {
    creativity: 65,
    decisionUnderPressure: 65,
    ballConfidence: 65,
    vision: 65,
    technicalExecution: 65,
  },
  riskProfile: {
    baseRisk: 50,
    riskUnderPressure: 0,
    riskWhenLosing: +10,
    riskWhenWinning: -5,
    dribbleVsPass: 50,
  },
  criticalProfile: {
    criticalComposure: 65,
    ego: 50,
    crowdPressureReaction: 65,
    selfishVsTeam: 40,
    finishingConfidence: 50,
  },
  defaultSkills: ['skl_spatial_awareness', 'skl_team_support'],
};

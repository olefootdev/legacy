/**
 * Integração de AgentProfile no fluxo de decisão
 *
 * Aplica bias de AgentProfile + TeamIntent + Skills ativas
 * ao scoring de ações em collectiveIndividualDecision.ts
 */

import type { AgentProfile, TeamIntent } from './types';
import type { DecisionContext } from '@/playerDecision/types';
import { getSkillsByIds } from './SkillRegistry';
import { getTeamIntentBias } from './TeamIntentResolver';

/**
 * Calcula bias total de AgentProfile para uma ação
 */
export function getAgentProfileBias(
  profile: AgentProfile | undefined,
  action: string,
  ctx: DecisionContext,
): number {
  if (!profile) return 0;

  let bias = 0;

  // Bias de perfil espacial
  if (action === 'pass_progressive' && profile.spatialProfile.spatialAwareness > 75) {
    bias += 0.08;
  }
  if (action === 'pass_safe' && profile.spatialProfile.scanBeforeReceive > 75) {
    bias += 0.06;
  }

  // Bias de perfil coletivo
  if (action.startsWith('pass_') && profile.teamProfile.tacticalDiscipline > 75) {
    bias += 0.05;
  }
  if (action === 'off_ball_support' && profile.teamProfile.supportCarrier > 75) {
    bias += 0.10;
  }

  // Bias de perfil individual
  if (action === 'carry' && profile.individualProfile.ballConfidence > 75) {
    bias += 0.08;
  }
  if (action === 'pass_progressive' && profile.individualProfile.vision > 75) {
    bias += 0.10;
  }

  // Bias de perfil de risco
  const riskActions = ['shoot', 'carry', 'dribble'];
  if (riskActions.includes(action)) {
    const riskFactor = profile.riskProfile.baseRisk / 100;
    bias += riskFactor * 0.15;
  }

  // Bias de perfil crítico
  if (action === 'shoot' && profile.criticalProfile.finishingConfidence > 75) {
    bias += 0.12;
  }
  if (action === 'shoot' && profile.criticalProfile.selfishVsTeam > 70) {
    bias += 0.08;
  }

  // Bias de learning state
  if (action === 'shoot' && profile.learningState.passVsShootPreference < 40) {
    bias += 0.10; // Prefere chutar
  }
  if (action.startsWith('pass_') && profile.learningState.passVsShootPreference > 60) {
    bias += 0.08; // Prefere passar
  }

  return bias;
}

/**
 * Calcula bias de skills ativas
 */
export function getActiveSkillsBias(
  profile: AgentProfile | undefined,
  action: string,
  ctx: DecisionContext,
): number {
  if (!profile || !profile.equippedSkills.length) return 0;

  const skills = getSkillsByIds(profile.equippedSkills);
  let bias = 0;

  for (const skill of skills) {
    // Verifica se skill está ativa no contexto atual
    if (skill.when(ctx as any)) {
      // Aplica bias da skill para esta ação
      const skillBias = skill.bias[action];
      if (skillBias !== undefined) {
        bias += skillBias;
      }
    }
  }

  return bias;
}

/**
 * Calcula bias total (AgentProfile + TeamIntent + Skills)
 */
export function calculateTotalAgentBias(
  profile: AgentProfile | undefined,
  teamIntent: TeamIntent | undefined,
  action: string,
  ctx: DecisionContext,
): number {
  let total = 0;

  // Bias de AgentProfile
  total += getAgentProfileBias(profile, action, ctx);

  // Bias de Skills ativas
  total += getActiveSkillsBias(profile, action, ctx);

  // Bias de TeamIntent
  if (teamIntent) {
    const intentBias = getTeamIntentBias(teamIntent);
    total += intentBias[action] ?? 0;
  }

  return total;
}

/**
 * Aplica bias de agente ao score de uma ação
 */
export function applyAgentBiasToScore(
  baseScore: number,
  profile: AgentProfile | undefined,
  teamIntent: TeamIntent | undefined,
  action: string,
  ctx: DecisionContext,
): number {
  const bias = calculateTotalAgentBias(profile, teamIntent, action, ctx);
  return baseScore + bias;
}

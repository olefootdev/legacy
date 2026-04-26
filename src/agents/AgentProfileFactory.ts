/**
 * AgentProfileFactory — Gera AgentProfile para jogadores Gênesis
 *
 * Usa templates por posição + atributos do jogador + arquétipo + raridade
 * para criar perfis offline completos sem chamar IA.
 */

import type { PlayerEntity } from '@/entities/types';
import type {
  AgentProfile,
  SpatialProfile,
  TeamProfile,
  IndividualProfile,
  RiskProfile,
  CriticalProfile,
  LearningState,
} from './types';
import { PROFILE_TEMPLATES, DEFAULT_TEMPLATE } from './profileTemplates';

/** Normaliza posição para template (ex: ZAG1 → ZAG, ATA2 → ATA) */
function normalizePosition(pos: string): string {
  const upper = pos.toUpperCase().trim();
  // Remove números
  const clean = upper.replace(/[0-9]/g, '');
  return clean;
}

/** Mapeia behavior → bias de risco */
function behaviorToRiskBias(behavior: string): number {
  switch (behavior) {
    case 'ofensivo':
      return +15;
    case 'defensivo':
      return -15;
    case 'criativo':
      return +10;
    case 'equilibrado':
    default:
      return 0;
  }
}

/** Mapeia archetype → bias de perfil */
function archetypeToBias(archetype: string): {
  spatial: number;
  team: number;
  individual: number;
  risk: number;
  critical: number;
} {
  switch (archetype) {
    case 'lenda':
      return { spatial: +15, team: +10, individual: +15, risk: -5, critical: +20 };
    case 'profissional':
      return { spatial: +5, team: +10, individual: +5, risk: -10, critical: +10 };
    case 'novo_talento':
      return { spatial: -5, team: +5, individual: +10, risk: +10, critical: -5 };
    case 'meme':
      return { spatial: -10, team: -5, individual: +5, risk: +20, critical: -10 };
    case 'ai_plus':
      return { spatial: +10, team: +10, individual: +10, risk: 0, critical: +10 };
    default:
      return { spatial: 0, team: 0, individual: 0, risk: 0, critical: 0 };
  }
}

/** Mapeia raridade → multiplicador de qualidade */
function rarityToQualityMultiplier(rarity?: string): number {
  switch (rarity) {
    case 'epico':
      return 1.15;
    case 'ultra_raro':
      return 1.10;
    case 'raro':
      return 1.05;
    case 'ouro':
      return 1.03;
    case 'prata':
      return 1.0;
    case 'bronze':
      return 0.98;
    case 'premium':
      return 1.02;
    case 'normal':
    default:
      return 1.0;
  }
}

/** Clamp 0-100 */
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Aplica bias de atributos ao perfil base */
function applyAttributeBias(
  base: number,
  attrs: PlayerEntity['attrs'],
  attrKeys: (keyof PlayerEntity['attrs'])[],
  weight = 0.3,
): number {
  let sum = 0;
  for (const key of attrKeys) {
    sum += attrs[key] ?? 65;
  }
  const avg = sum / attrKeys.length;
  return clamp(base * (1 - weight) + avg * weight);
}

/** Cria SpatialProfile */
function createSpatialProfile(
  template: typeof PROFILE_TEMPLATES[string],
  player: PlayerEntity,
  archetypeBias: ReturnType<typeof archetypeToBias>,
  qualityMul: number,
): SpatialProfile {
  const base = template.spatialProfile;
  const attrs = player.attrs;

  return {
    preferredZones: base.preferredZones ?? ['mid_third'],
    spatialAwareness: clamp(
      ((base.spatialAwareness ?? 65) + archetypeBias.spatial) * qualityMul,
    ),
    scanBeforeReceive: applyAttributeBias(
      (base.scanBeforeReceive ?? 65) + archetypeBias.spatial,
      attrs,
      ['tatico', 'mentalidade'],
      0.25,
    ),
    runTiming: applyAttributeBias(
      (base.runTiming ?? 65) + archetypeBias.spatial,
      attrs,
      ['velocidade', 'tatico'],
      0.3,
    ),
    defensivePositioning: applyAttributeBias(
      (base.defensivePositioning ?? 65) + archetypeBias.spatial,
      attrs,
      ['marcacao', 'tatico'],
      0.3,
    ),
  };
}

/** Cria TeamProfile */
function createTeamProfile(
  template: typeof PROFILE_TEMPLATES[string],
  player: PlayerEntity,
  archetypeBias: ReturnType<typeof archetypeToBias>,
  qualityMul: number,
): TeamProfile {
  const base = template.teamProfile;
  const attrs = player.attrs;

  return {
    supportCarrier: applyAttributeBias(
      (base.supportCarrier ?? 70) + archetypeBias.team,
      attrs,
      ['tatico', 'mentalidade'],
      0.25,
    ),
    tacticalDiscipline: applyAttributeBias(
      (base.tacticalDiscipline ?? 70) + archetypeBias.team,
      attrs,
      ['tatico', 'fairPlay'],
      0.3,
    ),
    teamCommunication: clamp(
      ((base.teamCommunication ?? 70) + archetypeBias.team) * qualityMul,
    ),
    defensiveCover: applyAttributeBias(
      (base.defensiveCover ?? 70) + archetypeBias.team,
      attrs,
      ['marcacao', 'tatico'],
      0.3,
    ),
    collectiveMovement: applyAttributeBias(
      (base.collectiveMovement ?? 70) + archetypeBias.team,
      attrs,
      ['velocidade', 'tatico'],
      0.25,
    ),
  };
}

/** Cria IndividualProfile */
function createIndividualProfile(
  template: typeof PROFILE_TEMPLATES[string],
  player: PlayerEntity,
  archetypeBias: ReturnType<typeof archetypeToBias>,
  qualityMul: number,
): IndividualProfile {
  const base = template.individualProfile;
  const attrs = player.attrs;

  return {
    creativity: applyAttributeBias(
      (base.creativity ?? 65) + archetypeBias.individual,
      attrs,
      ['drible', 'passe'],
      0.3,
    ),
    decisionUnderPressure: applyAttributeBias(
      (base.decisionUnderPressure ?? 65) + archetypeBias.individual,
      attrs,
      ['mentalidade', 'confianca'],
      0.3,
    ),
    ballConfidence: applyAttributeBias(
      (base.ballConfidence ?? 65) + archetypeBias.individual,
      attrs,
      ['confianca', 'drible'],
      0.3,
    ),
    vision: applyAttributeBias(
      (base.vision ?? 65) + archetypeBias.individual,
      attrs,
      ['passe', 'tatico'],
      0.3,
    ),
    technicalExecution: applyAttributeBias(
      (base.technicalExecution ?? 65) + archetypeBias.individual,
      attrs,
      ['finalizacao', 'drible', 'passe'],
      0.3,
    ),
  };
}

/** Cria RiskProfile */
function createRiskProfile(
  template: typeof PROFILE_TEMPLATES[string],
  player: PlayerEntity,
  archetypeBias: ReturnType<typeof archetypeToBias>,
  behaviorBias: number,
): RiskProfile {
  const base = template.riskProfile;
  const attrs = player.attrs;

  return {
    baseRisk: clamp((base.baseRisk ?? 50) + archetypeBias.risk + behaviorBias),
    riskUnderPressure: Math.max(
      -50,
      Math.min(50, (base.riskUnderPressure ?? 0) + archetypeBias.risk * 0.5),
    ),
    riskWhenLosing: Math.max(
      -50,
      Math.min(50, (base.riskWhenLosing ?? +10) + behaviorBias * 0.5),
    ),
    riskWhenWinning: Math.max(
      -50,
      Math.min(50, (base.riskWhenWinning ?? -5) - behaviorBias * 0.3),
    ),
    dribbleVsPass: applyAttributeBias(
      (base.dribbleVsPass ?? 50) + archetypeBias.risk,
      attrs,
      ['drible'],
      0.4,
    ),
  };
}

/** Cria CriticalProfile */
function createCriticalProfile(
  template: typeof PROFILE_TEMPLATES[string],
  player: PlayerEntity,
  archetypeBias: ReturnType<typeof archetypeToBias>,
  qualityMul: number,
): CriticalProfile {
  const base = template.criticalProfile;
  const attrs = player.attrs;

  return {
    criticalComposure: applyAttributeBias(
      (base.criticalComposure ?? 65) + archetypeBias.critical,
      attrs,
      ['mentalidade', 'confianca'],
      0.3,
    ),
    ego: clamp(((base.ego ?? 50) + archetypeBias.critical * 0.5) * qualityMul),
    crowdPressureReaction: applyAttributeBias(
      (base.crowdPressureReaction ?? 65) + archetypeBias.critical,
      attrs,
      ['mentalidade'],
      0.25,
    ),
    selfishVsTeam: clamp(
      (base.selfishVsTeam ?? 40) + archetypeBias.critical * 0.3,
    ),
    finishingConfidence: applyAttributeBias(
      (base.finishingConfidence ?? 50) + archetypeBias.critical,
      attrs,
      ['finalizacao', 'confianca'],
      0.35,
    ),
  };
}

/** Cria LearningState inicial */
function createInitialLearningState(
  player: PlayerEntity,
  qualityMul: number,
): LearningState {
  const attrs = player.attrs;
  return {
    confidence: clamp((attrs.confianca ?? 70) * qualityMul),
    riskTendency: clamp(50 + (attrs.mentalidade ?? 70) * 0.2),
    passVsShootPreference: clamp(
      50 + (attrs.passe ?? 70) * 0.3 - (attrs.finalizacao ?? 60) * 0.2,
    ),
    criticalComposure: clamp((attrs.mentalidade ?? 70) * qualityMul),
    tacticalDiscipline: clamp((attrs.tatico ?? 70) * qualityMul),
    egoControl: clamp(70 - (attrs.confianca ?? 70) * 0.15),
    recentEvents: [],
  };
}

/**
 * Gera AgentProfile completo para um jogador
 */
export function createAgentProfile(player: PlayerEntity): AgentProfile {
  const pos = normalizePosition(player.pos);
  const template = PROFILE_TEMPLATES[pos] ?? DEFAULT_TEMPLATE;

  const archetypeBias = archetypeToBias(player.archetype);
  const behaviorBias = behaviorToRiskBias(player.behavior);
  const qualityMul = rarityToQualityMultiplier(player.rarity);

  const spatialProfile = createSpatialProfile(
    template,
    player,
    archetypeBias,
    qualityMul,
  );
  const teamProfile = createTeamProfile(
    template,
    player,
    archetypeBias,
    qualityMul,
  );
  const individualProfile = createIndividualProfile(
    template,
    player,
    archetypeBias,
    qualityMul,
  );
  const riskProfile = createRiskProfile(
    template,
    player,
    archetypeBias,
    behaviorBias,
  );
  const criticalProfile = createCriticalProfile(
    template,
    player,
    archetypeBias,
    qualityMul,
  );
  const learningState = createInitialLearningState(player, qualityMul);

  return {
    playerId: player.id,
    position: pos,
    role: template.role,
    archetype: player.archetype,
    spatialProfile,
    teamProfile,
    individualProfile,
    riskProfile,
    criticalProfile,
    equippedSkills: [...template.defaultSkills],
    learningState,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Atualiza AgentProfile existente com novos dados do jogador
 */
export function updateAgentProfile(
  profile: AgentProfile,
  player: PlayerEntity,
): AgentProfile {
  // Recalcula profiles mantendo learningState
  const fresh = createAgentProfile(player);
  return {
    ...fresh,
    learningState: profile.learningState, // Preserva aprendizado
    equippedSkills: profile.equippedSkills, // Preserva skills equipadas
    createdAt: profile.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Valida se AgentProfile está consistente
 */
export function validateAgentProfile(profile: AgentProfile): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!profile.playerId) errors.push('playerId obrigatório');
  if (!profile.position) errors.push('position obrigatório');
  if (!profile.role) errors.push('role obrigatório');
  if (profile.version !== 1) errors.push('version inválida');

  // Valida ranges
  const checkRange = (val: number, name: string, min = 0, max = 100) => {
    if (val < min || val > max) errors.push(`${name} fora do range [${min}, ${max}]`);
  };

  checkRange(profile.spatialProfile.spatialAwareness, 'spatialAwareness');
  checkRange(profile.teamProfile.tacticalDiscipline, 'tacticalDiscipline');
  checkRange(profile.riskProfile.baseRisk, 'baseRisk');
  checkRange(profile.riskProfile.riskUnderPressure, 'riskUnderPressure', -50, 50);
  checkRange(profile.learningState.confidence, 'confidence');

  return { valid: errors.length === 0, errors };
}

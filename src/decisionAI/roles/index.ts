// ---------------------------------------------------------------------------
// decisionAI/roles — public API
// ---------------------------------------------------------------------------

export type { PlayerRoleId, PlayerRoleProfile } from './playerRoleProfiles';
export { ROLE_PROFILES } from './playerRoleProfiles';

export {
  deriveVision,
  deriveDecisions,
  deriveOffTheBall,
  deriveComposure,
  deriveFlair,
  deriveAnticipation,
  deriveTeamwork,
  deriveReactionDelaySec,
  cognitiveFatigueMultiplier,
  psychologicalPressureMultiplier,
  egoPassPenalty,
  preferredFootMultiplier,
} from './attributeModulators';

export type { AttributeInputs } from './attributeAxisBuilder';
export { buildAttributeInputs } from './attributeAxisBuilder';

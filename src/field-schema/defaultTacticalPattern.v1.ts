import { FIELD_SCHEMA_VERSION } from './constants';
import type { TacticalPattern } from './adminArtifacts';

/**
 * Padrão default alinhado ao 4-3-3 hardcoded atual — até o clube carregar um TacticalPattern por API.
 */
export const DEFAULT_TACTICAL_PATTERN_V1: TacticalPattern = {
  id: 'builtin-433-balanced-v1',
  name: '4-3-3 equilibrado (built-in)',
  fieldSchemaVersion: FIELD_SCHEMA_VERSION,
  formationKey: '4-3-3',
  slotTemplate: [],
  phasePresets: {
    build_up: { targetZoneIds: ['def_third_home', 'mid_third'] },
    press: { targetZoneIds: ['mid_third', 'att_third_home'] },
    low_block: { targetZoneIds: ['def_third_home'] },
  },
  behavior: {
    blockDepthBias: 0,
    widePlayBias: 0,
    pressTriggerZones: ['mid_third'],
  },
  version: 1,
};

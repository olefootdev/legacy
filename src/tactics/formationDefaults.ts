import type { FormationSchemeId } from '@/match-engine/types';
import type { PlayingStylePresetId, TeamTacticalStyle } from './playingStyle';
import { STYLE_PRESETS } from './playingStyle';

export interface FormationTacticalDefaults {
  presetId: PlayingStylePresetId;
  style: TeamTacticalStyle;
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
}

/**
 * Mapeamento de cada formação para os defaults táticos recomendados pelo GameSpirit.
 * Quando o jogador escolhe uma formação, os sliders e o estilo de jogo são inicializados
 * de acordo com a identidade tática natural daquela disposição.
 */
export const FORMATION_TACTICAL_DEFAULTS: Record<FormationSchemeId, FormationTacticalDefaults> = {
  '4-3-3': {
    presetId: 'tiki_positional',
    style: STYLE_PRESETS.tiki_positional,
    tacticalMentality: 78,
    defensiveLine: 82,
    tempo: 60,
  },
  '4-4-2': {
    presetId: 'balanced',
    style: STYLE_PRESETS.balanced,
    tacticalMentality: 72,
    defensiveLine: 75,
    tempo: 65,
  },
  '4-2-3-1': {
    presetId: 'vertical_transition',
    style: STYLE_PRESETS.vertical_transition,
    tacticalMentality: 76,
    defensiveLine: 78,
    tempo: 70,
  },
  '3-5-2': {
    presetId: 'tiki_positional',
    style: STYLE_PRESETS.tiki_positional,
    tacticalMentality: 74,
    defensiveLine: 80,
    tempo: 62,
  },
  '4-5-1': {
    presetId: 'low_block_counter',
    style: STYLE_PRESETS.low_block_counter,
    tacticalMentality: 55,
    defensiveLine: 45,
    tempo: 58,
  },
  '5-3-2': {
    presetId: 'low_block_counter',
    style: STYLE_PRESETS.low_block_counter,
    tacticalMentality: 50,
    defensiveLine: 40,
    tempo: 55,
  },
  '3-4-3': {
    presetId: 'wide_crossing',
    style: STYLE_PRESETS.wide_crossing,
    tacticalMentality: 82,
    defensiveLine: 85,
    tempo: 72,
  },
};

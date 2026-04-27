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
    presetId: 'POSSE_CONTROLADA',
    style: STYLE_PRESETS.POSSE_CONTROLADA,
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
    presetId: 'TRANSICAO_RAPIDA',
    style: STYLE_PRESETS.TRANSICAO_RAPIDA,
    tacticalMentality: 76,
    defensiveLine: 78,
    tempo: 70,
  },
  '3-5-2': {
    presetId: 'POSSE_CONTROLADA',
    style: STYLE_PRESETS.POSSE_CONTROLADA,
    tacticalMentality: 74,
    defensiveLine: 80,
    tempo: 62,
  },
  '4-5-1': {
    presetId: 'BLOCO_BAIXO',
    style: STYLE_PRESETS.BLOCO_BAIXO,
    tacticalMentality: 55,
    defensiveLine: 45,
    tempo: 58,
  },
  '5-3-2': {
    presetId: 'BLOCO_BAIXO',
    style: STYLE_PRESETS.BLOCO_BAIXO,
    tacticalMentality: 50,
    defensiveLine: 40,
    tempo: 55,
  },
  '3-4-3': {
    presetId: 'JOGO_PELAS_LATERAIS',
    style: STYLE_PRESETS.JOGO_PELAS_LATERAIS,
    tacticalMentality: 82,
    defensiveLine: 85,
    tempo: 72,
  },
};

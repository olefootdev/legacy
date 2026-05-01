import { useState, useCallback, useEffect, useRef } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';

export interface TacticalParams {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
}

const BASELINE: TacticalParams = {
  tacticalMentality: 55,
  defensiveLine: 50,
  tempo: 55,
};

const INTENT_PARAMS: Record<VoiceIntent, Partial<TacticalParams>> = {
  team_press_high: { tacticalMentality: 85, defensiveLine: 75, tempo: 80 },
  team_retreat: { tacticalMentality: 25, defensiveLine: 20, tempo: 35 },
  pedal_to_metal: { tacticalMentality: 90, defensiveLine: 60, tempo: 90 },
  team_hold_possession: { tacticalMentality: 40, defensiveLine: 40, tempo: 28 },
  stretch_team: { tacticalMentality: 65, defensiveLine: 55, tempo: 65 },
  left_back_overlap: { tacticalMentality: 70, defensiveLine: 65, tempo: 70 },
  team_high_line: { tacticalMentality: 75, defensiveLine: 70, tempo: 72 },
  forwards_press_defenders: { tacticalMentality: 80, defensiveLine: 60, tempo: 78 },
  calm_team: { tacticalMentality: 45, defensiveLine: 45, tempo: 40 },
  midfielders_compact: { tacticalMentality: 55, defensiveLine: 50, tempo: 55 },
  laterals_cross: { tacticalMentality: 65, defensiveLine: 55, tempo: 65 },

  // Default para intents individuais (não modificam coletivo)
  take_shot: {},
  dribble_attempt: {},
  cross_ball: {},
  pass_to_player: {},
  hold_ball: {},
  quick_pass: {},
  invade_box: {},
  mark_player: {},
  break_line: {},
  run_behind: {},
  hold_small_area: {},
  break_zone: {},
  free_play: {},
  wait_support: {},
  block_advance: {},
  aggressive_tackle: {},
  tactical_foul: {},
  spare_player: {},
  switch_play: {},
  formation_change: {},
  player_substitution: {},
  referee_warning: {},
  referee_red_language: {},
};

const ECHO_DURATION_MS = 12000; // 12s — echo tático desvanece

/**
 * Hook que gerencia estado tático derivado de VoiceIntent.
 * Quando recebe um intent, atualiza os parâmetros por N segundos,
 * depois volta ao baseline gradualmente (fade-out).
 */
export function useVoiceTacticalState() {
  const [params, setParams] = useState<TacticalParams>(BASELINE);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastIntentRef = useRef<VoiceIntent | null>(null);

  const applyIntent = useCallback((intent: VoiceIntent) => {
    lastIntentRef.current = intent;

    // Pega overrides do intent, fallback para baseline
    const override = INTENT_PARAMS[intent] ?? {};
    const newParams: TacticalParams = {
      tacticalMentality: override.tacticalMentality ?? BASELINE.tacticalMentality,
      defensiveLine: override.defensiveLine ?? BASELINE.defensiveLine,
      tempo: override.tempo ?? BASELINE.tempo,
    };

    setParams(newParams);

    // Limpa timeout anterior
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Agenda volta ao baseline
    timerRef.current = setTimeout(() => {
      setParams(BASELINE);
      lastIntentRef.current = null;
    }, ECHO_DURATION_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { params, applyIntent, lastIntent: lastIntentRef.current };
}

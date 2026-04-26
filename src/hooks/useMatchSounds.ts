/**
 * Hook para gerenciar sons de eventos de partida
 * Efeitos sonoros para eventos especiais, gols, cartões, etc.
 */

import { useCallback, useRef, useEffect } from 'react';
import type { SpecialEventType } from '@/match/specialEvents';

interface SoundConfig {
  volume: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: SoundConfig = {
  volume: 0.7,
  enabled: true,
};

// URLs dos sons (podem ser substituídos por arquivos reais)
const SOUND_URLS = {
  // Eventos especiais
  bicycle_kick: '/sounds/bicycle-kick.mp3',
  thunderstrike: '/sounds/thunderstrike.mp3',
  miraculous_save: '/sounds/miraculous-save.mp3',
  goalkeeper_assist: '/sounds/goalkeeper-assist.mp3',
  injury_scare: '/sounds/injury-scare.mp3',
  crowd_roar_boost: '/sounds/crowd-roar.mp3',

  // Eventos de jogo
  goal_home: '/sounds/goal-home.mp3',
  goal_away: '/sounds/goal-away.mp3',
  shot_save: '/sounds/shot-save.mp3',
  shot_blocked: '/sounds/shot-blocked.mp3',
  shot_wide: '/sounds/shot-wide.mp3',
  yellow_card: '/sounds/yellow-card.mp3',
  red_card: '/sounds/red-card.mp3',
  whistle: '/sounds/whistle.mp3',
  crowd_cheer: '/sounds/crowd-cheer.mp3',
  crowd_groan: '/sounds/crowd-groan.mp3',

  // Momentos interativos
  interactive_moment: '/sounds/interactive-moment.mp3',
  choice_success: '/sounds/choice-success.mp3',
  choice_fail: '/sounds/choice-fail.mp3',

  // UI
  halftime: '/sounds/halftime-whistle.mp3',
  fulltime: '/sounds/fulltime-whistle.mp3',
  countdown: '/sounds/countdown.mp3',
} as const;

type SoundKey = keyof typeof SOUND_URLS;

export function useMatchSounds(config: Partial<SoundConfig> = {}) {
  const configRef = useRef<SoundConfig>({ ...DEFAULT_CONFIG, ...config });
  const audioCache = useRef<Map<SoundKey, HTMLAudioElement>>(new Map());
  const currentlyPlaying = useRef<Set<HTMLAudioElement>>(new Set());

  // Preload sounds
  useEffect(() => {
    if (!configRef.current.enabled) return;

    const preloadKeys: SoundKey[] = [
      'goal_home',
      'goal_away',
      'whistle',
      'interactive_moment',
      'bicycle_kick',
      'thunderstrike',
      'miraculous_save',
    ];

    preloadKeys.forEach((key) => {
      if (!audioCache.current.has(key)) {
        const audio = new Audio(SOUND_URLS[key]);
        audio.volume = configRef.current.volume;
        audio.preload = 'auto';
        audioCache.current.set(key, audio);
      }
    });

    return () => {
      // Cleanup
      currentlyPlaying.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      currentlyPlaying.current.clear();
    };
  }, []);

  const play = useCallback((key: SoundKey, options?: { volume?: number; loop?: boolean }) => {
    if (!configRef.current.enabled) return;

    let audio = audioCache.current.get(key);

    if (!audio) {
      audio = new Audio(SOUND_URLS[key]);
      audioCache.current.set(key, audio);
    }

    // Stop if already playing
    if (currentlyPlaying.current.has(audio)) {
      audio.pause();
      audio.currentTime = 0;
      currentlyPlaying.current.delete(audio);
    }

    audio.volume = options?.volume ?? configRef.current.volume;
    audio.loop = options?.loop ?? false;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          currentlyPlaying.current.add(audio!);
        })
        .catch((error) => {
          console.warn(`Failed to play sound ${key}:`, error);
        });
    }

    audio.onended = () => {
      currentlyPlaying.current.delete(audio!);
    };
  }, []);

  const stop = useCallback((key?: SoundKey) => {
    if (key) {
      const audio = audioCache.current.get(key);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        currentlyPlaying.current.delete(audio);
      }
    } else {
      // Stop all
      currentlyPlaying.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      currentlyPlaying.current.clear();
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    configRef.current.volume = Math.max(0, Math.min(1, volume));
    audioCache.current.forEach((audio) => {
      audio.volume = configRef.current.volume;
    });
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    configRef.current.enabled = enabled;
    if (!enabled) {
      stop();
    }
  }, [stop]);

  // Convenience methods
  const playSpecialEvent = useCallback((type: SpecialEventType) => {
    play(type);
  }, [play]);

  const playGoal = useCallback((side: 'home' | 'away') => {
    play(side === 'home' ? 'goal_home' : 'goal_away');
  }, [play]);

  const playCard = useCallback((type: 'yellow' | 'red') => {
    play(type === 'yellow' ? 'yellow_card' : 'red_card');
  }, [play]);

  const playShot = useCallback((outcome: 'save' | 'blocked' | 'wide') => {
    const key = outcome === 'save' ? 'shot_save' : outcome === 'blocked' ? 'shot_blocked' : 'shot_wide';
    play(key);
  }, [play]);

  const playInteractiveMoment = useCallback(() => {
    play('interactive_moment');
  }, [play]);

  const playInteractiveChoice = useCallback((success: boolean) => {
    play(success ? 'choice_success' : 'choice_fail');
  }, [play]);

  const playCrowdReaction = useCallback((positive: boolean) => {
    play(positive ? 'crowd_cheer' : 'crowd_groan', { volume: 0.5 });
  }, [play]);

  return {
    play,
    stop,
    setVolume,
    setEnabled,
    playSpecialEvent,
    playGoal,
    playCard,
    playShot,
    playInteractiveMoment,
    playInteractiveChoice,
    playCrowdReaction,
    config: configRef.current,
  };
}

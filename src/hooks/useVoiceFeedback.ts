/**
 * Hook para feedback tátil/sonoro/visual de comandos de voz.
 *
 * Fornece vibração, sons e animações para tornar a experiência
 * de comandos de voz tão fluida quanto WhatsApp.
 */

import { useCallback, useRef } from 'react';

export type FeedbackType = 'sent' | 'success' | 'error' | 'processing';

interface VoiceFeedbackOptions {
  enableVibration?: boolean;
  enableSound?: boolean;
  enableVisual?: boolean;
}

export interface VoiceFeedbackApi {
  triggerFeedback: (type: FeedbackType) => void;
  playSound: (soundId: string) => void;
  vibrate: (pattern: number | number[]) => void;
}

/**
 * Padrões de vibração por tipo de feedback.
 */
const VIBRATION_PATTERNS: Record<FeedbackType, number | number[]> = {
  sent: 50,                    // Pulso curto ao enviar
  success: [50, 50, 50],       // Triplo pulso no sucesso
  error: [100, 50, 100],       // Pulso longo-curto-longo no erro
  processing: 30,              // Pulso muito curto ao processar
};

/**
 * URLs de sons por tipo de feedback.
 * Arquivos devem estar em /public/sounds/
 */
const SOUND_URLS: Record<FeedbackType, string> = {
  sent: '/sounds/voice_sent.mp3',
  success: '/sounds/voice_success.mp3',
  error: '/sounds/voice_error.mp3',
  processing: '/sounds/voice_processing.mp3',
};

/**
 * Hook de feedback multimodal para comandos de voz.
 */
export function useVoiceFeedback(options: VoiceFeedbackOptions = {}): VoiceFeedbackApi {
  const {
    enableVibration = true,
    enableSound = true,
    enableVisual = true,
  } = options;

  // Cache de áudio pré-carregado
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Pré-carrega sons na montagem
  const preloadSounds = useCallback(() => {
    Object.entries(SOUND_URLS).forEach(([type, url]) => {
      if (!audioCache.current.has(type)) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = 0.4; // Volume moderado
        audioCache.current.set(type, audio);
      }
    });
  }, []);

  // Pré-carrega na primeira chamada
  if (audioCache.current.size === 0 && enableSound) {
    preloadSounds();
  }

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!enableVibration) return;

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (err) {
      console.warn('[voice-feedback] Vibration failed:', err);
    }
  }, [enableVibration]);

  const playSound = useCallback((soundId: string) => {
    if (!enableSound) return;

    try {
      const audio = audioCache.current.get(soundId);
      if (audio) {
        // Reset se já estava tocando
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn('[voice-feedback] Sound play failed:', err);
        });
      }
    } catch (err) {
      console.warn('[voice-feedback] Sound error:', err);
    }
  }, [enableSound]);

  const triggerFeedback = useCallback((type: FeedbackType) => {
    // Vibração
    const pattern = VIBRATION_PATTERNS[type];
    if (pattern) {
      vibrate(pattern);
    }

    // Som
    playSound(type);

    // Visual (delegado ao componente via estado)
    if (enableVisual) {
      // Componente deve observar mudanças de estado
      // e aplicar animações CSS correspondentes
    }
  }, [vibrate, playSound, enableVisual]);

  return {
    triggerFeedback,
    playSound,
    vibrate,
  };
}

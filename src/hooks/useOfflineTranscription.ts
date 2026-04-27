/**
 * Hook de transcrição offline usando Whisper WASM.
 *
 * Fallback automático quando Web Speech API não está disponível
 * ou quando offline. Usa modelo Whisper tiny (40MB) rodando no browser.
 *
 * NOTA: Requer instalação do pacote @whisper/web:
 * npm install @whisper/web
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type OfflineTranscriptionState = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface OfflineTranscriptionApi {
  state: OfflineTranscriptionState;
  transcribe: (audioBlob: Blob) => Promise<string>;
  isReady: boolean;
  error?: string;
}

/**
 * Hook de transcrição offline com Whisper WASM.
 *
 * Carrega modelo na primeira chamada (40MB, ~3s de download).
 * Depois disso, transcrições são instantâneas (roda no browser).
 */
export function useOfflineTranscription(): OfflineTranscriptionApi {
  const [state, setState] = useState<OfflineTranscriptionState>('idle');
  const [error, setError] = useState<string | undefined>();
  const whisperRef = useRef<any>(null);
  const isLoadingRef = useRef(false);

  // Carrega Whisper na montagem (lazy)
  const loadWhisper = useCallback(async () => {
    if (whisperRef.current || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setState('loading');

    try {
      // Importa Whisper dinamicamente (code splitting)
      const { Whisper } = await import('@whisper/web');

      // Inicializa com modelo tiny (40MB, mais rápido)
      const whisper = new Whisper({
        model: 'tiny',
        language: 'pt', // Português
      });

      await whisper.load();

      whisperRef.current = whisper;
      setState('ready');
      isLoadingRef.current = false;
    } catch (err) {
      console.error('[offline-transcription] Failed to load Whisper:', err);
      setError('Falha ao carregar modelo de transcrição offline');
      setState('error');
      isLoadingRef.current = false;
    }
  }, []);

  // Transcreve áudio
  const transcribe = useCallback(async (audioBlob: Blob): Promise<string> => {
    // Carrega Whisper se ainda não carregou
    if (!whisperRef.current) {
      await loadWhisper();
    }

    if (!whisperRef.current) {
      throw new Error('Whisper não disponível');
    }

    setState('transcribing');

    try {
      // Converte Blob pra ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Transcreve
      const result = await whisperRef.current.transcribe(arrayBuffer);

      setState('ready');
      return result.text.trim();
    } catch (err) {
      console.error('[offline-transcription] Transcription failed:', err);
      setState('error');
      setError('Falha na transcrição');
      throw err;
    }
  }, [loadWhisper]);

  // Pré-carrega Whisper quando online (otimização)
  useEffect(() => {
    if (navigator.onLine) {
      // Delay de 5s pra não competir com carregamento inicial
      const timer = window.setTimeout(() => {
        loadWhisper();
      }, 5000);

      return () => window.clearTimeout(timer);
    }
  }, [loadWhisper]);

  return {
    state,
    transcribe,
    isReady: state === 'ready',
    error,
  };
}

/**
 * Hook híbrido: usa Web Speech se disponível, Whisper se offline.
 */
export function useHybridTranscription() {
  const offlineTranscription = useOfflineTranscription();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const shouldUseOffline = !isOnline || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  return {
    shouldUseOffline,
    offlineTranscription,
    isOnline,
  };
}

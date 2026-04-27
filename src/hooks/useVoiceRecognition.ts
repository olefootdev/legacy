/**
 * Hook Web Speech API — captura de voz push-to-talk (pt-BR).
 *
 * Uso:
 *   const { state, transcript, interim, start, stop, supported } = useVoiceRecognition({
 *     maxSecs: 5,
 *     onResult: (text) => submit(text),
 *     onError: (msg) => toast(msg),
 *   });
 *
 * State machine: idle → listening → processing → idle (ou error).
 * Auto-stop em `maxSecs` segundos (5 por default).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API types (não tipados no TS core por ser spec não-final).
interface SpeechRecognitionResult {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    item(i: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  };
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceRecognitionOptions {
  lang?: string;
  maxSecs?: number;
  onResult: (transcript: string, confidence: number) => void;
  onError?: (message: string) => void;
  /** Chamado quando início da captura é confirmado. */
  onStart?: () => void;
  /** Chamado quando captura termina (natural, stop, timeout ou erro). */
  onEnd?: () => void;
  /** Chamado durante transcrição (texto parcial). */
  onInterim?: (interimText: string) => void;
}

export interface VoiceRecognitionApi {
  state: VoiceState;
  /** Último transcript final (após stop). */
  transcript: string;
  /** Transcript em progresso (enquanto fala). */
  interim: string;
  supported: boolean;
  /** Permissão de microfone concedida. */
  hasPermission: boolean;
  /** Solicita permissão de microfone. */
  requestPermission: () => Promise<boolean>;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceRecognition(opts: VoiceRecognitionOptions): VoiceRecognitionApi {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef('');
  const lastConfidenceRef = useRef(0);
  const supported = !!getSpeechRecognition();

  // Mantém callbacks em ref pra não reiniciar recognition a cada render.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Verifica permissão de microfone ao montar
  useEffect(() => {
    if (!supported) return;

    // Verifica se já tem permissão
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setHasPermission(result.state === 'granted');

        // Monitora mudanças de permissão
        result.onchange = () => {
          setHasPermission(result.state === 'granted');
        };
      }).catch(() => {
        // Fallback: assume que não tem permissão
        setHasPermission(false);
      });
    }
  }, [supported]);

  // Solicita permissão de microfone
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[voice] requestPermission() chamado');

    if (!supported) {
      console.log('[voice] Não suportado');
      optsRef.current.onError?.('Reconhecimento de voz não suportado neste browser');
      return false;
    }

    try {
      console.log('[voice] Chamando getUserMedia...');
      // Solicita acesso ao microfone via getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[voice] getUserMedia sucesso!', stream);

      // Para o stream imediatamente (só precisamos da permissão)
      stream.getTracks().forEach(track => track.stop());

      setHasPermission(true);
      return true;
    } catch (err) {
      console.error('[voice] Permissão de microfone negada:', err);

      const errorMsg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Permissão de microfone negada. Clique no ícone de cadeado na barra de endereço e permita o acesso ao microfone.'
        : err instanceof Error && err.name === 'NotFoundError'
        ? 'Nenhum microfone encontrado. Conecte um microfone e tente novamente.'
        : 'Não foi possível acessar o microfone. Verifique as permissões do browser.';

      optsRef.current.onError?.(errorMsg);
      setHasPermission(false);
      return false;
    }
  }, [supported]);

  const clearAutoStop = () => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearAutoStop();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const reset = useCallback(() => {
    clearAutoStop();
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    setState('idle');
    setTranscript('');
    setInterim('');
    finalTranscriptRef.current = '';
    lastConfidenceRef.current = 0;
  }, []);

  const start = useCallback(async () => {
    console.log('[voice] start() chamado', { hasPermission });

    const SR = getSpeechRecognition();
    if (!SR) {
      console.log('[voice] SpeechRecognition não disponível');
      optsRef.current.onError?.('Reconhecimento de voz não suportado neste browser');
      setState('error');
      return;
    }

    // Verifica se tem permissão antes de iniciar
    if (!hasPermission) {
      console.log('[voice] Sem permissão, solicitando...');
      const granted = await requestPermission();
      console.log('[voice] Permissão concedida?', granted);
      if (!granted) {
        setState('error');
        return;
      }
    }

    // Reset de estado pra nova captura.
    finalTranscriptRef.current = '';
    lastConfidenceRef.current = 0;
    setTranscript('');
    setInterim('');

    const r = new SR();
    r.lang = optsRef.current.lang ?? 'pt-BR';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    r.onstart = () => {
      setState('listening');
      optsRef.current.onStart?.();
    };
    r.onresult = (e) => {
      let finalText = finalTranscriptRef.current;
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const alt = res[0];
        if (res.isFinal) {
          finalText += alt.transcript;
          lastConfidenceRef.current = alt.confidence ?? 0;
        } else {
          interimText += alt.transcript;
        }
      }
      finalTranscriptRef.current = finalText;
      setTranscript(finalText);
      setInterim(interimText);

      // Callback de interim para preview
      if (interimText && optsRef.current.onInterim) {
        optsRef.current.onInterim(finalText + interimText);
      }
    };
    r.onerror = (e) => {
      const msg = e.error === 'no-speech' ? 'Não ouvi nada — segura e fala mais perto' :
                  e.error === 'audio-capture' ? 'Microfone não disponível' :
                  e.error === 'not-allowed' ? 'Permissão de microfone negada. Clique no ícone de cadeado e permita o acesso.' :
                  e.error === 'network' ? 'Sem rede pra transcrever' :
                  `Erro no reconhecimento: ${e.error}`;
      optsRef.current.onError?.(msg);
      setState('error');
      clearAutoStop();

      // Se erro de permissão, atualiza estado
      if (e.error === 'not-allowed') {
        setHasPermission(false);
      }
    };
    r.onend = () => {
      clearAutoStop();
      setState((prev) => {
        if (prev === 'error') return 'error';
        return 'processing';
      });
      const finalText = finalTranscriptRef.current.trim();
      setInterim('');
      // Agenda o retorno pra idle ANTES de chamar onResult — se o callback
      // do consumer (submit pipeline) lançar exceção ou rodar assíncrono, a
      // UI não fica presa em "processando…" eternamente.
      const returnToIdle = window.setTimeout(() => {
        setState((prev) => (prev === 'processing' ? 'idle' : prev));
      }, 250);
      try {
        if (finalText) {
          optsRef.current.onResult(finalText, lastConfidenceRef.current);
        } else {
          optsRef.current.onError?.('Não entendi — repete ou digita');
        }
        optsRef.current.onEnd?.();
      } catch (err) {
        console.warn('[voice] onResult/onEnd handler threw:', err);
        optsRef.current.onError?.('Falha ao processar o comando');
        // Força saída imediata do processing em caso de exceção.
        window.clearTimeout(returnToIdle);
        setState((prev) => (prev === 'processing' ? 'idle' : prev));
      }
    };

    recognitionRef.current = r;
    try {
      r.start();
    } catch (err) {
      optsRef.current.onError?.('Não foi possível iniciar a captura');
      setState('error');
      return;
    }

    // Auto-stop depois de `maxSecs` pra forçar comandos curtos.
    const maxMs = (optsRef.current.maxSecs ?? 5) * 1000;
    autoStopRef.current = window.setTimeout(() => {
      stop();
    }, maxMs);
  }, [stop, hasPermission, requestPermission]);

  // Limpa ao desmontar.
  useEffect(() => {
    return () => {
      clearAutoStop();
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
    };
  }, []);

  return { state, transcript, interim, supported, hasPermission, requestPermission, start, stop, reset };
}

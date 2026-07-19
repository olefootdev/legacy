/**
 * Gravador de história da lenda — áudio + transcrição ao mesmo tempo.
 *
 * DUAS COISAS EM PARALELO, de propósito:
 *   1. `MediaRecorder` grava o arquivo → é a FONTE DE VERDADE. A voz do atleta
 *      contando a própria história é o ativo; a transcrição é conveniência.
 *   2. `SpeechRecognition` (Web Speech) transcreve ao vivo → rascunho grátis,
 *      sem chave de API e sem custo por minuto.
 *
 * Se a transcrição não funcionar (Firefox, iOS antigo), o áudio ainda é gravado
 * e enviado — quem for ler escuta. Nunca bloqueia o envio.
 *
 * NÃO reusa `useVoiceRecognition`: aquele corta sozinho após 2,5s de silêncio
 * (certo pra comando de partida, desastroso pra alguém contando uma história
 * com pausas). Aqui só para quando a pessoa manda parar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'denied' | 'unsupported';

export interface StoryRecorderApi {
  state: RecorderState;
  /** Áudio gravado (fonte de verdade). */
  blob: Blob | null;
  /** Rascunho da transcrição — pode vir vazio, e tudo bem. */
  transcript: string;
  /** Trecho em reconhecimento agora. */
  interim: string;
  /** Segundos gravados. */
  seconds: number;
  /** Navegador transcreve? (o áudio grava mesmo se não.) */
  canTranscribe: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const MAX_SECONDS = 8 * 60; // ~8 min — cabe folgado no limite de upload

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function speechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | null;
}

export function useStoryRecorder(lang = 'pt-BR'): StoryRecorderApi {
  const [state, setState] = useState<RecorderState>('idle');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [seconds, setSeconds] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const srRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);

  const canTranscribe = speechCtor() != null;

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { srRef.current?.stop(); } catch { /* já parado */ }
    srRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try { recRef.current?.stop(); } catch { /* noop */ }
    cleanup();
    setState('stopped');
  }, [cleanup]);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('unsupported');
      return;
    }
    setBlob(null); setTranscript(''); setInterim(''); setSeconds(0);
    stoppingRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('denied');
      return;
    }
    streamRef.current = stream;

    // ── áudio (fonte de verdade) ──
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      setBlob(new Blob(chunksRef.current, { type: mime || 'audio/webm' }));
    };
    recRef.current = rec;
    rec.start();

    // ── transcrição (rascunho, best-effort) ──
    const Ctor = speechCtor();
    if (Ctor) {
      try {
        const sr = new Ctor();
        sr.lang = lang;
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (e) => {
          let fin = '';
          let inter = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]!;
            if (r.isFinal) fin += r[0].transcript;
            else inter += r[0].transcript;
          }
          if (fin) setTranscript((prev) => (prev ? `${prev} ${fin.trim()}` : fin.trim()));
          setInterim(inter);
        };
        // Chrome encerra sozinho após um tempo — religa enquanto estivermos gravando.
        sr.onend = () => { if (!stoppingRef.current) { try { sr.start(); } catch { /* noop */ } } };
        sr.onerror = () => { /* transcrição é opcional; o áudio segue */ };
        sr.start();
        srRef.current = sr;
      } catch { /* segue só com áudio */ }
    }

    setState('recording');
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) { stop(); return MAX_SECONDS; }
        return s + 1;
      });
    }, 1000);
  }, [lang, stop]);

  const reset = useCallback(() => {
    cleanup();
    stoppingRef.current = false;
    setState('idle'); setBlob(null); setTranscript(''); setInterim(''); setSeconds(0);
  }, [cleanup]);

  return { state, blob, transcript, interim, seconds, canTranscribe, start, stop, reset };
}

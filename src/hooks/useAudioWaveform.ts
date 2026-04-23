/**
 * Hook de waveform ao vivo via AudioContext — visualização do mic enquanto
 * o manager fala (push-to-talk). Retorna array de níveis 0-1 renderizável
 * como barras animadas.
 *
 * Ativa quando `active=true`; pede `getUserMedia` uma vez e solta o stream
 * ao desativar.
 */

import { useEffect, useState } from 'react';

const FREQ_BINS = 20;

export function useAudioWaveform(active: boolean): number[] {
  const [levels, setLevels] = useState<number[]>(() => new Array(FREQ_BINS).fill(0));

  useEffect(() => {
    if (!active) {
      setLevels(new Array(FREQ_BINS).fill(0));
      return;
    }
    let mounted = true;
    let raf = 0;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;

    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const Ctx: typeof AudioContext =
          (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
          (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
        audioCtx = new Ctx();
        // iOS Safari inicia o AudioContext em 'suspended' mesmo após gesto —
        // chama resume() dentro da cadeia do toque (push-to-talk) pra destravar.
        if (audioCtx.state === 'suspended') {
          try { await audioCtx.resume(); } catch { /* noop */ }
        }
        const src = audioCtx.createMediaStreamSource(s);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!mounted || !analyser) return;
          analyser.getByteFrequencyData(buf);
          const arr = new Array(FREQ_BINS).fill(0);
          const step = Math.floor(buf.length / FREQ_BINS) || 1;
          for (let i = 0; i < FREQ_BINS; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
              sum += buf[i * step + j] ?? 0;
            }
            arr[i] = Math.min(1, sum / (step * 255) * 1.8); // 1.8 = ganho visual
          }
          setLevels(arr);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Permissão negada ou sem mic — mantém levels zerados.
      }
    };

    void start();

    return () => {
      mounted = false;
      if (raf) cancelAnimationFrame(raf);
      if (audioCtx) {
        try { void audioCtx.close(); } catch { /* noop */ }
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return levels;
}

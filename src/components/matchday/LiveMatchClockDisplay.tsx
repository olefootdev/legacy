import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { SECONDS_PER_TICK } from '@/engine/types';
import type { TacticalSimLoop } from '@/simulation/TacticalSimLoop';

/**
 * Relógio MM:SS isolado do resto da árvore — evita re-renderizar o campo2D a 60 Hz só por causa do cronómetro.
 * Modo tático: lê o tempo diretamente do `TacticalSimLoop` (alinhado ao sim).
 */
export const LiveMatchClockDisplay = memo(function LiveMatchClockDisplay({
  elapsedSec,
  frozen,
  phase,
  msPerMinute,
  tacticalLoopRef,
}: {
  elapsedSec: number;
  frozen: boolean;
  phase: string | undefined;
  /** Duração real (ms) de um “minuto de jogo” na UI — difere entre partida rápida e ao vivo 2D. */
  msPerMinute: number;
  tacticalLoopRef?: RefObject<TacticalSimLoop | null>;
}) {
  const [display, setDisplay] = useState('00:00');
  const baseRef = useRef({ wallMs: Date.now(), baseSec: 0 });

  useEffect(() => {
    baseRef.current = { wallMs: Date.now(), baseSec: elapsedSec };
  }, [elapsedSec]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let raf: number;
    const step = () => {
      if (frozen) {
        raf = requestAnimationFrame(step);
        return;
      }
      const loop = tacticalLoopRef?.current;
      if (loop) {
        const sec = Math.min(5400, loop.getFootballElapsedSecApprox());
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const next = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        setDisplay((prev) => (prev === next ? prev : next));
        raf = requestAnimationFrame(step);
        return;
      }
      const { wallMs, baseSec } = baseRef.current;
      const realElapsed = Date.now() - wallMs;
      const interpSec = Math.min(
        baseSec + (realElapsed / msPerMinute) * SECONDS_PER_TICK,
        5400,
      );
      const m = Math.floor(interpSec / 60);
      const s = Math.floor(interpSec % 60);
      const next = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      setDisplay((prev) => (prev === next ? prev : next));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen, phase, msPerMinute, tacticalLoopRef]);

  return <>{display}</>;
});

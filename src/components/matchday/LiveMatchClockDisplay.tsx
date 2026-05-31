import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { SECONDS_PER_TICK } from '@/engine/types';
import type { TacticalSimLoop } from '@/simulation/TacticalSimLoop';

/**
 * Relógio MM:SS isolado do resto da árvore — evita re-renderizar o campo2D a 60 Hz só por causa do cronómetro.
 * Modo tático: lê o tempo diretamente do `TacticalSimLoop` (alinhado ao sim).
 *
 * Fix do bug "volta no tempo" v2 (2026-05-30):
 *   • O RAF nunca avança mais de UM minuto além do snapshot — `interpSec`
 *     fica capeado em `baseSec + 60`. Se o tick atrasar (ex.: freeze
 *     condicional dessincronizou), o display "encosta" no próximo minuto
 *     e espera o snapshot, em vez de disparar pra frente e depois voltar.
 *   • Se `elapsedSec` mudar enquanto AINDA estamos em freeze, preservamos
 *     `frozenStartedAtRef` (a contagem do freeze atual continua válida).
 *     Sem isso, o snapshot atualizar mid-freeze (ex.: spiritOverlay setado
 *     junto com tick) zerava o acúmulo e o unfreeze posterior projetava
 *     o display pra frente.
 *   • `freezeUntilMs`: se o pai passar um wall-clock end-of-freeze, o RAF
 *     também respeita (sem depender de re-render do pai para descongelar).
 */
export const LiveMatchClockDisplay = memo(function LiveMatchClockDisplay({
  elapsedSec,
  frozen,
  phase,
  msPerMinute,
  tacticalLoopRef,
  freezeUntilMs,
}: {
  elapsedSec: number;
  frozen: boolean;
  phase: string | undefined;
  /** Duração real (ms) de um “minuto de jogo” na UI — difere entre partida rápida e ao vivo 2D. */
  msPerMinute: number;
  tacticalLoopRef?: RefObject<TacticalSimLoop | null>;
  /** Opcional: wall-clock (ms) até quando o motor está congelado por timer.
   *  Permite ao RAF respeitar o congelamento sem depender de re-render do pai. */
  freezeUntilMs?: number;
}) {
  const [display, setDisplay] = useState('00:00');
  const baseRef = useRef({ wallMs: Date.now(), baseSec: 0 });
  /** Tempo total (ms) já passado em freeze desde o último update de elapsedSec. */
  const frozenAccumMsRef = useRef(0);
  /** Quando o freeze atual começou (null se não congelado). */
  const frozenStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Snapshot atualizou — reset acúmulo, MAS preserva o freeze em curso.
    // Se ainda estamos frozen, o frozenStartedAt continua válido (a contagem
    // do freeze ATUAL não foi interrompida pelo update do snapshot). Sem
    // essa preservação, perdíamos a duração do freeze que coincidia com
    // updates de snapshot e o display projetava pra frente no unfreeze.
    baseRef.current = { wallMs: Date.now(), baseSec: elapsedSec };
    frozenAccumMsRef.current = 0;
    if (!frozen) {
      frozenStartedAtRef.current = null;
    } else if (frozenStartedAtRef.current === null) {
      frozenStartedAtRef.current = Date.now();
    } else {
      // Mantém o início do freeze, mas como wallMs foi reset agora,
      // o "tempo gasto em freeze desde o wallMs atual" começa agora.
      frozenStartedAtRef.current = Date.now();
    }
  }, [elapsedSec, frozen]);

  // Detecta transições frozen → unfrozen e acumula o tempo do freeze
  // (decremento aplicado no RAF).
  useEffect(() => {
    if (frozen) {
      if (frozenStartedAtRef.current === null) {
        frozenStartedAtRef.current = Date.now();
      }
    } else {
      if (frozenStartedAtRef.current !== null) {
        frozenAccumMsRef.current += Date.now() - frozenStartedAtRef.current;
        frozenStartedAtRef.current = null;
      }
    }
  }, [frozen]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let raf: number;
    const step = () => {
      // Freeze efetivo: prop `frozen` OU wall-clock ainda dentro do freeze.
      // Isso evita interpolar quando o pai está com `frozen` desatualizado
      // (state-derived) e o freeze já expirou; e vice-versa.
      const wallFrozen = freezeUntilMs != null && Date.now() < freezeUntilMs;
      if (frozen || wallFrozen) {
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
      const realElapsed = Math.max(0, Date.now() - wallMs - frozenAccumMsRef.current);
      const linearSec = baseSec + (realElapsed / msPerMinute) * SECONDS_PER_TICK;
      // FIX time-travel: nunca extrapolar mais que UM minuto além do snapshot.
      // Se o tick atrasar (freeze desincronizado, drift do setInterval, etc.),
      // o display "encosta" no próximo minuto e espera — não dispara pra
      // frente correndo o risco de voltar quando o snapshot finalmente vier.
      const capForward = baseSec + SECONDS_PER_TICK;
      const interpSec = Math.min(linearSec, capForward, 5400);
      const m = Math.floor(interpSec / 60);
      const s = Math.floor(interpSec % 60);
      const next = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      setDisplay((prev) => (prev === next ? prev : next));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen, phase, msPerMinute, tacticalLoopRef, freezeUntilMs]);

  return <>{display}</>;
});

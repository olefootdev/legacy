import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { SECONDS_PER_TICK } from '@/engine/types';
import type { TacticalSimLoop } from '@/simulation/TacticalSimLoop';

/**
 * Relógio MM:SS isolado do resto da árvore — evita re-renderizar o campo2D a 60 Hz só por causa do cronómetro.
 * Modo tático: lê o tempo diretamente do `TacticalSimLoop` (alinhado ao sim).
 *
 * Estratégia anti-time-travel (v3 — 2026-05-30 noite):
 *   1. **Guarda de monotonicidade** (linha de defesa principal): rastreamos
 *      `monotonicSecRef` — o maior valor já mostrado. O display NUNCA exibe
 *      menos que isso. Não importa qual desvio aconteça (snapshot recuando,
 *      freeze dessincronizado, cap quebrando, drift do RAF), o relógio só
 *      avança. A versão anterior (v2) tentou capar em `baseSec+60` mas isso
 *      criava patamares estranhos quando o tick atrasava — o display
 *      "encostava" no próximo minuto e parecia voltar quando o snapshot
 *      finalmente chegava com baseSec menor. A guarda de monotonicidade
 *      cobre todos os casos sem patamar artificial.
 *   2. **Preserva acúmulo de freeze entre updates de snapshot**: snapshot
 *      atualizando mid-freeze (ex.: spiritOverlay setado junto com o tick)
 *      não pode zerar `frozenAccumMs` — senão o unfreeze posterior projeta
 *      o display pra frente.
 *   3. **`freezeUntilMs` no RAF**: respeita wall-clock sem depender de
 *      re-render do pai (evita lag entre o freeze acabar e o pai re-render
 *      com o `frozen` prop atualizado).
 *   4. **Reset de monotonicidade quando phase muda pra 'playing'**: nova
 *      partida volta o display pra 00:00.
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
  /** Maior valor (segundos) já mostrado. Garante monotonicidade do display. */
  const monotonicSecRef = useRef(0);

  // Reset de monotonicidade quando phase entra em 'playing' (nova partida).
  // Sem isso, uma partida nova começaria mostrando o tempo da anterior.
  useEffect(() => {
    if (phase === 'playing' && elapsedSec === 0) {
      monotonicSecRef.current = 0;
      setDisplay('00:00');
    }
  }, [phase, elapsedSec]);

  useEffect(() => {
    // Snapshot atualizou — re-baseline. Preserva acúmulo de freeze se
    // ainda estamos congelados (a contagem do freeze ATUAL continua válida
    // até o unfreeze; só zeramos `frozenAccumMs` porque o `wallMs` reset
    // já abrange tudo até agora).
    baseRef.current = { wallMs: Date.now(), baseSec: elapsedSec };
    frozenAccumMsRef.current = 0;
    if (!frozen) {
      frozenStartedAtRef.current = null;
    } else {
      // Ainda em freeze após snapshot mudar: re-stamp o início do freeze
      // pra contar APENAS do novo wallMs (acúmulo zerado).
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
      const wallFrozen = freezeUntilMs != null && Date.now() < freezeUntilMs;
      if (frozen || wallFrozen) {
        raf = requestAnimationFrame(step);
        return;
      }
      const loop = tacticalLoopRef?.current;
      let secCandidate: number;
      if (loop) {
        secCandidate = Math.min(5400, loop.getFootballElapsedSecApprox());
      } else {
        const { wallMs, baseSec } = baseRef.current;
        const realElapsed = Math.max(0, Date.now() - wallMs - frozenAccumMsRef.current);
        const linearSec = baseSec + (realElapsed / msPerMinute) * SECONDS_PER_TICK;
        secCandidate = Math.min(linearSec, 5400);
      }
      // ───── Guarda de monotonicidade (linha de defesa principal) ─────
      // Não importa o que `secCandidate` calcule, o display nunca regride.
      // Resolve TODOS os casos de "voltou alguns segundos":
      //  • snapshot tarda → display avança mas não volta quando snapshot vem
      //  • freeze dessincronizado → mesmo se o cálculo der menor, ignora
      //  • drift de RAF/setInterval → suaviza sem patamar artificial
      if (secCandidate < monotonicSecRef.current) {
        secCandidate = monotonicSecRef.current;
      } else {
        monotonicSecRef.current = secCandidate;
      }
      const m = Math.floor(secCandidate / 60);
      const s = Math.floor(secCandidate % 60);
      const next = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      setDisplay((prev) => (prev === next ? prev : next));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen, phase, msPerMinute, tacticalLoopRef, freezeUntilMs]);

  return <>{display}</>;
});

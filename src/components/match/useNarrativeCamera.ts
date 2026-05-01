/**
 * useNarrativeCamera — câmera orientada à intenção + tensão.
 *
 * Em vez de seguir a bola, a câmera lê o contexto:
 * - tensionLevel (0–100): proximidade do gol, atacantes no último terço, evento recente.
 * - target: bola + antecipação na direção do ataque + leve drift lateral.
 * - inércia: lerp por rAF (snappy em momento crítico, suave em jogo neutro).
 *
 * Aplica transform direto no DOM via ref → zero re-render do FieldView (que é caro).
 */
import { useEffect, useRef } from 'react';
import type { PitchPlayerState } from '@/engine/types';

interface NarrativeCameraInput {
  ballX: number;       // 0..100 — comprimento (0 = gol home, 100 = gol away)
  ballY: number;       // 0..100 — largura
  possession: 'home' | 'away';
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  lastEvent: string | null;
}

export function useNarrativeCamera(
  ref: React.RefObject<HTMLDivElement | null>,
  input: NarrativeCameraInput,
) {
  const inputRef = useRef(input);
  inputRef.current = input;

  // Estado interpolado (não vira state — evita re-render)
  const stateRef = useRef({ panX: 0, panY: 0, zoom: 1, tension: 0 });

  useEffect(() => {
    if (!ref.current) return;
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp para evitar saltos após tab inativa
      lastTime = now;

      const inp = inputRef.current;
      const ballX = inp.ballX;

      // ── Modelo de tensão (0–100) ────────────────────────────────────────
      let target = 0;
      const dir = inp.possession === 'home' ? 1 : -1;

      if (inp.possession === 'home') {
        // Time atacando — tensão sobe perto do gol away (ballX alto)
        if (ballX > 65) target += 25;
        if (ballX > 80) target += 25;
        if (ballX > 90) target += 15;
        const attackersHigh = inp.homePlayers.filter((p) => p.x > 60).length;
        target += Math.min(20, attackersHigh * 4);
      } else {
        // Sob ataque — tensão sobe perto do gol home (ballX baixo)
        if (ballX < 35) target += 25;
        if (ballX < 20) target += 25;
        if (ballX < 10) target += 15;
        const attackersDeep = inp.awayPlayers.filter((p) => p.x < 40).length;
        target += Math.min(20, attackersDeep * 4);
      }

      // Eventos disparam picos (decaem naturalmente via lerp)
      const ev = inp.lastEvent;
      if (ev === 'shot' || ev === 'rebound') target += 25;
      if (ev === 'goal') target = 100;

      target = Math.max(0, Math.min(100, target));

      // ── Câmera-alvo ─────────────────────────────────────────────────────
      // Pan vertical: profundidade da bola + antecipação na direção do ataque
      const tNorm = target / 100;
      const anticipation = dir * tNorm * 4; // até 4% adiante na direção do ataque
      const targetPanY = (ballX - 50) * 0.20 + anticipation;

      // Pan lateral: leve drift na direção da bola (deixa espaço no lado oposto = profundidade)
      const targetPanX = (inp.ballY - 50) * 0.08;

      // Zoom: cresce com tensão (1.0 → 1.18)
      const targetZoom = 1.0 + tNorm * 0.18;

      // ── Inércia (lerp) ──────────────────────────────────────────────────
      // Mais rápido em tensão alta (snappy em finalização), mais lento em jogo neutro.
      const baseSpeed = 1.4 + tNorm * 1.6;        // 1.4..3.0 /s
      const a = 1 - Math.exp(-baseSpeed * dt);
      const aZoom = 1 - Math.exp(-(baseSpeed * 0.7) * dt); // zoom ainda mais lento (peso visual)
      const aTension = 1 - Math.exp(-2.5 * dt);

      const cur = stateRef.current;
      cur.panX = cur.panX + (targetPanX - cur.panX) * a;
      cur.panY = cur.panY + (targetPanY - cur.panY) * a;
      cur.zoom = cur.zoom + (targetZoom - cur.zoom) * aZoom;
      cur.tension = cur.tension + (target - cur.tension) * aTension;

      // ── Aplica direto no DOM ────────────────────────────────────────────
      const el = ref.current;
      if (el) {
        el.style.transform = `translate(${cur.panX.toFixed(3)}%, ${cur.panY.toFixed(3)}%) scale(${cur.zoom.toFixed(4)})`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);

  return stateRef;
}

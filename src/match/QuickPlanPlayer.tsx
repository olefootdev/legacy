/**
 * QuickPlanPlayer — renderiza um MatchPlan pré-computado em ~25s.
 *
 * Em vez do loop tick-by-tick de 90s, este player avança por uma timeline
 * de eventos onde cada um dura `TIER_ANIMATION_MS[weight_tier]`:
 *   • epic   — 3.5s (banner cinematográfico com flash)
 *   • big    — 1.8s (banner médio destacado)
 *   • normal — 0.5s (toast lateral discreto)
 *   • minor  — 0.15s (badge passageira)
 *
 * O placar atualiza progressivamente conforme os eventos vão sendo "lidos".
 * Quando o último evento expira, o componente chama `onComplete(plan)`.
 *
 * Filosofia: a Partida Rápida fica como um trailer narrativo do match plan —
 * cada momento decisivo ganha respiro, cada minuto sem ação passa rápido.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MatchPlan, MatchEventTier } from './quickPlanTypes';
import { TIER_ANIMATION_MS } from './quickPlanTypes';

interface Props {
  plan: MatchPlan;
  onComplete?: (plan: MatchPlan) => void;
  /** Reduz duração total se o user quiser ainda mais rápido (default 1.0). */
  speedMultiplier?: number;
}

interface PlayedEvent {
  index: number;
  startedAtMs: number;
  durationMs: number;
}

const TIER_STYLE: Record<MatchEventTier, { badge: string; color: string; bg: string }> = {
  epic: { badge: '🔥 MOMENTO ÉPICO', color: 'text-rose-200', bg: 'bg-rose-500/20 border-rose-400/40' },
  big: { badge: 'AÇÃO', color: 'text-amber-200', bg: 'bg-amber-500/20 border-amber-400/40' },
  normal: { badge: '', color: 'text-white/85', bg: 'bg-zinc-800/80 border-zinc-700/60' },
  minor: { badge: '', color: 'text-white/60', bg: 'bg-zinc-900/60 border-zinc-800/50' },
};

export function QuickPlanPlayer({ plan, onComplete, speedMultiplier = 1.0 }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [done, setDone] = useState(false);
  const completedRef = useRef(false);

  const timeline = useMemo(() => {
    let acc = 0;
    return plan.events.map<PlayedEvent>((e, idx) => {
      const dur = TIER_ANIMATION_MS[e.weight_tier] / speedMultiplier;
      const entry = { index: idx, startedAtMs: acc, durationMs: dur };
      acc += dur;
      return entry;
    });
  }, [plan, speedMultiplier]);

  const totalDuration = useMemo(
    () => timeline.reduce((s, t) => s + t.durationMs, 0),
    [timeline],
  );

  useEffect(() => {
    // Agenda updates de placar nos minutos de gol
    const timers: number[] = [];
    plan.events.forEach((e, idx) => {
      const entry = timeline[idx]!;
      timers.push(
        window.setTimeout(() => {
          setCurrentIdx(idx);
          if (e.kind === 'goal_home') setHomeScore((s) => s + 1);
          if (e.kind === 'goal_away') setAwayScore((s) => s + 1);
        }, entry.startedAtMs),
      );
    });
    // Final
    timers.push(
      window.setTimeout(() => {
        setDone(true);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(plan);
        }
      }, totalDuration + 500),
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [plan, timeline, totalDuration, onComplete]);

  const currentEvent = plan.events[currentIdx];
  const currentMinute = currentEvent?.minute ?? 0;

  // Progress 0–1 da partida (baseado no minuto do evento atual)
  const progress = Math.min(1, currentMinute / 90);

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-deep-black border border-amber-400/30 rounded-sm overflow-hidden">
      {/* Header: placar + minuto */}
      <div className="px-5 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="font-display uppercase tracking-[0.18em] text-[11px] font-black text-white/75"
          >
            {plan.home_short}
          </span>
          <span
            className="font-serif italic text-3xl text-white tabular-nums"
            style={{ fontFamily: 'var(--font-serif-hero)' }}
          >
            {homeScore}
          </span>
          <span className="text-white/30 text-xl">–</span>
          <span
            className="font-serif italic text-3xl text-white tabular-nums"
            style={{ fontFamily: 'var(--font-serif-hero)' }}
          >
            {awayScore}
          </span>
          <span
            className="font-display uppercase tracking-[0.18em] text-[11px] font-black text-white/75"
          >
            {plan.away_short}
          </span>
        </div>
        <span
          className="font-display tabular-nums text-amber-300 text-sm font-bold"
        >
          {currentMinute}&prime;
        </span>
      </div>

      {/* Progress bar do tempo de jogo */}
      <div className="h-0.5 bg-zinc-900">
        <motion.div
          className="h-full bg-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: 'linear', duration: 0.3 }}
        />
      </div>

      {/* Evento atual (overlay grande pra epic/big, lateral pra normal/minor) */}
      <div className="min-h-[200px] sm:min-h-[260px] p-5 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentEvent && !done && (
            <motion.div
              key={`event-${currentIdx}`}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={`w-full border-l-[3px] px-4 py-4 ${TIER_STYLE[currentEvent.weight_tier].bg}`}
            >
              {TIER_STYLE[currentEvent.weight_tier].badge && (
                <p
                  className={`font-display uppercase tracking-[0.32em] text-[9px] font-black mb-2 ${TIER_STYLE[currentEvent.weight_tier].color}`}
                >
                  {TIER_STYLE[currentEvent.weight_tier].badge}
                </p>
              )}
              <p
                className={`${TIER_STYLE[currentEvent.weight_tier].color} ${
                  currentEvent.weight_tier === 'epic'
                    ? 'text-xl sm:text-2xl font-bold leading-snug'
                    : currentEvent.weight_tier === 'big'
                    ? 'text-base sm:text-lg font-semibold leading-tight'
                    : 'text-sm leading-snug'
                }`}
              >
                {currentEvent.text}
              </p>
              {currentEvent.xg && currentEvent.xg > 0.15 && (
                <p
                  className={`font-display uppercase tracking-[0.18em] text-[9px] mt-2 ${
                    currentEvent.weight_tier === 'epic'
                      ? 'text-rose-200/70'
                      : 'text-amber-200/70'
                  }`}
                >
                  xG {currentEvent.xg.toFixed(2)}
                </p>
              )}
            </motion.div>
          )}
          {done && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p
                className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-amber-300 mb-2"
              >
                Apito final · {plan.narrative_arc.replace('_', ' ')}
              </p>
              <p
                className="font-serif italic text-3xl sm:text-4xl text-white"
                style={{ fontFamily: 'var(--font-serif-hero)' }}
              >
                {homeScore} – {awayScore}
              </p>
              {plan.mvp_projection && (
                <p className="text-[12px] text-white/70 mt-3">
                  MVP: <span className="text-amber-300 font-bold">{plan.mvp_projection.name}</span> · nota {plan.mvp_projection.rating.toFixed(1)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer com momentum (perspectiva home) */}
      <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-display uppercase tracking-[0.2em] text-white/40">
            Momento
          </span>
          <div className="flex-1 h-1 bg-zinc-900 relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-amber-400"
              initial={{ width: '50%' }}
              animate={{
                width: `${plan.momentum_curve[Math.min(89, currentMinute)] ?? 50}%`,
              }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

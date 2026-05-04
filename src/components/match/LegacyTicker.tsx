import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type EventKind =
  | 'narrative'
  | 'goal_home'
  | 'goal_away'
  | 'whistle'
  | 'sub'
  | 'yellow_home'
  | 'red_home'
  | 'yellow_away'
  | 'red_away'
  | 'injury_home'
  | 'penalty_start'
  | 'penalty_result'
  | 'shot_home'
  | 'shot_away'
  | string;

export interface TickerEvent {
  id: string;
  text: string;
  kind?: EventKind;
}

interface LegacyTickerProps {
  homeShort: string;
  awayShort: string;
  homeScore: number;
  awayScore: number;
  events: TickerEvent[];
  /** ms entre cada evento. Default 420 */
  intervalMs?: number;
  onComplete?: () => void;
}

const NEON = '#FDE100';

function kindMeta(kind?: EventKind): { icon: string; color: string; pause: number } {
  switch (kind) {
    case 'goal_home':
    case 'goal_away':
      return { icon: '⚽', color: NEON, pause: 1400 };
    case 'yellow_home':
    case 'yellow_away':
      return { icon: '🟨', color: '#facc15', pause: 600 };
    case 'red_home':
    case 'red_away':
      return { icon: '🟥', color: '#ef4444', pause: 800 };
    case 'penalty_start':
      return { icon: '🎯', color: NEON, pause: 1000 };
    case 'penalty_result':
      return { icon: '🥅', color: '#a3e635', pause: 700 };
    case 'shot_home':
    case 'shot_away':
      return { icon: '💨', color: '#94a3b8', pause: 300 };
    case 'whistle':
      return { icon: '📣', color: '#cbd5e1', pause: 500 };
    case 'sub':
      return { icon: '🔄', color: '#7dd3fc', pause: 400 };
    case 'injury_home':
      return { icon: '🩹', color: '#fb923c', pause: 600 };
    default:
      return { icon: '·', color: '#64748b', pause: 0 };
  }
}

function isGoal(kind?: EventKind) {
  return kind === 'goal_home' || kind === 'goal_away';
}

export function LegacyTicker({
  homeShort,
  awayShort,
  homeScore,
  awayScore,
  events,
  intervalMs = 420,
  onComplete,
}: LegacyTickerProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const timerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleCount >= events.length) {
      onComplete?.();
      return;
    }

    const next = events[visibleCount];
    const { pause } = kindMeta(next?.kind);
    const delay = intervalMs + pause;

    timerRef.current = window.setTimeout(() => {
      if (isGoal(next?.kind)) {
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      }
      setVisibleCount((c) => c + 1);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visibleCount, events, intervalMs, onComplete]);

  // auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const visible = events.slice(0, visibleCount);
  const progress = events.length > 0 ? visibleCount / events.length : 0;

  return (
    <div className="glass-panel border border-white/10 overflow-hidden">
      {/* Scoreboard */}
      <div
        className="relative flex items-center justify-center gap-6 px-6 py-4 transition-colors duration-300"
        style={{ background: flash ? 'rgba(253,225,0,0.12)' : 'transparent' }}
      >
        <span className="font-display font-black text-sm uppercase tracking-widest text-gray-300 min-w-[3rem] text-right">
          {homeShort}
        </span>
        <span
          className="font-display font-black text-3xl tabular-nums transition-colors duration-300"
          style={{ color: flash ? NEON : 'white' }}
        >
          {homeScore}
          <span className="mx-2 text-gray-500">×</span>
          {awayScore}
        </span>
        <span className="font-display font-black text-sm uppercase tracking-widest text-gray-300 min-w-[3rem] text-left">
          {awayShort}
        </span>

        {/* progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
          <motion.div
            className="h-full"
            style={{ background: NEON }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Event feed */}
      <div
        ref={listRef}
        className="h-56 overflow-y-auto px-4 py-3 space-y-1 scrollbar-none"
        style={{ scrollBehavior: 'smooth' }}
      >
        <AnimatePresence initial={false}>
          {visible.map((ev) => {
            const { icon, color } = kindMeta(ev.kind);
            const goal = isGoal(ev.kind);
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex items-start gap-2 ${goal ? 'py-1' : ''}`}
              >
                <span className="shrink-0 text-sm leading-5">{icon}</span>
                <p
                  className={`text-xs leading-5 ${goal ? 'font-bold' : 'text-gray-400'}`}
                  style={{ color: goal ? color : undefined }}
                >
                  {ev.text}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visibleCount < events.length && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-1 h-1 rounded-full bg-neon-yellow animate-pulse" />
            <span className="w-1 h-1 rounded-full bg-neon-yellow animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-1 rounded-full bg-neon-yellow animate-pulse [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  );
}

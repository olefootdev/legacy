/**
 * Card de decisão INLINE no feed (quick-match-revolution.md §12 — o pivot
 * validado jogando: os botões viram parte do item do feed, não um takeover
 * full-screen). Reusa `QuickInteractiveMoment` (mesmas choices/atributos do
 * overlay antigo) — só muda a apresentação: compacto, fixado no topo do feed,
 * com timer de pressão e auto-pick herdado do efeito de timeout do MatchQuick.
 *
 * Takeover full-screen fica reservado ao clímax (gol/vermelho).
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Zap, Shield, Target, Users } from 'lucide-react';
import type { QuickInteractiveMoment, QuickMomentType } from '@/match/quickInteractiveMoments';
import { cn } from '@/lib/utils';

interface Props {
  moment: QuickInteractiveMoment;
  onChoice: (choiceId: string) => void;
}

const ICON: Record<QuickMomentType, typeof Zap> = {
  counter_attack: Zap,
  set_piece: Target,
  defensive_choice: Shield,
  sub_timing: Users,
};

const LABEL: Record<QuickMomentType, string> = {
  counter_attack: 'Contra-ataque',
  set_piece: 'Bola parada',
  defensive_choice: 'Decisão defensiva',
  sub_timing: 'Substituição',
};

const TOTAL_MS = 5000;

export function QuickFeedDecisionCard({ moment, onChoice }: Props) {
  const [remaining, setRemaining] = useState(TOTAL_MS);
  const [selected, setSelected] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(null);
    const tick = () => {
      const left = Math.max(0, moment.triggeredAtMs + TOTAL_MS - Date.now());
      setRemaining(left);
      if (left > 0) rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [moment.id, moment.triggeredAtMs]);

  const Icon = ICON[moment.type];
  const seconds = Math.ceil(remaining / 1000);
  const pct = (remaining / TOTAL_MS) * 100;
  const urgent = remaining <= 1500;

  const handle = (choiceId: string) => {
    if (selected) return;
    setSelected(choiceId);
    window.setTimeout(() => onChoice(choiceId), 220);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-deep-black/95 shadow-[0_0_24px_rgba(234,255,0,0.18)]',
        urgent ? 'border-red-500/60' : 'border-neon-yellow/45',
      )}
      role="group"
      aria-label="Decisão da partida"
    >
      {/* Barra de tempo (pressão) */}
      <div className="absolute left-0 top-0 h-0.5 w-full bg-white/10">
        <div
          className={cn('h-full', urgent ? 'bg-red-500' : 'bg-neon-yellow')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-neon-yellow" />
          <span className="font-display text-[11px] font-black uppercase tracking-wide text-white truncate">
            {LABEL[moment.type]}
          </span>
          <span className="text-[10px] font-semibold text-white/40">{moment.minute}'</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className={cn('h-3 w-3', urgent ? 'text-red-400' : 'text-neon-yellow')} />
          <span
            className={cn(
              'font-display text-sm font-black tabular-nums',
              urgent ? 'animate-pulse text-red-400' : 'text-neon-yellow',
            )}
          >
            {seconds}s
          </span>
        </div>
      </div>

      <p className="px-3 py-1.5 text-[11px] leading-snug text-white/70">{moment.context}</p>

      <div className="grid grid-cols-2 gap-1.5 p-2.5 pt-1">
        {moment.choices.map((choice) => {
          const best = moment.choices.every((c) => choice.successChance >= c.successChance);
          return (
            <motion.button
              key={choice.id}
              type="button"
              onClick={() => handle(choice.id)}
              disabled={selected !== null}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                selected === choice.id
                  ? 'border-neon-yellow bg-neon-yellow/10'
                  : selected
                    ? 'border-white/8 bg-black/30 opacity-40'
                    : 'border-white/12 bg-black/40 hover:border-neon-yellow/50 hover:bg-black/60',
                best && !selected && urgent && 'animate-pulse',
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    'font-display text-[12px] font-bold uppercase tracking-tight truncate',
                    selected === choice.id ? 'text-neon-yellow' : 'text-white',
                  )}
                >
                  {choice.label}
                </span>
                <span className="shrink-0 rounded bg-white/10 px-1 text-[10px] font-bold text-white/80 tabular-nums">
                  {Math.round(choice.successChance * 100)}%
                </span>
              </span>
              <span className="text-[10px] leading-tight text-white/55 line-clamp-2">{choice.description}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * QuickMatchFeed — Feed de eventos ao vivo com rich text highlighting.
 *
 * Padrão visual:
 * - Border-left colorido por tipo de evento (gol amarelo, cartão vermelho, etc.)
 * - Nomes de jogadores/times destacados em bold com cor do lado
 * - Rotação automática dos 3 eventos visíveis (pool de 14)
 * - Animação de entrada suave (fade + slide)
 */

import { motion, AnimatePresence } from 'motion/react';
import type { MatchEventEntry } from '@/engine/types';
import { quickFeedLineClass, renderQuickFeedRichText } from '@/match/quickMatchFeed';
import { cn } from '@/lib/utils';

interface QuickMatchFeedProps {
  events: MatchEventEntry[];
  homeShort: string;
  awayShort: string;
  homeNames: string[];
  awayNames: string[];
}

export function QuickMatchFeed({
  events,
  homeShort,
  awayShort,
  homeNames,
  awayNames,
}: QuickMatchFeedProps) {
  if (events.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="border border-dashed border-white/10 bg-deep-black/40 px-4 py-8 text-center" style={{ borderRadius: 'var(--radius-md)' }}>
          <p
            className="text-white/35 uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.22em',
            }}
          >
            Aguardando eventos...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      {/* Eyebrow */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <span aria-hidden className="h-px w-8 bg-neon-yellow/40" />
        <span
          className="text-neon-yellow uppercase tracking-[0.35em] text-[10px] font-medium"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          Ao vivo
        </span>
        <span aria-hidden className="h-px w-8 bg-neon-yellow/40" />
      </div>

      {/* Feed de eventos */}
      <AnimatePresence mode="popLayout">
        {events.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className={cn(
              'px-3 py-2.5 sm:px-4 sm:py-3 bg-deep-black/60 backdrop-blur-sm',
              quickFeedLineClass(ev.kind),
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <div className="flex items-start gap-2">
              {/* Minuto — destaque extra para gols/cartões */}
              {ev.minute != null && (
                <span
                  className={cn(
                    'shrink-0 tabular-nums font-bold',
                    (ev.kind === 'goal_home' || ev.kind === 'goal_away' || ev.kind === 'red_home' || ev.kind === 'red_away') ? 'text-neon-yellow' : 'text-neon-yellow/70'
                  )}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: (ev.kind === 'goal_home' || ev.kind === 'goal_away' || ev.kind === 'red_home' || ev.kind === 'red_away') ? '12px' : '11px',
                    letterSpacing: '0.04em',
                    fontWeight: (ev.kind === 'goal_home' || ev.kind === 'goal_away' || ev.kind === 'red_home' || ev.kind === 'red_away') ? 900 : 700,
                  }}
                >
                  {ev.minute}'
                </span>
              )}

              {/* Texto com rich highlighting */}
              <p
                className="flex-1 min-w-0 text-white/85 leading-relaxed"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                {renderQuickFeedRichText(ev.text, {
                  homeShort,
                  awayShort,
                  homeNames,
                  awayNames,
                  homeClassName: 'text-neon-yellow',
                  awayClassName: 'text-white',
                })}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

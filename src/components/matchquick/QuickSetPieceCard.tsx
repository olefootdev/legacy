/**
 * Card SIMPLES de bola parada (quick-match-revolution.md §4 — botões simples).
 *
 * Substitui o LiveSetPieceManager (multi-step, "impossível de bater"). Aqui é
 * 1 TOQUE: o melhor batedor já vem escolhido, o manager só decide a ENTREGA
 * (3 botões), com % honesto por atributo e auto-pick no estouro. Resolve pelo
 * mesmo RESOLVE_SET_PIECE (gol/defesa de verdade) — só a UI ficou simples.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Target, Crosshair, Repeat } from 'lucide-react';
import type {
  SetPieceChoice,
  SetPieceContext,
  SetPieceTaker,
  SetPieceTarget,
} from '@/components/setpiece';
import { cn } from '@/lib/utils';

interface Props {
  ctx: SetPieceContext;
  onResolve: (choice: SetPieceChoice) => void;
  pickSeconds?: number;
}

interface Option {
  type: SetPieceChoice['type'];
  label: string;
  desc: string;
  icon: typeof Target;
  goalPct: number;
  safe?: boolean;
}

function clampPct(p: number): number {
  return Math.max(2, Math.min(95, Math.round(p * 100)));
}

/** Mesma régua do handleResolve (SetPieceModal) — % honesto por atributo. */
function buildOptions(ctx: SetPieceContext, taker?: SetPieceTaker, target?: SetPieceTarget): Option[] {
  const takerS = taker?.skillRating ?? 55;
  const targetS = target?.skillRating ?? 55;
  if (ctx.mode === 'corner') {
    const combined = (takerS + targetS) / 2;
    const cross = (combined / 100) * 0.22;
    return [
      { type: 'near_post', label: 'Primeiro pau', desc: 'Cruzamento tenso na frente', icon: Target, goalPct: clampPct(cross) },
      { type: 'far_post', label: 'Segundo pau', desc: 'Bola alta no outro lado', icon: Crosshair, goalPct: clampPct(cross * 0.95) },
      { type: 'short', label: 'Tocar curto', desc: 'Mantém a posse, sem risco', icon: Repeat, goalPct: 4, safe: true },
    ];
  }
  const dist = ctx.distance ?? 22;
  const distFactor = Math.max(0.05, 1 - (dist - 18) / 22);
  const shot = (takerS / 100) * 0.32 * distFactor;
  const combined = (takerS + targetS) / 2;
  const cross = (combined / 100) * 0.22;
  return [
    { type: 'direct_shot', label: 'Chutar no gol', desc: `Falta direta · ${Math.round(dist)}m`, icon: Target, goalPct: clampPct(shot) },
    { type: 'cross', label: 'Cruzar na área', desc: 'Bola na cabeça do corredor', icon: Crosshair, goalPct: clampPct(cross) },
    { type: 'short_pass', label: 'Tocar curto', desc: 'Reinicia, segura a posse', icon: Repeat, goalPct: 4, safe: true },
  ];
}

export function QuickSetPieceCard({ ctx, onResolve, pickSeconds = 7 }: Props) {
  const taker = ctx.takers[0]; // já vem ordenado por skill desc
  const target = ctx.targets[0];
  const options = buildOptions(ctx, taker, target);

  const [remaining, setRemaining] = useState(pickSeconds * 1000);
  const [picked, setPicked] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);

  const resolve = (type: SetPieceChoice['type']) => {
    if (resolvedRef.current || !taker) return;
    resolvedRef.current = true;
    setPicked(type);
    const needsTarget = type === 'cross' || type === 'near_post' || type === 'far_post';
    window.setTimeout(
      () =>
        onResolve({
          mode: ctx.mode,
          takerId: taker.id,
          type,
          targetId: needsTarget ? target?.id : undefined,
          distance: ctx.distance,
          zone: ctx.zone,
        }),
      200,
    );
  };

  useEffect(() => {
    startRef.current = Date.now();
    const tick = () => {
      const left = Math.max(0, startRef.current + pickSeconds * 1000 - Date.now());
      setRemaining(left);
      if (left > 0) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else if (!resolvedRef.current) {
        // Auto-pick no estouro: opção segura (toque curto) — nunca trava.
        resolve(ctx.mode === 'corner' ? 'short' : 'short_pass');
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining <= 2000;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] flex justify-center px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        className={cn(
          'w-full max-w-md overflow-hidden rounded-2xl border bg-deep-black/95 shadow-[0_0_40px_rgba(234,255,0,0.22)] backdrop-blur',
          urgent ? 'border-red-500/60' : 'border-neon-yellow/50',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-br from-neon-yellow/10 to-transparent px-4 py-2.5">
          <div className="min-w-0">
            <div className="font-display text-sm font-black uppercase tracking-tight text-white">
              {ctx.mode === 'corner' ? 'Escanteio pra nós' : 'Falta perigosa'}
            </div>
            {taker && (
              <div className="text-[11px] text-white/55">
                Cobra <span className="font-bold text-neon-yellow">{taker.displayName}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1">
            <Clock className={cn('h-3.5 w-3.5', urgent ? 'text-red-400' : 'text-neon-yellow')} />
            <span
              className={cn(
                'font-display text-base font-black tabular-nums',
                urgent ? 'animate-pulse text-red-400' : 'text-neon-yellow',
              )}
            >
              {seconds}s
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-2.5">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.type}
                type="button"
                onClick={() => resolve(opt.type)}
                disabled={picked !== null}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors',
                  picked === opt.type
                    ? 'border-neon-yellow bg-neon-yellow/10'
                    : picked
                      ? 'border-white/8 bg-black/30 opacity-40'
                      : 'border-white/12 bg-black/40 hover:border-neon-yellow/50 hover:bg-black/60',
                )}
              >
                <Icon className={cn('h-5 w-5', opt.safe ? 'text-white/70' : 'text-neon-yellow')} />
                <span className="font-display text-[12px] font-bold uppercase leading-tight tracking-tight text-white">
                  {opt.label}
                </span>
                <span className="text-[9px] leading-tight text-white/50">{opt.desc}</span>
                <span
                  className={cn(
                    'mt-0.5 rounded px-1.5 text-[10px] font-bold tabular-nums',
                    opt.safe ? 'bg-white/10 text-white/70' : 'bg-neon-yellow/15 text-neon-yellow',
                  )}
                >
                  {opt.goalPct}% gol
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

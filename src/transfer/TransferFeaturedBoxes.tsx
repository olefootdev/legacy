/**
 * Grid de "boxes" em destaque — cards maiores que o carrossel, com foco
 * visual no retrato do jogador. Pensado pra complementar os carrosséis na
 * área de /transfer, dando pausa ao olhar.
 *
 * 6 jogadores em grid 2x3 (mobile 1 col, desktop 3 cols). Cada box mostra
 * retrato, OVR, nome, posição e preço de compra imediata.
 */

import { motion } from 'motion/react';
import { Trophy, Sparkles, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';

function formatBuyNow(p: MockAuctionPlayer): string {
  if (p.auctionCurrency === 'EXP') return `${p.buyNow.toLocaleString('pt-BR')} EXP`;
  // BRO armazenado em centavos.
  const bro = p.buyNow / 100;
  return `¢${bro.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
}

interface TransferFeaturedBoxesProps {
  title: string;
  subtitle?: string;
  players: MockAuctionPlayer[];
  onSelect: (player: MockAuctionPlayer) => void;
  /** Label do ícone/badge no topo (visual). */
  variant?: 'premium' | 'rising' | 'drop';
}

const VARIANT_STYLES: Record<NonNullable<TransferFeaturedBoxesProps['variant']>, {
  icon: typeof Trophy;
  badge: string;
  glow: string;
}> = {
  premium: {
    icon: Trophy,
    badge: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40',
    glow: 'shadow-[0_0_24px_rgba(234,255,0,0.08)]',
  },
  rising: {
    icon: Sparkles,
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.08)]',
  },
  drop: {
    icon: Gem,
    badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
    glow: 'shadow-[0_0_24px_rgba(217,70,239,0.08)]',
  },
};

export function TransferFeaturedBoxes({
  title, subtitle, players, onSelect, variant = 'premium',
}: TransferFeaturedBoxesProps) {
  if (players.length === 0) return null;
  const v = VARIANT_STYLES[variant];
  const Icon = v.icon;
  const shown = players.slice(0, 6);

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center gap-2.5 px-0.5">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', v.badge)}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-black uppercase tracking-widest text-white sm:text-base">
            {title}
          </h3>
          {subtitle ? <p className="text-[10px] leading-snug text-gray-500">{subtitle}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className={cn(
              'group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 p-0 text-left transition-colors hover:border-white/30',
              v.glow,
            )}
          >
            {/* Retrato */}
            <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-black to-white/5">
              {p.portraitSrc ? (
                <img
                  src={p.portraitSrc}
                  alt={p.name}
                  className="h-full w-full object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <p className="font-display text-5xl font-black italic text-white/10">
                    {p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </p>
                </div>
              )}

              {/* OVR no canto superior direito */}
              <div className="absolute right-2 top-2 rounded-md border border-white/20 bg-black/70 px-2 py-0.5 backdrop-blur">
                <p className="font-mono text-sm font-black text-white">{p.ovr}</p>
              </div>

              {/* Tag de marketKind (Genesis, etc) */}
              {p.marketKind === 'genesis' ? (
                <div className="absolute left-2 top-2">
                  <span className={cn('rounded-full border px-2 py-0.5 font-display text-[8px] font-black uppercase tracking-widest', v.badge)}>
                    Genesis
                  </span>
                </div>
              ) : null}

              {/* Gradiente inferior pra legibilidade */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 to-transparent" />
            </div>

            {/* Info */}
            <div className="space-y-2 p-3">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-black uppercase tracking-wider text-white">
                  {p.name}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">
                  {p.pos} · {p.nat} {p.style ? `· ${p.style}` : ''}
                </p>
              </div>

              <div className="flex items-end justify-between gap-2 border-t border-white/5 pt-2">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Compra imediata</p>
                  <p className="font-mono text-sm font-black text-white">
                    {formatBuyNow(p)}
                  </p>
                </div>
                <p className="text-[10px] text-gray-500">
                  {p.timeLeft}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

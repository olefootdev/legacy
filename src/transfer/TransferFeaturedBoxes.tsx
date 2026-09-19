/**
 * Grid de "boxes" em destaque — cards maiores que o carrossel, com foco
 * visual no retrato do jogador. Pensado pra complementar os carrosséis na
 * área de /transfer, dando pausa ao olhar.
 *
 * 6 jogadores em grid 2x3 (mobile 1 col, desktop 3 cols). Cada box mostra
 * retrato, OVR, nome, posição e preço de compra imediata.
 */

import { motion } from 'motion/react';
import { Hashtag, SecaoVolt } from '@/components/ui';
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
  /** Variantes visuais — hoje todas iguais (VOLT2: sem brilho; acento único = neon-yellow). */
  variant?: 'premium' | 'rising' | 'drop';
}

export function TransferFeaturedBoxes({
  title, subtitle, players, onSelect, variant = 'premium',
}: TransferFeaturedBoxesProps) {
  if (players.length === 0) return null;
  const shown = players.slice(0, 6);
  void variant;

  return (
    <section className="min-w-0 space-y-3">
      {/* Header — SecaoVolt (mesmo de "Destaques da semana") */}
      <SecaoVolt label={title} className="px-0.5">
        {subtitle ? <Hashtag>{subtitle}</Hashtag> : null}
      </SecaoVolt>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {shown.map((p, i) => (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="group relative overflow-hidden border border-[var(--color-border)] bg-dark-gray p-0 text-left transition-colors hover:border-neon-yellow/40"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {/* Retrato — aspect-square para manter proporção */}
            <div className="relative aspect-square w-full overflow-hidden bg-card">
              {p.portraitSrc ? (
                <img
                  src={p.portraitSrc}
                  alt={p.name}
                  className="h-full w-full object-cover object-[center_20%]"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <p
                    className="font-impact uppercase text-white/15"
                    style={{
                      fontSize: '3rem',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.1,
                    }}
                  >
                    {p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </p>
                </div>
              )}

              {/* OVR — Anton em etiqueta chapada (tabular nums) */}
              <div
                className="absolute right-2 top-2 border border-[var(--color-border)] bg-deep-black px-2.5 py-1"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <p
                  className="font-impact text-neon-yellow tabular-nums leading-none"
                  style={{
                    fontSize: '18px',
                  }}
                >
                  {p.ovr}
                </p>
              </div>

              {/* Tag Genesis — sistema (border-token + Agency caps) */}
              {p.marketKind === 'genesis' ? (
                <div className="absolute left-2 top-2">
                  <span
                    className="border border-neon-yellow/45 bg-deep-black text-neon-yellow uppercase px-2 py-0.5"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.22em',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Genesis
                  </span>
                </div>
              ) : null}

            </div>

            {/* Info — compacta para caber no square */}
            <div className="space-y-1.5 p-2.5">
              <div className="min-w-0">
                <p
                  className="truncate text-white uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {p.name}
                </p>
                <p
                  className="text-white/45 uppercase truncate"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    letterSpacing: '0.14em',
                  }}
                >
                  {p.pos} · {p.nat}
                </p>
              </div>

              <div className="flex items-end justify-between gap-2 border-t border-white/5 pt-1.5">
                <div className="min-w-0">
                  <p
                    className="text-white/45 uppercase"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '8px',
                      letterSpacing: '0.18em',
                      fontWeight: 600,
                    }}
                  >
                    Compra
                  </p>
                  <p
                    className="ole-num text-neon-yellow tabular-nums leading-none mt-0.5"
                    style={{
                      fontSize: '13px',
                    }}
                  >
                    {formatBuyNow(p)}
                  </p>
                </div>
                <p
                  className="text-white/45 shrink-0"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    letterSpacing: '0.04em',
                  }}
                >
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

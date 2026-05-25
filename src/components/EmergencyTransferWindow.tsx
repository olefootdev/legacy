/**
 * Mercado Emergencial — Janela de reforço após lesão grave (Legacy Tech).
 *
 * Aparece ao abrir o app (ou imediatamente após rodada) quando um titular
 * sofre lesão forte/gravíssima. Mostra 3 opções da mesma zona (posição)
 * do Genesis Market. Preço em EXP com markup de urgência (+30%).
 * One-shot: se dispensar, não volta.
 *
 * Visual segue DS §8.3 (Modal full-screen Legacy Tech):
 *   - Backdrop deep-black/95 + blur
 *   - Painel dark-gray border-l-[3px] danger (situação crítica)
 *   - Header com ícone, eyebrow Agency, headline Moret italic
 *   - Cards de candidato seguem view-player-card mini (OVR Moret + Nome Agency)
 *   - CTA primário amarelo dominante (não verde)
 *   - Footer: saldo Moret italic + link ghost "Dispensar"
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore, dispatchGame } from '@/game/store';
import { formatExp } from '@/systems/economy';
import {
  fetchGenesisMarketAuctionCards,
  fetchListedGenesisEntitiesByCatalogId,
} from '@/supabase/genesisMarket';
import { overallFromAttributes } from '@/entities/player';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import type { PlayerEntity, TacticalZone } from '@/entities/types';

const URGENCY_MARKUP = 1.3;

const ZONE_LABELS: Record<TacticalZone, string> = {
  gol: 'Goleiro',
  defesa: 'Defensor',
  lateral_esq: 'Lateral Esquerdo',
  lateral_dir: 'Lateral Direito',
  meio: 'Meio-campista',
  ataque: 'Atacante',
};

function zoneMatchesPos(zone: TacticalZone, pos: string): boolean {
  const p = pos.toUpperCase();
  switch (zone) {
    case 'gol':
      return p.includes('GOL') || p.includes('GK') || p === 'G';
    case 'defesa':
      return p.includes('ZAG') || p.includes('CB') || p.includes('DEF');
    case 'lateral_esq':
    case 'lateral_dir':
      return p.includes('LAT') || p.includes('LB') || p.includes('RB') || p.includes('WB');
    case 'meio':
      return (
        p.includes('MC') ||
        p.includes('MID') ||
        p.includes('VOL') ||
        p.includes('MEI') ||
        p.includes('CM') ||
        p.includes('CDM') ||
        p.includes('CAM')
      );
    case 'ataque':
      return (
        p.includes('ATA') ||
        p.includes('ST') ||
        p.includes('CF') ||
        p.includes('FW') ||
        p.includes('PTA') ||
        p.includes('PE') ||
        p.includes('PD') ||
        p.includes('LW') ||
        p.includes('RW')
      );
  }
}

interface CandidateCard {
  card: MockAuctionPlayer;
  entity: PlayerEntity;
  price: number;
}

function CandidateRow({
  candidate,
  oleBal,
  purchasing,
  onBuy,
}: {
  candidate: CandidateCard;
  oleBal: number;
  purchasing: string | null;
  onBuy: (c: CandidateCard) => void;
}) {
  const { card, price } = candidate;
  const canAfford = oleBal >= price;
  const isBuying = purchasing === card.genesisCatalogId;
  const ovrColor =
    card.ovr >= 85 ? 'text-neon-yellow' : card.ovr >= 75 ? 'text-white' : 'text-white/75';

  return (
    <motion.div
      whileHover={canAfford && !purchasing ? { y: -1 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'flex items-stretch gap-3 p-3 border border-l-[3px] bg-[var(--color-card)] transition-all',
        canAfford && !purchasing
          ? 'border-l-neon-yellow border-white/12 hover:border-neon-yellow/40'
          : 'border-l-white/15 border-white/8 opacity-70',
      )}
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      {/* OVR Moret + POS chip Agency */}
      <div className="shrink-0 w-12 flex flex-col items-center justify-center gap-1 self-center">
        <div
          className={cn('leading-none tabular-nums', ovrColor)}
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '-0.03em',
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {card.ovr}
        </div>
        <div
          className="px-1.5 py-0.5 bg-deep-black/60 border border-white/12 text-white/70"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '8px',
            letterSpacing: '0.22em',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {card.pos}
        </div>
      </div>

      {/* Nome + nat */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <span
          className="truncate text-white leading-tight"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '13px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {card.name}
        </span>
        <span
          className="text-white/50 truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          {card.nat}
        </span>
      </div>

      {/* CTA amarelo dominante (preço Moret italic) */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => onBuy(candidate)}
        disabled={!canAfford || !!purchasing}
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-3 py-2 transition-all',
          canAfford && !purchasing
            ? 'bg-neon-yellow text-deep-black hover:bg-white'
            : 'bg-white/5 text-white/35 cursor-not-allowed border border-white/8',
        )}
        style={{
          borderRadius: 'var(--radius-sm)',
          boxShadow:
            canAfford && !purchasing ? '0 8px 24px rgba(253,225,0,0.22)' : undefined,
        }}
        aria-label={`Comprar ${card.name} por ${formatExp(price)} EXP`}
      >
        {isBuying ? (
          <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : (
          <ShoppingCart size={11} />
        )}
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '-0.02em',
          }}
        >
          {formatExp(price)}
        </span>
      </motion.button>
    </motion.div>
  );
}

export function EmergencyTransferWindow() {
  const offer = useGameStore((s) => s.emergencyTransferOffers?.[0] ?? null);
  const oleBal = useGameStore((s) => s.finance.ole);
  const [candidates, setCandidates] = useState<CandidateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all([fetchGenesisMarketAuctionCards(), fetchListedGenesisEntitiesByCatalogId()]).then(
      ([cards, entities]) => {
        if (cancelled) return;
        const matching = cards.filter((c) => {
          if (!zoneMatchesPos(offer.zone, c.pos)) return false;
          return c.genesisCatalogId && entities[c.genesisCatalogId];
        });
        const shuffled = matching.sort(() => Math.random() - 0.5).slice(0, 3);
        setCandidates(
          shuffled.map((card) => ({
            card,
            entity: entities[card.genesisCatalogId!]!,
            price: Math.round((card.buyNow ?? card.currentBid) * URGENCY_MARKUP),
          })),
        );
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [offer]);

  // ESC fecha (DS §11)
  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatchGame({ type: 'DISMISS_EMERGENCY_TRANSFER' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offer]);

  if (!offer) return null;

  const handleDismiss = () => dispatchGame({ type: 'DISMISS_EMERGENCY_TRANSFER' });

  const handleBuy = (candidate: CandidateCard) => {
    if (oleBal < candidate.price) return;
    setPurchasing(candidate.card.genesisCatalogId ?? null);

    const { entity, card, price } = candidate;
    const mintOverall = card.mintOverall ?? overallFromAttributes(entity.attrs);

    dispatchGame({
      type: 'BUY_GENESIS_MARKET_PLAYER',
      player: entity,
      priceExp: price,
      genesisCatalogId: card.genesisCatalogId!,
      mintOverall,
    });

    setTimeout(() => {
      dispatchGame({ type: 'DISMISS_EMERGENCY_TRANSFER' });
      setPurchasing(null);
    }, 500);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={handleDismiss}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-deep-black/95 backdrop-blur p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Reforço Emergencial"
      >
        <motion.div
          initial={{ scale: 0.94, y: 18 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 18 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-[var(--color-card)] border border-l-[3px] border-l-[var(--color-danger)] border-white/12 overflow-hidden"
          style={{
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          }}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative px-5 py-5 border-b border-white/8 bg-[var(--color-danger)]/8">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 grid place-items-center bg-[var(--color-danger)]/15 text-[var(--color-danger)] border border-[var(--color-danger)]/30"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <ShieldAlert size={18} />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {/* Eyebrow Agency */}
                <div className="flex items-center gap-2">
                  <span aria-hidden className="block h-px w-6 bg-[var(--color-danger)]/55" />
                  <span
                    className="text-[var(--color-danger)]"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: '10px',
                      letterSpacing: '0.32em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Reforço Emergencial
                  </span>
                </div>
                {/* Headline Moret italic */}
                <h2
                  className="text-white leading-snug"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontWeight: 700,
                    fontSize: 'clamp(18px, 3vw, 22px)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {offer.injuredPlayerName} sofreu lesão grave
                </h2>
                {/* Submetadata Agency */}
                <p
                  className="text-white/55"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                  }}
                >
                  {ZONE_LABELS[offer.zone]} indisponível
                </p>
              </div>

              {/* Botão X */}
              <button
                onClick={handleDismiss}
                className="shrink-0 w-8 h-8 grid place-items-center text-white/45 hover:text-neon-yellow hover:bg-white/5 transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
                aria-label="Dispensar"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div className="px-5 py-4 space-y-3">
            <p
              className="text-white/60 leading-snug"
              style={{ fontFamily: 'var(--font-ui)', fontSize: '12px' }}
            >
              Contrate um substituto imediato com EXP. Preço de urgência{' '}
              <span className="text-[var(--color-danger)] font-semibold">+30%</span>.
            </p>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-white/15 border-t-neon-yellow rounded-full animate-spin" />
              </div>
            )}

            {!loading && candidates.length === 0 && (
              <div
                className="text-center py-6 px-4 bg-deep-black/40 border border-dashed border-white/12 text-white/45 italic"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                Nenhum jogador disponível para esta posição no momento.
              </div>
            )}

            {!loading &&
              candidates.map((candidate) => (
                <CandidateRow
                  key={candidate.card.id}
                  candidate={candidate}
                  oleBal={oleBal}
                  purchasing={purchasing}
                  onBuy={handleBuy}
                />
              ))}
          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          <div className="px-5 py-3.5 border-t border-white/8 bg-deep-black/40 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="text-white/45 shrink-0"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '9px',
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                }}
              >
                Saldo
              </span>
              <span
                className="text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '15px',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatExp(oleBal)}
              </span>
              <span
                className="text-white/40 shrink-0"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '9px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                EXP
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/55 hover:text-neon-yellow transition-colors shrink-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              Não, obrigado
            </button>
          </div>

          {/* ESC hint (DS §11 — mobile não tem ESC, ok ser desktop-only) */}
          <div
            className="hidden sm:block absolute bottom-1 right-3 text-white/25"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
            aria-hidden
          >
            ESC fecha
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

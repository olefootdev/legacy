/**
 * Mercado Emergencial — Janela de reforço após lesão grave (Legacy Tech).
 *
 * Aparece ao abrir o app (ou imediatamente após rodada) quando um titular
 * sofre lesão forte/gravíssima. Mostra 3 opções da mesma zona (posição)
 * do Genesis Market. Preço em EXP com markup de urgência (+30%).
 * One-shot: se dispensar, não volta.
 *
 * Visual DS 2027 "Respeito é ouro":
 *   - Fita de isolamento no topo (o momento "rua"), painel asfalto sem canto
 *   - Rótulo em prova (baixa = situação crítica), manchete Anton
 *   - Candidato: OVR na escada (OvrSelo), nome na voz (Pirata)
 *   - CTA rua com sombra dura de papel; footer com saldo em Anton
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FitaRua } from '@/components/ui/Rua';
import { OvrSelo } from '@/components/clube/escada';
import { useGameStore, dispatchGame } from '@/game/store';
import { formatExp } from '@/systems/economy';
import {
  fetchGenesisMarketAuctionCards,
  fetchListedGenesisEntitiesByCatalogId,
} from '@/supabase/genesisMarket';
import { overallFromAttributes } from '@/entities/player';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import type { PlayerEntity, TacticalZone } from '@/entities/types';
import { L } from '@/i18n/L';

const URGENCY_MARKUP = 1.3;

const ZONE_LABELS: Record<TacticalZone, string> = {
  gol: L('Goleiro', 'Goalkeeper'),
  defesa: L('Defensor', 'Defender'),
  lateral_esq: L('Lateral Esquerdo', 'Left Back'),
  lateral_dir: L('Lateral Direito', 'Right Back'),
  meio: L('Meio-campista', 'Midfielder'),
  ataque: L('Atacante', 'Forward'),
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

  return (
    <motion.div
      className={cn(
        'flex min-w-0 items-center gap-3 bg-concreto p-3 transition-colors',
        !(canAfford && !purchasing) && 'opacity-60',
      )}
    >
      {/* OVR na escada + posição */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <OvrSelo ovr={card.ovr} className="h-12 w-12 text-[26px]" />
        <span className="font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{card.pos}</span>
      </div>

      {/* Nome + nat */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="block min-w-0 truncate font-voz text-[22px] leading-none text-papel">{card.name}</span>
        <span className="block min-w-0 truncate font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{card.nat}</span>
      </div>

      {/* CTA — rua com sombra dura; preço em Anton */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => onBuy(candidate)}
        disabled={!canAfford || !!purchasing}
        className={cn(
          'mb-1 mr-1 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-3 font-impact text-[17px] leading-none transition-[transform,box-shadow]',
          canAfford && !purchasing
            ? 'bg-rua text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--color-papel)]'
            : 'cursor-not-allowed border-2 border-dashed border-fio text-mudo',
        )}
        aria-label={L(`Comprar ${card.name} por ${formatExp(price)} EXP`, `Buy ${card.name} for ${formatExp(price)} EXP`)}
      >
        {isBuying ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
        ) : (
          <ShoppingCart size={13} />
        )}
        <span className="tabular-nums">{formatExp(price)}</span>
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
    const mintOverall = card.mintOverall ?? overallFromAttributes(entity.attrs, entity.pos);

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
        className="fixed inset-0 z-[200] flex items-center justify-center bg-asfalto-27/95 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={L('Reforço Emergencial', 'Emergency Signing')}
      >
        <motion.div
          initial={{ scale: 0.94, y: 18 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 18 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden border-2 border-linha bg-asfalto-27"
        >
          {/* Fita de isolamento — o momento "rua": jogador caído, área isolada. */}
          <FitaRua tags={[L('#lesão', '#injury'), L('#reforço', '#signing'), L('#urgência', '#urgent')]} inclinacao={-2} className="py-2" />

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative border-b-2 border-linha px-5 pb-5 pt-3">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center border-2 border-baixa text-baixa">
                <ShieldAlert size={18} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-baixa">
                  — {L('Reforço Emergencial', 'Emergency Signing')}
                </span>
                <h2 className="font-impact text-[clamp(22px,6vw,28px)] uppercase leading-[1.02] text-papel">
                  {L(`${offer.injuredPlayerName} sofreu lesão grave`, `${offer.injuredPlayerName} suffered a serious injury`)}
                </h2>
                <p className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
                  {L(`${ZONE_LABELS[offer.zone]} indisponível`, `${ZONE_LABELS[offer.zone]} unavailable`)}
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="grid h-11 w-11 shrink-0 place-items-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
                aria-label={L('Dispensar', 'Dismiss')}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div className="space-y-2 px-5 py-4">
            <p className="font-voz text-[20px] leading-tight text-suave">
              {L('Substituto em EXP · urgência', 'Replacement in EXP · urgency')}{' '}
              <span className="font-prova text-[13px] font-bold text-baixa">+30%</span>
            </p>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-linha border-t-rua" />
              </div>
            )}

            {!loading && candidates.length === 0 && (
              <p className="border-2 border-dashed border-fio p-4 font-voz text-[20px] leading-tight text-suave">
                {L('Nenhum jogador disponível para esta posição no momento.', 'No players available for this position right now.')}
              </p>
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
          <div className="flex items-center justify-between gap-3 border-t-2 border-linha px-5 py-3.5">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Saldo', 'Balance')}</span>
              <span className="truncate font-impact text-[20px] leading-none text-papel tabular-nums">{formatExp(oleBal)}</span>
              <span className="shrink-0 font-prova text-[10px] font-bold uppercase text-mudo">EXP</span>
            </div>
            <button
              onClick={handleDismiss}
              className="inline-flex min-h-[44px] shrink-0 items-center font-impact text-[16px] uppercase text-mudo transition-colors hover:text-papel"
            >
              {L('Não, obrigado', 'No, thanks')}
            </button>
          </div>

          {/* ESC hint (desktop) */}
          <div className="absolute bottom-1 right-3 hidden font-prova text-[9px] uppercase tracking-[0.2em] text-fio sm:block" aria-hidden>
            {L('ESC fecha', 'ESC closes')}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

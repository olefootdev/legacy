/**
 * Mercado Emergencial — Janela de reforço após lesão grave na Liga Global.
 *
 * Aparece ao abrir o app (ou imediatamente após rodada) quando um titular
 * sofre lesão forte/gravíssima. Mostra 3 opções da mesma zona (posição)
 * do Genesis Market. Preço em EXP com markup de urgência (+30%).
 * One-shot: se dispensar, não volta.
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

const URGENCY_MARKUP = 1.3; // +30% sobre preço normal

const ZONE_LABELS: Record<TacticalZone, string> = {
  gol: 'Goleiro',
  defesa: 'Defensor',
  lateral_esq: 'Lateral Esquerdo',
  lateral_dir: 'Lateral Direito',
  meio: 'Meio-campista',
  ataque: 'Atacante',
};

/** Mapeia zone do jogador para posições compatíveis no catálogo Genesis (campo `pos`). */
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
      return p.includes('MC') || p.includes('MID') || p.includes('VOL') || p.includes('MEI') || p.includes('CM') || p.includes('CDM') || p.includes('CAM');
    case 'ataque':
      return p.includes('ATA') || p.includes('ST') || p.includes('CF') || p.includes('FW') || p.includes('PTA') || p.includes('PE') || p.includes('PD') || p.includes('LW') || p.includes('RW');
  }
}

interface CandidateCard {
  card: MockAuctionPlayer;
  entity: PlayerEntity;
  price: number;
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

    Promise.all([
      fetchGenesisMarketAuctionCards(),
      fetchListedGenesisEntitiesByCatalogId(),
    ]).then(([cards, entities]) => {
      if (cancelled) return;
      // Filtrar por zona compatível e que tenham entidade disponível
      const matching = cards.filter((c) => {
        if (!zoneMatchesPos(offer.zone, c.pos)) return false;
        return c.genesisCatalogId && entities[c.genesisCatalogId];
      });
      // Pegar 3 aleatórios
      const shuffled = matching.sort(() => Math.random() - 0.5).slice(0, 3);
      setCandidates(
        shuffled.map((card) => ({
          card,
          entity: entities[card.genesisCatalogId!]!,
          price: Math.round((card.buyNow ?? card.currentBid) * URGENCY_MARKUP),
        })),
      );
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [offer]);

  if (!offer) return null;

  const handleDismiss = () => {
    dispatchGame({ type: 'DISMISS_EMERGENCY_TRANSFER' });
  };

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

    // Fechar janela após compra
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
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-md rounded-xl bg-zinc-900 border border-red-500/40 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-red-950/40 border-b border-red-500/20">
            <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-red-300 uppercase tracking-wide">
                Reforço Emergencial
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                {offer.injuredPlayerName} sofreu lesão grave — {ZONE_LABELS[offer.zone]} indisponível
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Dispensar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-zinc-400">
              Contrate um substituto imediato com EXP. Preço de urgência (+30%).
            </p>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-400 rounded-full animate-spin" />
              </div>
            )}

            {!loading && candidates.length === 0 && (
              <p className="text-center text-xs text-zinc-500 py-6">
                Nenhum jogador disponível para esta posição no momento.
              </p>
            )}

            {!loading && candidates.map((candidate) => {
              const { card, price } = candidate;
              const canAfford = oleBal >= price;
              const isBuying = purchasing === card.genesisCatalogId;

              return (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50"
                >
                  {/* OVR badge */}
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                    {card.ovr}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{card.name}</p>
                    <p className="text-xs text-zinc-500">{card.pos} · {card.nat} · OVR {card.ovr}</p>
                  </div>

                  {/* Buy button */}
                  <button
                    onClick={() => handleBuy(candidate)}
                    disabled={!canAfford || !!purchasing}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      canAfford && !purchasing
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
                    )}
                  >
                    {isBuying ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ShoppingCart className="w-3 h-3" />
                    )}
                    {formatExp(price)}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Saldo: <span className="text-zinc-300 font-medium">{formatExp(oleBal)} EXP</span>
            </span>
            <button
              onClick={handleDismiss}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Não, obrigado
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

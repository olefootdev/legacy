/**
 * LiveAuctionCard — Card de leilão ao vivo com countdown e lances
 * ATUALIZADO: Segue design system do PlayerCard (Transfer.tsx)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Crown, AlertCircle, Trophy, Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { placeBid, useAuctionCountdown } from './liveAuctionEngine';
import type { LiveAuction } from './socialTrade';
import { formatPrice } from './socialTrade';

interface LiveAuctionCardProps {
  key?: import("react").Key;
  auction: LiveAuction;
  userId: string;
  userName: string;
  userBalance: number;
}

export function LiveAuctionCard({ auction, userId, userName, userBalance }: LiveAuctionCardProps) {
  const { timeLeft, isEnding } = useAuctionCountdown(auction.id);
  const [bidInput, setBidInput] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [showBidForm, setShowBidForm] = useState(false);

  const isWinning = auction.currentBidder === userId;
  const isAIWinning = auction.currentBidder?.startsWith('ai_');
  const minBid = Math.ceil(auction.currentBid * 1.05);
  const isGold = auction.playerOvr >= 90;

  const handlePlaceBid = () => {
    setBidError(null);
    const amount = parseInt(bidInput.replace(/\D/g, ''), 10);

    if (!amount || amount < minBid) {
      setBidError(`Lance mínimo: ${formatPrice(minBid, 'EXP')}`);
      return;
    }

    if (amount > userBalance) {
      setBidError('Saldo insuficiente');
      return;
    }

    const result = placeBid(auction.id, userId, userName, amount);
    if (result.success) {
      setBidInput('');
      setShowBidForm(false);
    } else {
      setBidError(result.error || 'Erro ao dar lance');
    }
  };

  const formatCountdown = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative group flex h-full min-w-0 flex-col overflow-hidden border-2 bg-dark-gray transition-colors duration-300',
        isEnding && 'animate-pulse',
        // Estado pela borda chapada (VOLT2): elite = volt 2px; vencendo = alta;
        // acabando = baixa. Sem brilho, sem degradê.
        isGold && 'border-neon-yellow',
        !isGold && isWinning && 'border-alta/60',
        !isGold && isEnding && 'border-baixa/60',
        !isGold && !isWinning && !isEnding && 'border-neon-yellow/40',
      )}
    >
      {/* Badge de status */}
      {isGold && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[25] bg-neon-yellow text-black px-2 py-0.5 font-display font-black text-[8px] sm:text-[9px] tracking-[0.2em] uppercase">
          Elite
        </div>
      )}

      {/* Card Content */}
      <div className="relative flex-1">
        {/* Top Left: OVR & POS */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-center bg-deep-black px-2 py-1.5">
          <div className="font-impact text-3xl leading-none tabular-nums text-neon-yellow">
            {auction.playerOvr}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white mt-1">
            {auction.playerPos}
          </div>
        </div>

        {/* Top Right: Countdown */}
        <div className="absolute top-3 right-3 z-20">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 border',
              isEnding
                ? 'bg-deep-black border-baixa/60 text-baixa'
                : 'bg-deep-black border-white/20 text-neon-yellow',
            )}
          >
            <Clock className={cn('h-4 w-4', isEnding && 'animate-pulse')} />
            <span className="text-sm font-bold tabular-nums">
              {auction.status === 'ended' ? 'Fim' : formatCountdown(timeLeft)}
            </span>
          </div>
        </div>

        {/* Player Image Placeholder */}
        <div className="aspect-[3/4] relative flex items-center justify-center bg-card">
          <div className="text-center">
            <Gavel className="mx-auto h-16 w-16 text-white/20 mb-2" />
            <p
              className="font-impact uppercase text-white/15"
              style={{
                fontSize: '3rem',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              {auction.playerName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </p>
          </div>
        </div>

        {/* Card Footer */}
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-deep-black p-4">
          {/* Nome do jogador */}
          <div className="mb-2 min-w-0 px-0.5 text-center">
            <div className="break-words font-display text-lg font-black uppercase leading-[1.1] tracking-wider text-white sm:text-xl md:text-2xl">
              {auction.playerName}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-2/3 mx-auto mb-3 opacity-50 bg-neon-yellow" />

          {/* Lance atual — número em Archivo (ole-num), sem itálico */}
          <div className="mb-3 text-center">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/55 mb-1">
              Lance atual
            </p>
            <p
              className="ole-num tabular-nums leading-none text-neon-yellow"
              style={{
                fontSize: 'clamp(28px, 5vw, 36px)',
              }}
            >
              {formatPrice(auction.currentBid, 'EXP')}
            </p>
            {auction.currentBidderName && (
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-white/60">
                {isAIWinning && <Crown className="h-3 w-3 text-cimento" />}
                {auction.currentBidderName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Area */}
      {auction.status === 'active' && (
        <div className="relative z-30 border-t border-white/10 bg-black/80 p-2.5 sm:p-3">
          {/* Status do usuário */}
          <AnimatePresence mode="wait">
            {isWinning ? (
              <motion.div
                key="winning"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-2 flex items-center gap-2 border border-alta/40 bg-panel px-3 py-2"
              >
                <Trophy className="h-4 w-4 text-alta" />
                <p className="text-xs font-bold text-alta">Você está vencendo!</p>
              </motion.div>
            ) : (
              <motion.div
                key="not-winning"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-2 flex items-center gap-2 border border-atencao/40 bg-panel px-3 py-2"
              >
                <AlertCircle className="h-4 w-4 text-atencao" />
                <p className="text-xs font-bold text-atencao">
                  Mínimo: {formatPrice(minBid, 'EXP')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Últimos 3 lances */}
          {auction.bids.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-white/40">Últimos Lances</p>
              {auction.bids.slice(0, 3).map((bid, i) => (
                <div
                  key={`${bid.bidderId}-${bid.timestamp.getTime()}`}
                  className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5"
                >
                  <span className="flex items-center gap-1 text-xs text-white/70">
                    {bid.isAI && <Crown className="h-3 w-3 text-cimento" />}
                    {bid.bidderName}
                  </span>
                  <span className="text-xs font-bold text-white">{formatPrice(bid.amount, 'EXP')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de lance */}
          {!showBidForm ? (
            <button
              type="button"
              onClick={() => setShowBidForm(true)}
              disabled={isWinning}
              className={cn(
                'flex w-full min-h-11 items-center justify-center px-3 py-3 font-display text-[12px] font-black uppercase leading-tight tracking-[0.22em] transition-colors sm:text-[13px]',
                isWinning
                  ? 'cursor-not-allowed bg-white/5 text-white/30'
                  : 'bg-neon-yellow text-black hover:bg-white',
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {isWinning ? 'Você está vencendo' : 'Dar Lance'}
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <input
                type="text"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                placeholder={`Mínimo: ${minBid.toLocaleString('pt-BR')}`}
                className="w-full border border-white/20 bg-deep-black px-4 py-3 text-white placeholder:text-white/40 focus:border-neon-yellow focus:outline-none"
              />
              {bidError && <p className="text-xs text-baixa">{bidError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBidForm(false);
                    setBidError(null);
                    setBidInput('');
                  }}
                  className="flex-1 border border-white/30 bg-transparent py-2 text-sm font-bold uppercase tracking-wider text-white/70 transition-colors hover:border-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePlaceBid}
                  className="flex-1 bg-neon-yellow py-2 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-white"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {auction.status === 'ended' && (
        <div className="relative z-30 border-t border-white/10 bg-black/80 p-2.5 sm:p-3">
          <div className="rounded-lg bg-black/40 px-4 py-3 text-center">
            <p className="text-sm font-bold text-white/60">Leilão Encerrado</p>
            {auction.currentBidderName && (
              <p className="mt-1 text-xs text-white/40">Vencedor: {auction.currentBidderName}</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}


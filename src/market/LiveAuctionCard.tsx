/**
 * LiveAuctionCard — Card de leilão ao vivo com countdown e lances
 * DS 2027: a carta sobe a escada pelo OVR, pende torta como lambe e a
 * contagem vem em blocos de spray; o balcão do lance fica embaixo, reto.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { placeBid, useAuctionCountdown } from './liveAuctionEngine';
import type { LiveAuction } from './socialTrade';
import { formatPrice } from './socialTrade';
import { BotaoRua, DEGRAU_CLASSES, MarcaRua, SeloRua } from '@/components/ui/Rua';
import { CAMPO_RUA, ContagemSpray, degrauDeOvr } from '@/components/bolsa/Bolsa';
import { L, LOCALE } from '@/i18n/L';

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

  const handlePlaceBid = () => {
    setBidError(null);
    const amount = parseInt(bidInput.replace(/\D/g, ''), 10);

    if (!amount || amount < minBid) {
      setBidError(L(`Lance mínimo: ${formatPrice(minBid, 'EXP')}`, `Minimum bid: ${formatPrice(minBid, 'EXP')}`));
      return;
    }

    if (amount > userBalance) {
      setBidError(L('Saldo insuficiente', 'Insufficient balance'));
      return;
    }

    const result = placeBid(auction.id, userId, userName, amount);
    if (result.success) {
      setBidInput('');
      setShowBidForm(false);
    } else {
      setBidError(result.error || L('Erro ao dar lance', 'Failed to place bid'));
    }
  };

  const degrau = degrauDeOvr(auction.playerOvr);
  const ouroNaCarta = degrau === 'lenda' || degrau === 'respeito';
  // Lambe colado: cada carta pende pra um lado, decidido pelo id (estável).
  const torto = [...auction.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 2 === 0 ? -1.5 : 1.5;
  const iniciais = auction.playerName.split(' ').map((w) => w[0]).join('').slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-w-0 flex-col"
    >
      {/* ── A CARTA, na escada pelo OVR ─────────────────────────────────── */}
      <div
        className={cn(
          'relative z-[1] flex min-w-0 flex-col gap-3 p-4 shadow-[6px_8px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:!rotate-0',
          DEGRAU_CLASSES[degrau],
        )}
        style={{ transform: `rotate(${auction.status === 'ended' ? 0 : torto}deg)` }}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex flex-col">
            <span
              className={cn(
                'font-impact text-[52px] leading-[0.85] tabular-nums',
                degrau === 'respeito' && 'text-ouro-27',
                degrau === 'chao' && 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]',
              )}
            >
              {auction.playerOvr}
            </span>
            <span className={cn('mt-1 font-impact text-[15px] uppercase leading-none', degrau === 'respeito' && 'text-ouro-27')}>
              {auction.playerPos}
            </span>
          </div>
          {auction.status === 'ended' ? (
            <span className="bg-asfalto-27 px-3 py-2 font-spray text-[26px] font-black uppercase leading-none text-papel">
              {L('Fim', 'End')}
            </span>
          ) : (
            <ContagemSpray
              ms={timeLeft}
              rotulos={false}
              tamanho="text-[30px]"
              bloco={cn(
                'w-[50px] bg-asfalto-27',
                isEnding ? 'animate-pulse text-papel' : ouroNaCarta ? 'text-ouro-27' : 'text-papel',
              )}
              className="shrink-0"
            />
          )}
        </div>

        <div
          className={cn(
            'relative flex aspect-[5/3] w-full items-center justify-center overflow-hidden',
            degrau === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10',
          )}
        >
          <span aria-hidden className="font-impact text-[64px] uppercase leading-none opacity-25">{iniciais}</span>
          <MarcaRua tipo="escudo" className={cn('absolute bottom-2 right-2 h-7', degrau === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
          {isEnding && auction.status === 'active' && (
            <span className="absolute left-0 top-2 bg-rua px-2 py-0.5 font-impact text-[13px] uppercase text-asfalto-27">
              {L('Acabando', 'Ending')}
            </span>
          )}
        </div>

        <span className="block min-w-0 font-voz text-[clamp(26px,7vw,32px)] leading-none [overflow-wrap:anywhere]">{auction.playerName}</span>

        <div
          className={cn(
            'flex min-w-0 items-end justify-between gap-2 px-2 py-2',
            degrau === 'chao' && 'border-t-2 border-dashed border-asfalto-27 px-0',
            degrau === 'corre' && 'bg-asfalto-27 text-rua',
            degrau === 'respeito' && 'border-2 border-ouro-27 text-ouro-27',
            degrau === 'lenda' && 'bg-asfalto-27 text-ouro-27',
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] opacity-80">{L('Lance atual', 'Current bid')}</span>
            <span className="block min-w-0 truncate font-impact text-[26px] leading-none tabular-nums">{formatPrice(auction.currentBid, 'EXP')}</span>
          </div>
          {auction.currentBidderName && (
            <span className="min-w-0 max-w-[45%] truncate text-right font-prova text-[11px] font-bold uppercase tracking-[0.08em]">
              {isAIWinning && <Crown className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />}
              {auction.currentBidderName}
            </span>
          )}
        </div>
      </div>

      {/* ── Balcão do lance ─────────────────────────────────────────────── */}
      {auction.status === 'active' && (
        <div className="-mt-1 flex min-w-0 grow flex-col gap-3 bg-concreto px-4 pb-4 pt-5">
          <AnimatePresence mode="wait">
            {isWinning ? (
              <motion.div
                key="winning"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="self-start"
              >
                <SeloRua tom="cal">{L('Teu lance manda', 'Your bid leads')}</SeloRua>
              </motion.div>
            ) : (
              <motion.p
                key="not-winning"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo"
              >
                {L('Mínimo', 'Minimum')} · <span className="text-papel">{formatPrice(minBid, 'EXP')}</span>
              </motion.p>
            )}
          </AnimatePresence>

          {auction.bids.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Últimos lances', 'Latest bids')}</span>
              {auction.bids.slice(0, 3).map((bid) => (
                <div
                  key={`${bid.bidderId}-${bid.timestamp.getTime()}`}
                  className="flex min-w-0 items-center justify-between gap-2 border-b border-linha py-1.5 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-1 truncate font-sans text-[13px] text-suave">
                    {bid.isAI && <Crown className="h-3 w-3 shrink-0 text-mudo" aria-hidden />}
                    {bid.bidderName}
                  </span>
                  <span className="shrink-0 font-impact text-[15px] leading-none tabular-nums text-papel">{formatPrice(bid.amount, 'EXP')}</span>
                </div>
              ))}
            </div>
          )}

          {!showBidForm ? (
            <BotaoRua
              variante={isWinning ? 'vazio' : degrau === 'lenda' ? 'ouro' : 'corre'}
              onClick={() => setShowBidForm(true)}
              disabled={isWinning}
              className={cn('mt-auto w-full', isWinning && 'opacity-100')}
            >
              {isWinning ? L('Tu tá na frente', "You're ahead") : <>{L('Dar lance', 'Place bid')} <span aria-hidden>→</span></>}
            </BotaoRua>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-auto flex min-w-0 flex-col gap-2"
            >
              <input
                type="text"
                inputMode="numeric"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                aria-label={L('Valor do lance', 'Bid amount')}
                placeholder={L(`Mínimo: ${minBid.toLocaleString(LOCALE)}`, `Minimum: ${minBid.toLocaleString(LOCALE)}`)}
                className={CAMPO_RUA}
              />
              {bidError && <p className="font-sans text-[13px] font-semibold text-baixa">{bidError}</p>}
              <div className="flex min-w-0 gap-2">
                <BotaoRua
                  variante="contorno"
                  onClick={() => {
                    setShowBidForm(false);
                    setBidError(null);
                    setBidInput('');
                  }}
                  className="min-w-0 flex-1 px-3 text-[17px]"
                >
                  {L('Cancelar', 'Cancel')}
                </BotaoRua>
                <BotaoRua
                  variante={degrau === 'lenda' ? 'ouro' : 'corre'}
                  onClick={handlePlaceBid}
                  className="min-w-0 flex-1 px-3 text-[17px]"
                >
                  {L('Confirmar', 'Confirm')} <span aria-hidden>→</span>
                </BotaoRua>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {auction.status === 'ended' && (
        <div className="-mt-1 flex min-w-0 grow flex-col gap-1 border-2 border-dashed border-fio px-4 pb-4 pt-5">
          <span className="font-voz text-[24px] leading-none text-papel">{L('Martelo batido.', 'Hammer down.')}</span>
          {auction.currentBidderName && (
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
              {L('Levou', 'Won by')} · <span className="text-papel">{auction.currentBidderName}</span>
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

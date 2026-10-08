/**
 * LiveAuctionsPage — Página de leilões ao vivo
 * Rota: /mercado/leiloes
 * Usa jogadores reais do sistema. DS 2027: cartas na escada por OVR, tortas
 * como lambe, contagem em spray; saldo no degrau RESPEITO.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { BackButton } from '@/components/BackButton';
import { LiveAuctionCard } from '@/market/LiveAuctionCard';
import { SecaoRua, SeloRua } from '@/components/ui/Rua';
import {
  useActiveAuctions,
  useAuctionMessages,
  seedAuctionsFromPlayers,
} from '@/market/liveAuctionEngine';
import { fetchGenesisMarketAuctionCards } from '@/supabase/genesisMarket';
import { isSupabaseConfigured } from '@/supabase/client';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import { formatExp } from '@/systems/economy';
import { L } from '@/i18n/L';

export function LiveAuctionsPage() {
  const auctions = useActiveAuctions();
  const messages = useAuctionMessages();
  const club = useGameStore((s) => s.club);
  const ole = useGameStore((s) => s.finance.ole);
  const userId = 'player_user'; // TODO: pegar do auth real
  const userName = club.name;

  const [showMessages, setShowMessages] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<MockAuctionPlayer[]>([]);

  const activeAuctions = auctions.filter((a) => a.status === 'active');
  const endedAuctions = auctions.filter((a) => a.status === 'ended');
  const unreadMessages = messages.filter((m) => !m.read).length;

  // Carregar jogadores reais do sistema
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAvailablePlayers([]);
      return;
    }
    let cancelled = false;
    void fetchGenesisMarketAuctionCards().then((cards) => {
      if (cancelled) return;
      setAvailablePlayers(cards);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed inicial (apenas em dev, usando jogadores reais)
  useEffect(() => {
    if (auctions.length === 0 && availablePlayers.length > 0 && import.meta.env.DEV) {
      seedAuctionsFromPlayers(availablePlayers, 3);
    }
  }, [availablePlayers, auctions.length]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 overflow-x-hidden px-3 pb-10 sm:px-4">
      <BackButton to="/mercado" label={L('Mercado', 'Market')} />

      {/* Cabeçalho — a voz em cima, o grito embaixo. */}
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <SecaoRua label={L('Leilões ao vivo', 'Live auctions')} />
          {activeAuctions.length > 0 && (
            <SeloRua tom="corre">
              ● {activeAuctions.length} {activeAuctions.length === 1 ? L('ativo', 'active') : L('ativos', 'active')}
            </SeloRua>
          )}
        </div>
        <h1 className="flex flex-col font-impact uppercase leading-[0.88]">
          <span className="font-voz text-[clamp(48px,13vw,84px)] normal-case leading-[0.9] text-papel">{L('Leilões', 'Auctions')}</span>
          <span className="text-[clamp(30px,8.5vw,54px)] text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)]">
            {L('Quem dá mais?', 'Who bids more?')}
          </span>
        </h1>
      </header>

      {/* Saldo (RESPEITO: fio de ouro) + avisos */}
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1 border-[3px] border-ouro-27 bg-asfalto-27 p-4">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Teu saldo', 'Your balance')}</span>
          <span className="block min-w-0 truncate font-spray text-[clamp(28px,8vw,40px)] font-black leading-[0.9] tabular-nums text-ouro-27">
            {formatExp(ole)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowMessages(!showMessages)}
          aria-expanded={showMessages}
          className="relative flex min-w-0 flex-col gap-1 bg-concreto p-4 text-left transition-colors hover:bg-linha focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rua"
        >
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Avisos', 'Notices')}</span>
          <span className="flex items-baseline gap-2">
            <span className="font-spray text-[clamp(28px,8vw,40px)] font-black leading-[0.9] tabular-nums text-papel">{unreadMessages}</span>
            <span aria-hidden className="font-impact text-[18px] text-mudo">{showMessages ? '↑' : '↓'}</span>
          </span>
          {unreadMessages > 0 && (
            <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rua" aria-hidden />
          )}
        </button>
      </div>

      {/* Avisos (expansível) */}
      <AnimatePresence>
        {showMessages && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            {messages.slice(0, 5).map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex min-w-0 flex-col gap-1 bg-concreto px-4 py-3',
                  msg.urgency === 'high' && 'border-l-4 border-rua',
                )}
              >
                <p className="flex min-w-0 items-center gap-2 font-impact text-[17px] uppercase leading-tight text-papel">
                  {msg.urgency === 'high' && <SeloRua tom="corre" className="py-0.5 text-[10px]">{L('Agora', 'Now')}</SeloRua>}
                  <span className="min-w-0 truncate">{msg.title}</span>
                </p>
                <p className="font-sans text-[13px] leading-snug text-suave">{msg.message}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leilões ativos */}
      {activeAuctions.length > 0 && (
        <section className="flex min-w-0 flex-col gap-5">
          <SecaoRua label={L('No martelo', 'Under the hammer')} aside={String(activeAuctions.length)} />
          <div className="grid min-w-0 gap-x-5 gap-y-8 px-1 sm:grid-cols-2 lg:grid-cols-3">
            {activeAuctions.map((auction) => (
              <LiveAuctionCard
                key={auction.id}
                auction={auction}
                userId={userId}
                userName={userName}
                userBalance={ole}
              />
            ))}
          </div>
        </section>
      )}

      {/* Leilões encerrados */}
      {endedAuctions.length > 0 && (
        <section className="flex min-w-0 flex-col gap-5">
          <SecaoRua label={L('Encerrados', 'Ended')} aside={String(endedAuctions.length)} />
          <div className="grid min-w-0 gap-x-5 gap-y-8 px-1 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
            {endedAuctions.map((auction) => (
              <LiveAuctionCard
                key={auction.id}
                auction={auction}
                userId={userId}
                userName={userName}
                userBalance={ole}
              />
            ))}
          </div>
        </section>
      )}

      {/* Vazio — lambe de cal colado torto (degrau CHÃO: o que ainda vai acontecer). */}
      {auctions.length === 0 && (
        <div className="flex min-w-0 -rotate-1 flex-col gap-2 border-[3px] border-dashed border-asfalto-27 bg-cal p-6 text-asfalto-27">
          <span className="font-voz text-[clamp(32px,9vw,44px)] leading-[0.95]">
            {availablePlayers.length === 0 ? L('Chamando os craques…', 'Calling the players…') : L('Martelo parado.', 'Hammer at rest.')}
          </span>
          <p className="font-sans text-[14px] leading-snug">
            {availablePlayers.length === 0
              ? L('Carregando jogadores...', 'Loading players...')
              : L('Nenhum leilão ativo no momento', 'No active auctions right now')}
          </p>
        </div>
      )}
    </div>
  );
}

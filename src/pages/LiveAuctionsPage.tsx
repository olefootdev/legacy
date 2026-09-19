/**
 * LiveAuctionsPage — Página de leilões ao vivo
 * Rota: /mercado/leiloes
 * ATUALIZADO: Usa jogadores reais do sistema + Design system do jogo
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gavel, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { BackButton } from '@/components/BackButton';
import { LiveAuctionCard } from '@/market/LiveAuctionCard';
import { SecaoVolt } from '@/components/ui';
import {
  useActiveAuctions,
  useAuctionMessages,
  seedAuctionsFromPlayers,
} from '@/market/liveAuctionEngine';
import { fetchGenesisMarketAuctionCards } from '@/supabase/genesisMarket';
import { isSupabaseConfigured } from '@/supabase/client';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import { formatExp } from '@/systems/economy';

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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-10">
      <BackButton to="/mercado" label="Mercado" />

      {/* Header — Padrão editorial do jogo */}
      <header className="text-center pt-2 pb-2">
        <div className="ole-eyebrow !text-neon-yellow mb-4">
          <span>Leilões ao Vivo</span>
        </div>
        <h1 className="leading-[0.95]">
          <span
            className="block font-bold uppercase text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
              letterSpacing: '0.005em',
            }}
          >
            Leilões
          </span>
          {activeAuctions.length > 0 && (
            <span
              className="block font-impact uppercase leading-[1.1] text-neon-yellow mt-1"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                letterSpacing: '-0.01em',
              }}
            >
              {activeAuctions.length} {activeAuctions.length === 1 ? 'ativo' : 'ativos'}
            </span>
          )}
        </h1>
        <span aria-hidden className="mx-auto mt-5 block w-12 h-[3px] bg-neon-yellow" />
      </header>

      {/* Saldo + Mensagens — Grid padrão */}
      <div
        className="grid grid-cols-2 divide-x divide-[var(--color-border)] border border-[var(--color-border)] bg-dark-gray"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <div className="px-5 py-4">
          <p
            className="text-white/55 uppercase"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              fontWeight: 600,
            }}
          >
            Seu Saldo
          </p>
          <p
            className="ole-num mt-1.5 tabular-nums leading-none text-neon-yellow"
            style={{
              fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)',
            }}
          >
            {formatExp(ole)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMessages(!showMessages)}
          className="relative px-5 py-4 transition-colors hover:bg-white/5"
        >
          <p
            className="text-white/55 uppercase"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              fontWeight: 600,
            }}
          >
            Notificações
          </p>
          <p
            className="ole-num mt-1.5 tabular-nums leading-none text-white"
            style={{
              fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)',
            }}
          >
            {unreadMessages}
          </p>
          {unreadMessages > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-baixa text-[10px] font-bold text-white">
              {unreadMessages}
            </span>
          )}
        </button>
      </div>

      {/* Mensagens (expansível) */}
      <AnimatePresence>
        {showMessages && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {messages.slice(0, 5).map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'rounded-lg border px-4 py-3',
                  msg.urgency === 'high'
                    ? 'border-baixa/40 bg-panel'
                    : 'border-white/10 bg-panel',
                )}
              >
                <p className="text-sm font-bold text-white">{msg.title}</p>
                <p className="mt-1 text-xs text-white/60">{msg.message}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leilões Ativos — Header padrão editorial */}
      {activeAuctions.length > 0 && (
        <section className="space-y-4">
          <SecaoVolt label={`Leilões ativos (${activeAuctions.length})`} className="px-0.5" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Leilões Encerrados */}
      {endedAuctions.length > 0 && (
        <section className="space-y-4">
          <SecaoVolt label={`Encerrados (${endedAuctions.length})`} tone="neutro" className="px-0.5" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Empty state */}
      {auctions.length === 0 && (
        <div className="py-12 text-center">
          <Gavel className="mx-auto h-16 w-16 text-white/20 mb-4" />
          <p className="text-sm text-white/40 mb-4">
            {availablePlayers.length === 0
              ? 'Carregando jogadores...'
              : 'Nenhum leilão ativo no momento'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * LiveAuctionsPage — Página de leilões ao vivo
 * Rota: /mercado/leiloes
 * ATUALIZADO: Usa jogadores reais do sistema + Design system do jogo
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gavel, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '@/game/store';
import { BackButton } from '@/components/BackButton';
import { LiveAuctionCard } from '@/market/LiveAuctionCard';
import {
  useActiveAuctions,
  useAuctionMessages,
  seedAuctionsFromPlayers,
  clearAllAuctions,
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
              className="block italic text-neon-yellow mt-1"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 400,
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                letterSpacing: '-0.01em',
              }}
            >
              {activeAuctions.length} {activeAuctions.length === 1 ? 'ativo' : 'ativos'}
            </span>
          )}
        </h1>
        <span aria-hidden className="mx-auto mt-5 block w-12 h-[3px] bg-neon-yellow" />
        <p
          className="mx-auto mt-5 max-w-xl text-white/55"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          Leilões em tempo real com IA competindo. Dê lances, vença jogadores de elite e construa seu time dos sonhos.
        </p>
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
            className="mt-1.5 italic tabular-nums leading-none text-neon-yellow"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)',
              letterSpacing: '-0.02em',
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
            className="mt-1.5 italic tabular-nums leading-none text-white"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)',
              letterSpacing: '-0.02em',
            }}
          >
            {unreadMessages}
          </p>
          {unreadMessages > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
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
                    ? 'border-red-500/30 bg-red-950/20'
                    : 'border-white/10 bg-white/5',
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
          <div className="flex min-w-0 items-center gap-3 px-0.5">
            <span
              aria-hidden
              className="shrink-0 w-[3px] h-7 bg-neon-yellow shadow-[0_0_10px_rgba(253,225,0,0.55)]"
            />
            <div className="min-w-0 flex-1">
              <h3
                className="text-neon-yellow font-bold uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  letterSpacing: '0.18em',
                }}
              >
                Leilões Ativos ({activeAuctions.length})
              </h3>
              <p
                className="text-white/45"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.04em',
                }}
              >
                Dê lances e vença jogadores de elite
              </p>
            </div>
          </div>

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
          <div className="flex min-w-0 items-center gap-3 px-0.5">
            <span aria-hidden className="shrink-0 w-[3px] h-7 bg-white/30" />
            <div className="min-w-0 flex-1">
              <h3
                className="text-white/70 font-bold uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  letterSpacing: '0.18em',
                }}
              >
                Encerrados ({endedAuctions.length})
              </h3>
            </div>
          </div>

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
          {import.meta.env.DEV && availablePlayers.length > 0 && (
            <button
              type="button"
              onClick={() => seedAuctionsFromPlayers(availablePlayers, 3)}
              className="rounded-lg bg-neon-yellow px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300"
            >
              <Plus className="mr-2 inline h-4 w-4" />
              Criar Leilões (Dev)
            </button>
          )}
        </div>
      )}

      {/* Dev tools */}
      {import.meta.env.DEV && auctions.length > 0 && availablePlayers.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => seedAuctionsFromPlayers(availablePlayers, 1)}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 transition-all hover:border-white/30"
          >
            <Plus className="mr-2 inline h-3 w-3" />
            Adicionar Leilão
          </button>
          <button
            type="button"
            onClick={() => clearAllAuctions()}
            className="rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition-all hover:border-red-500/40"
          >
            <RefreshCw className="mr-2 inline h-3 w-3" />
            Limpar Todos
          </button>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

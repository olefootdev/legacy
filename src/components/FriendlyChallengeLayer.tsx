import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import {
  FRIENDLY_CHALLENGE_TTL_SEC,
  fetchProfileRemoteClubId,
  subscribeIncomingFriendlyChallenges,
  unsubscribeChannel,
  updateFriendlyChallengeStatus,
  type FriendlyChallengeRow,
} from '@/supabase/friendlyChallenges';
import { formatExp } from '@/systems/economy';

function secondsLeft(expiresAtIso: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAtIso).getTime() - Date.now()) / 1000));
}

/**
 * Escuta convites de amistoso (Supabase Realtime) para o clube do perfil e
 * permite aceitar/recusar dentro do TTL.
 */
export function FriendlyChallengeLayer() {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<FriendlyChallengeRow | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!incoming) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [incoming]);

  useEffect(() => {
    if (!incoming) return;
    if (secondsLeft(incoming.expires_at) <= 0) {
      void updateFriendlyChallengeStatus(incoming.id, 'expired');
      setIncoming(null);
    }
  }, [incoming, tick]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      if (!data.user || cancelled) return;
      const cid = await fetchProfileRemoteClubId();
      if (!cid || cancelled) return;
      try {
        channelRef.current = subscribeIncomingFriendlyChallenges(cid, (row) => {
          setIncoming((cur) => (cur && cur.id === row.id ? cur : row));
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      unsubscribeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, []);

  const onAccept = async () => {
    if (!incoming || busy) return;
    setBusy(true);
    const r = await updateFriendlyChallengeStatus(incoming.id, 'accepted');
    setBusy(false);
    if ('error' in r) {
      alert(r.error);
      return;
    }
    const path = incoming.mode === 'live' ? '/match/live' : '/match/quick';
    navigate(`${path}?fc=${encodeURIComponent(incoming.id)}`);
    setIncoming(null);
  };

  const onDecline = async () => {
    if (!incoming || busy) return;
    setBusy(true);
    await updateFriendlyChallengeStatus(incoming.id, 'declined');
    setBusy(false);
    setIncoming(null);
  };

  if (!incoming) return null;

  const left = secondsLeft(incoming.expires_at);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/85 p-4 sm:items-center">
      <div
        className={cn(
          'relative w-full max-w-md border border-neon-yellow/40 bg-panel p-5',
          'sports-panel',
        )}
      >
        <button
          type="button"
          onClick={() => void onDecline()}
          className="absolute right-3 top-3 p-2 text-cimento hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="font-mono text-[11.5px] font-medium text-neon-yellow">#desafio · amistoso</p>
        <h2 className="mt-2 truncate pr-8 font-impact text-2xl uppercase leading-[1.1] text-white">
          {incoming.challenger_club_name}
        </h2>
        <p className="mt-2 text-sm text-cimento">
          Te convidou pra um {incoming.mode === 'live' ? 'jogo ao vivo' : 'jogo rápido'}.
          {incoming.bet_currency === 'BRO' && incoming.bet_bro_cents != null ? (
            <span className="mt-1 block text-white">
              Aposta: {(incoming.bet_bro_cents / 100).toFixed(2)} BRO (vencedor)
            </span>
          ) : null}
          {incoming.bet_currency === 'EXP' && incoming.bet_exp != null ? (
            <span className="mt-1 block text-white">Aposta: {formatExp(incoming.bet_exp)} EXP</span>
          ) : null}
        </p>
        <div className="mt-4 flex items-center justify-between border border-white/10 bg-deep-black px-3 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cimento">Tempo para aceitar</span>
          <span className="ole-num text-2xl text-neon-yellow">{left}s</span>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-poeira">Máx. {FRIENDLY_CHALLENGE_TTL_SEC}s · os dois managers online</p>
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            disabled={busy || left <= 0}
            onClick={() => void onDecline()}
            className="ole-num h-[50px] whitespace-nowrap border border-white/30 px-4 text-[11.5px] uppercase text-white transition-colors hover:border-white hover:bg-white/5 disabled:opacity-40"
          >
            Recusar
          </button>
          <button
            type="button"
            disabled={busy || left <= 0}
            onClick={() => void onAccept()}
            className="ole-num h-[50px] min-w-0 whitespace-nowrap bg-neon-yellow px-3 text-[11.5px] uppercase text-black transition-colors hover:bg-white disabled:opacity-40 [--corte:12px] [clip-path:var(--clip-corte)]"
          >
            Aceitar e entrar
          </button>
        </div>
      </div>
    </div>
  );
}

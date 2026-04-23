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
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={cn(
          'relative w-full max-w-md border border-neon-yellow/40 bg-[#0a0a0a] p-5 shadow-2xl',
          'sports-panel',
        )}
      >
        <button
          type="button"
          onClick={() => void onDecline()}
          className="absolute right-3 top-3 rounded-full p-2 text-gray-500 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">Desafio amistoso</p>
        <h2 className="mt-2 font-display text-xl font-black uppercase tracking-wide text-white">
          {incoming.challenger_club_name}
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Convida-te para um {incoming.mode === 'live' ? 'jogo ao vivo' : 'jogo rápido'}.
          {incoming.bet_currency === 'BRO' && incoming.bet_bro_cents != null ? (
            <span className="mt-1 block text-white">
              Aposta: {(incoming.bet_bro_cents / 100).toFixed(2)} BRO (vencedor)
            </span>
          ) : null}
          {incoming.bet_currency === 'EXP' && incoming.bet_exp != null ? (
            <span className="mt-1 block text-white">Aposta: {formatExp(incoming.bet_exp)} EXP</span>
          ) : null}
        </p>
        <div className="mt-4 flex items-center justify-between rounded border border-white/10 bg-black/40 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tempo para aceitar</span>
          <span className="font-display text-2xl font-black text-neon-yellow">{left}s</span>
        </div>
        <p className="mt-2 text-[10px] text-gray-600">Máximo {FRIENDLY_CHALLENGE_TTL_SEC}s — ambos os managers devem estar online.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || left <= 0}
            onClick={() => void onDecline()}
            className="border border-white/15 py-2.5 text-xs font-bold uppercase text-gray-400 hover:bg-white/5 disabled:opacity-40"
          >
            Recusar
          </button>
          <button
            type="button"
            disabled={busy || left <= 0}
            onClick={() => void onAccept()}
            className="bg-neon-yellow py-2.5 text-xs font-display font-black uppercase text-black hover:bg-neon-yellow/90 disabled:opacity-40"
          >
            Aceitar e entrar
          </button>
        </div>
      </div>
    </div>
  );
}

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
import { L } from '@/i18n/L';

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
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-asfalto-27/90 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={L('Desafio amistoso', 'Friendly challenge')}
        className={cn('relative w-full max-w-md overflow-hidden bg-rua text-asfalto-27')}
      >
        <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-28 [--alambrado:rgba(13,13,12,0.24)]" />
        <div className="relative p-5">
          <button
            type="button"
            onClick={() => void onDecline()}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center hover:bg-asfalto-27 hover:text-rua"
            aria-label={L('Fechar', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
          <p className="font-prova text-[11.5px] font-bold uppercase tracking-[0.16em]">{L('#desafio · amistoso', '#challenge · friendly')}</p>
          <h2 className="mt-2 pr-10 font-impact uppercase leading-[0.9] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(34px, 10vw, 48px)' }}>
            {incoming.challenger_club_name}
          </h2>
          <p className="mt-2 font-voz text-[24px] leading-[1.05]">
            {incoming.mode === 'live' ? L('Te convidou pra um jogo ao vivo.', 'Invited you to a live match.') : L('Te convidou pra um jogo rápido.', 'Invited you to a quick match.')}
          </p>
          {incoming.bet_currency === 'BRO' && incoming.bet_bro_cents != null ? (
            <p className="mt-2 font-prova text-[12px] font-bold uppercase tracking-[0.08em]">
              {L('Aposta', 'Stake')}: {(incoming.bet_bro_cents / 100).toFixed(2)} BRO ({L('vencedor', 'winner')})
            </p>
          ) : null}
          {incoming.bet_currency === 'EXP' && incoming.bet_exp != null ? (
            <p className="mt-2 font-prova text-[12px] font-bold uppercase tracking-[0.08em]">{L('Aposta', 'Stake')}: {formatExp(incoming.bet_exp)} EXP</p>
          ) : null}
        </div>
        <div className="rua-grao bg-asfalto-27 p-5 text-papel">
          <div className="flex items-end justify-between gap-3">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Tempo para aceitar', 'Time to accept')}</span>
            <span className="font-spray font-black text-[44px] leading-none tabular-nums text-rua">{left}<span className="font-prova text-[14px] text-mudo">s</span></span>
          </div>
          <p className="mt-1 font-prova text-[10.5px] text-mudo">{L(`Máx. ${FRIENDLY_CHALLENGE_TTL_SEC}s · os dois managers online`, `Max. ${FRIENDLY_CHALLENGE_TTL_SEC}s · both managers online`)}</p>
          <div className="mt-5 grid grid-cols-[auto_1fr] gap-3 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              disabled={busy || left <= 0}
              onClick={() => void onDecline()}
              className="min-h-[52px] whitespace-nowrap border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 disabled:opacity-40"
            >
              {L('Recusar', 'Decline')}
            </button>
            <button
              type="button"
              disabled={busy || left <= 0}
              onClick={() => void onAccept()}
              className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 whitespace-nowrap bg-rua px-3 font-impact text-[18px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-papel)] disabled:opacity-40"
            >
              {L('Aceitar e entrar', 'Accept and join')} <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

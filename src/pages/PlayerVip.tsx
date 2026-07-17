/**
 * PLAYERVIP — game.olefoot.com/playervip
 *
 * Cockpit dedicado da lenda. Rota STANDALONE (fora do RequireRegistration e
 * do GameShell): a lenda não precisa ter clube — entra por link mágico e vê
 * saldo, coleções, vendas em tempo real, comissões, indicação e ações.
 *
 * Leituras reusam RPCs existentes. Ações (saque/suporte/nova coleção) usam
 * @/supabase/playerVip (migration 20260712120000_playervip_requests.sql).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Share2, Copy, CheckCircle2, Plus, MessageCircle,
  ShieldCheck, LogOut, ArrowUpRight, Sparkles, Loader2,
} from 'lucide-react';
import { getSupabase } from '@/supabase/client';
import { getMyLinkedCards, type LinkedCardRow } from '@/admin/playerLinking';
import { fetchMyAffiliateCommissions, totalPendingByCurrency } from '@/wallet/affiliateCommissions';
import { fetchMyReferrals, fetchMyReferralCode, type ReferredProfile } from '@/supabase/referrals';
import { getMyVerification } from '@/supabase/verification';
import { inviteLinkForCode } from '@/wallet/referralCode';
import {
  requestWithdrawal, sendSupportMessage, requestNewCollection,
  getMyWithdrawals, type WithdrawalRow,
  getMyCardSales, getMyCardSalesSummary, getMyWithdrawableBalance,
  getMyCollectionLikes, subscribeMyCardSales,
  type CardSaleRow, type CardSalesSummary,
} from '@/supabase/playerVip';
import { formatExp } from '@/systems/economy';
import { RailStat, ConfirmDialog } from '@/components/ui';
import { cn } from '@/lib/utils';

const SERIF = 'var(--font-serif-hero)';
const YELLOW = 'var(--color-neon-yellow)';

const PHASE_LABEL: Record<string, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

function brl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}
function phaseFromId(id: string): string | null {
  const seg = id.split('-').pop() ?? '';
  return PHASE_LABEL[seg] ?? null;
}
function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

type Session = 'loading' | 'anon' | 'authed';

export function PlayerVip() {
  const [session, setSession] = useState<Session>('loading');

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setSession('anon'); return; }
    let cancelled = false;
    void sb.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setSession(data?.user ? 'authed' : 'anon');
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? 'authed' : 'anon');
    });
    return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white" style={{ fontFamily: 'var(--font-ui)' }}>
      {session === 'loading' ? (
        <div className="grid min-h-screen place-items-center text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : session === 'anon' ? (
        <PlayerVipLogin />
      ) : (
        <PlayerVipDashboard />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN — link mágico por e-mail (sem senha)
// ═══════════════════════════════════════════════════════════════════════════
function PlayerVipLogin() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');

  async function send() {
    const sb = getSupabase();
    if (!sb) { setErr('Serviço indisponível.'); setState('error'); return; }
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setErr('Digite um e-mail válido.'); setState('error'); return; }
    setState('sending'); setErr('');
    const { error } = await sb.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: `${window.location.origin}/playervip` },
    });
    if (error) { setErr('Não conseguimos enviar. Tente de novo.'); setState('error'); return; }
    setState('sent');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-10 flex items-center gap-3">
        <span className="h-7 w-3 rounded-sm" style={{ background: YELLOW, boxShadow: '0 0 22px rgba(253,225,0,.45)' }} />
        <span className="font-display text-[15px] font-black uppercase tracking-wide">OLEFOOT</span>
        <span className="font-display text-[15px] font-black uppercase tracking-wide text-white/40">PLAYERVIP</span>
      </div>

      {state === 'sent' ? (
        <div className="rounded-2xl border border-white/10 bg-[#131315] p-7 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10" style={{ color: YELLOW }} />
          <h1 className="ole-headline-italic text-3xl">Link enviado</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Enviamos um link de acesso para <b className="text-white">{email.trim()}</b>. Abra seu e-mail e toque no
            link para entrar — sem senha.
          </p>
          <button
            onClick={() => setState('idle')}
            className="mt-5 text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white"
          >
            Usar outro e-mail
          </button>
        </div>
      ) : (
        <>
          <h1 className="ole-headline-italic leading-[0.95]" style={{ fontSize: 'clamp(34px,9vw,52px)' }}>
            Bem-vindo,<br />lenda.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Seu espaço para acompanhar coleções, vendas e receber seus valores. Digite seu e-mail e enviamos um
            link de acesso.
          </p>
          <div className="mt-7 space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-4 text-base text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
            {state === 'error' && <p className="text-xs text-red-400">{err}</p>}
            <button
              onClick={() => void send()}
              disabled={state === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: YELLOW }}
            >
              {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Receber link de acesso'}
            </button>
          </div>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-white/35">
            Prefere WhatsApp? Peça seu link direto ao seu contato na OLEFOOT.
          </p>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function PlayerVipDashboard() {
  const [cards, setCards] = useState<LinkedCardRow[]>([]);
  const [sales, setSales] = useState<CardSaleRow[]>([]);
  const [summary, setSummary] = useState<CardSalesSummary>({ totalSales: 0, broOwnerCents: 0, olefootOwnerCents: 0, facilitatorSales: 0, facilitatorBroCents: 0, lastSaleAt: null });
  const [withdrawable, setWithdrawable] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [commissionBroCents, setCommissionBroCents] = useState(0);
  const [likes, setLikes] = useState(0);
  const [referrals, setReferrals] = useState<ReferredProfile[]>([]);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [kycApproved, setKycApproved] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [modal, setModal] = useState<null | 'withdraw' | 'support' | 'collection'>(null);
  const [copied, setCopied] = useState(false);

  const reloadWithdrawals = useCallback(async () => {
    setWithdrawals(await getMyWithdrawals());
    setWithdrawable(await getMyWithdrawableBalance());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, cardSales, sum, avail, comm, likeCount, refs, code, ver, wds] = await Promise.all([
        getMyLinkedCards(),
        getMyCardSales(50),
        getMyCardSalesSummary(),
        getMyWithdrawableBalance(),
        fetchMyAffiliateCommissions(),
        getMyCollectionLikes(),
        fetchMyReferrals(),
        fetchMyReferralCode(),
        getMyVerification(),
        getMyWithdrawals(),
      ]);
      if (cancelled) return;
      setCards(list);
      setSales(cardSales);
      setSummary(sum);
      setWithdrawable(avail);
      setCommissionBroCents(totalPendingByCurrency(comm).BRO ?? 0);
      setLikes(likeCount);
      setReferrals(refs);
      setRefCode(code);
      setKycApproved(ver?.verification_status === 'approved');
      setWithdrawals(wds);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime de novas vendas (card_sales)
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    void sb.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid || cancelled) return;
      cleanup = subscribeMyCardSales(uid, (row) => {
        const isFac = row.role === 'facilitator';
        const bro = row.currency === 'BRO' ? Number(row.owner_cents || 0) : 0;
        setSales((prev) => [row, ...prev].slice(0, 50));
        setSummary((prev) => ({
          totalSales: prev.totalSales + (isFac ? 0 : 1),
          broOwnerCents: prev.broOwnerCents + (isFac ? 0 : bro),
          olefootOwnerCents: prev.olefootOwnerCents + (!isFac && row.currency === 'OLEFOOT' ? Number(row.owner_cents || 0) : 0),
          facilitatorSales: prev.facilitatorSales + (isFac ? 1 : 0),
          facilitatorBroCents: prev.facilitatorBroCents + (isFac ? bro : 0),
          lastSaleAt: row.created_at,
        }));
        if (row.currency === 'BRO') setWithdrawable((w) => w + Number(row.owner_cents || 0));
        setFlashId(row.id);
        setTimeout(() => setFlashId((c) => (c === row.id ? null : c)), 5000);
      });
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);

  // Sync: recarrega coleções ao voltar pra aba (card lançado no ADMIN aparece
  // sem precisar recarregar a página).
  const reloadCards = useCallback(async () => {
    const [list, likeCount] = await Promise.all([getMyLinkedCards(), getMyCollectionLikes()]);
    setCards(list);
    setLikes(likeCount);
  }, []);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void reloadCards(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reloadCards]);

  // Vendas agregadas por card (fonte: card_sales — só como DONO, role=player)
  const salesByCard = useMemo(() => {
    const m = new Map<string, { count: number; broCents: number; olefootCents: number }>();
    for (const s of sales) {
      if (s.role === 'facilitator') continue;
      const cur = m.get(s.legacy_player_id) ?? { count: 0, broCents: 0, olefootCents: 0 };
      cur.count += 1;
      if (s.currency === 'BRO') cur.broCents += Number(s.owner_cents || 0);
      else if (s.currency === 'OLEFOOT') cur.olefootCents += Number(s.owner_cents || 0);
      m.set(s.legacy_player_id, cur);
    }
    return m;
  }, [sales]);

  const shareUrl = refCode ? inviteLinkForCode(refCode) : '';

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function shareLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'OLEFOOT', text: 'Entre na OLEFOOT', url: shareUrl }); return; } catch { /* fallthrough */ }
    }
    copyLink();
  }
  async function logout() {
    const sb = getSupabase();
    try { await sb?.auth.signOut(); } catch { /* noop */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* Top bar */}
      <header className="sticky top-0 z-20 -mx-4 mb-2 flex items-center justify-between bg-gradient-to-b from-[#0a0a0b] via-[#0a0a0b] to-transparent px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-2.5 rounded-sm" style={{ background: YELLOW, boxShadow: '0 0 18px rgba(253,225,0,.4)' }} />
          <span className="font-display text-[13px] font-black uppercase tracking-wide">OLEFOOT</span>
          <span className="font-display text-[13px] font-black uppercase tracking-wide text-white/40">PLAYERVIP</span>
        </div>
        <button onClick={() => void logout()} className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* SALDO HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10"
        style={{ background: 'radial-gradient(130% 100% at 100% 0%, rgba(253,225,0,.08), transparent 55%), linear-gradient(180deg,#17171b,#121214)' }}>
        <div className="flex flex-wrap items-end justify-between gap-5 p-7 pb-5">
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Disponível para saque</div>
            <div className="mt-3 italic leading-none text-white" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 'clamp(44px,12vw,64px)' }}>
              {loading ? '—' : brl(withdrawable)}
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setModal('withdraw')}
              className="rounded-xl px-6 py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
              style={{ background: YELLOW, boxShadow: '0 0 30px rgba(253,225,0,.25)' }}
            >
              Sacar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-7 pb-6">
          {withdrawals.some((w) => w.status === 'pending') && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/60">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f5a524', boxShadow: '0 0 8px #f5a524' }} />
              Saque em análise
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/60">
            Depósito em até <b className="text-white">2 dias úteis</b>
          </span>
        </div>
      </section>

      {/* STAT STRIP */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <RailStat label="Coleções" value={loading ? '—' : String(cards.length)} />
        <RailStat label="Vendidos" value={loading ? '—' : String(summary.totalSales)} rail="var(--good, #46d07f)" />
        <RailStat label="Curtidas" value={loading ? '—' : likes.toLocaleString('pt-BR')} />
        <RailStat label="Indicados" value={loading ? '—' : String(referrals.length)} />
      </div>

      {/* COMISSÃO DE FACILITADOR — só aparece se a lenda trouxe outras lendas */}
      {!loading && (summary.facilitatorBroCents > 0 || summary.facilitatorSales > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-5 py-4"
          style={{ background: 'linear-gradient(180deg,#17171b,#121214)' }}>
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
              Comissão de facilitador
            </div>
            <div className="mt-0.5 text-[11px] text-white/45">
              {summary.facilitatorSales} venda{summary.facilitatorSales === 1 ? '' : 's'} de lendas que você trouxe
            </div>
          </div>
          <div className="italic text-white" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26 }}>
            {brl(summary.facilitatorBroCents)}
          </div>
        </div>
      )}

      {/* COLEÇÕES */}
      <SectionHeader title="Minhas Coleções" />
      {loading ? (
        <SkeletonRows n={2} />
      ) : cards.length === 0 ? (
        <EmptyCard>Assim que suas coleções forem publicadas, elas aparecem aqui.</EmptyCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cards.map((c) => {
            const cardStats = salesByCard.get(c.id) ?? { count: 0, broCents: 0, olefootCents: 0 };
            const phase = phaseFromId(c.id);
            return (
              <div key={`${c.source}:${c.id}`} className="relative flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-[#121214]">
                <span className="absolute inset-y-[15%] left-0 w-[3px] rounded-r" style={{ background: YELLOW }} />
                <div className="relative m-3.5 ml-5 flex w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#22222a] to-[#0e0e11]">
                  {c.portrait_public_url ? (
                    <img src={c.portrait_public_url} alt={c.name}
                      className="h-full w-full object-cover opacity-90" style={{ filter: 'grayscale(.15)' }} loading="lazy" />
                  ) : (
                    <span className="grid h-full w-full place-items-center italic text-white/10"
                      style={{ fontFamily: SERIF, fontSize: 64 }}>{initialOf(c.name)}</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-4 pr-3">
                  <div className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                    {phase ? `Fase · ${phase}` : (c.rarity_label || 'Coleção')}
                  </div>
                  <h3 className="truncate text-[17px] font-extrabold">{c.name}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Kv k="Vendidos" v={String(cardStats.count)} />
                    {c.listed_on_market
                      ? <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: YELLOW }}>À venda</span>
                      : <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Pausada</span>}
                  </div>
                </div>
                <div className="hidden w-32 shrink-0 flex-col items-end justify-center gap-0.5 border-l border-white/10 px-5 sm:flex">
                  <div className="italic text-white" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22 }}>
                    {cardStats.broCents > 0 || cardStats.olefootCents === 0
                      ? brl(cardStats.broCents)
                      : `${formatExp(cardStats.olefootCents)}`}
                  </div>
                  <div className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">
                    {cardStats.broCents > 0 || cardStats.olefootCents === 0 ? 'Ganhos (R$)' : 'Ganhos (OLE)'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HISTÓRICO DE VENDAS */}
      <SectionHeader title="Histórico de Vendas" />
      {loading ? (
        <SkeletonRows n={3} />
      ) : sales.length === 0 ? (
        <EmptyCard>Quando alguém comprar um card seu, a venda aparece aqui na hora.</EmptyCard>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121214]">
          {sales.map((s, i) => {
            const name = cards.find((c) => c.id === s.legacy_player_id)?.name ?? s.legacy_player_id;
            const isBro = s.currency === 'BRO';
            const isFac = s.role === 'facilitator';
            return (
              <div key={s.id}
                className={cn('flex items-center gap-3.5 px-5 py-3.5 transition', i > 0 && 'border-t border-white/[0.07]',
                  flashId === s.id && 'bg-[rgba(70,208,127,.1)]')}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: isFac ? YELLOW : '#46d07f', boxShadow: `0 0 10px ${isFac ? 'rgba(253,225,0,.5)' : 'rgba(70,208,127,.5)'}` }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {isFac && <span className="mr-1.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: 'rgba(253,225,0,.14)', color: YELLOW }}>Comissão</span>}
                    {name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/45">
                    {isFac ? 'Facilitador · ' : ''}{isBro ? 'PIX' : 'OLEFOOT'} · {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="shrink-0 italic" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: isFac ? YELLOW : '#46d07f' }}>
                  +{isBro ? brl(s.owner_cents) : formatExp(s.owner_cents)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMISSÕES */}
      <SectionHeader title="Comissões" />
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1.35fr]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 p-5 pl-6"
          style={{ background: 'linear-gradient(180deg,#17171b,#121214)' }}>
          <span className="absolute inset-y-[12%] left-0 w-[3px] rounded-r" style={{ background: '#46d07f' }} />
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Recebido por indicações</div>
          <div className="mt-3 italic text-white" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40 }}>
            {loading ? '—' : brl(commissionBroCents)}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            Você ganha sobre as vendas dos jogadores que trouxe para a OLEFOOT.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121214]">
          {loading ? (
            <div className="p-5 text-sm text-white/40">Carregando…</div>
          ) : referrals.length === 0 ? (
            <div className="p-5 text-sm text-white/45">Você ainda não indicou ninguém. Compartilhe seu link abaixo.</div>
          ) : (
            referrals.slice(0, 6).map((r, i) => (
              <div key={r.id} className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && 'border-t border-white/[0.07]')}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-[#1c1c22] italic text-white/60"
                  style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14 }}>
                  {initialOf(r.displayName ?? r.clubName ?? '?')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.displayName ?? r.clubName ?? 'Manager'}</div>
                  <div className="mt-0.5 text-[11px] text-white/45">Entrou pelo seu link</div>
                </div>
                {/* Tamanho da equipe dele. A comissão sobre o EXP do indicado foi
                    removida em 2026-07-17 — agora o ganho vem por marco de rede. */}
                {r.legSize > 0 ? (
                  <span className="shrink-0 text-[11px] text-white/45">
                    equipe de {r.legSize.toLocaleString('pt-BR')}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* INDICAÇÃO */}
      <SectionHeader title="Indique uma Lenda" />
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-5"
        style={{ background: 'radial-gradient(120% 140% at 0% 0%, rgba(253,225,0,.09), transparent 50%), #121214' }}>
        <div className="min-w-0">
          <h4 className="text-base font-extrabold">Traga outros craques</h4>
          <p className="mt-1 text-xs text-white/50">Compartilhe seu link e ganhe comissão sobre o que eles venderem.</p>
        </div>
        <div className="flex items-center overflow-hidden rounded-xl border border-white/15 bg-[#0c0c0d]">
          <code className="max-w-[52vw] truncate px-3.5 text-xs font-semibold text-white/85 sm:max-w-[220px]">
            {shareUrl || '—'}
          </code>
          <button onClick={copyLink} disabled={!shareUrl}
            className="px-3 py-3.5 text-white/60 hover:text-white disabled:opacity-40" aria-label="Copiar link">
            {copied ? <CheckCircle2 className="h-4 w-4" style={{ color: '#46d07f' }} /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={() => void shareLink()} disabled={!shareUrl}
            className="px-4 py-3.5 font-display text-xs font-black uppercase tracking-wider text-black disabled:opacity-40"
            style={{ background: YELLOW }}>
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AÇÕES */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <ActionTile icon={<Plus className="h-5 w-5" />} accent={YELLOW}
          title="Nova coleção" desc="Peça novos cards seus. Você aprova arte e atributos antes do lançamento."
          onClick={() => setModal('collection')} />
        <ActionTile icon={<MessageCircle className="h-5 w-5" />} accent="#5b8def"
          title="Falar com a OLEFOOT" desc="Dúvida, saque, contrato? Nossa equipe responde por aqui."
          onClick={() => setModal('support')} />
      </div>

      <p className="mt-10 text-center text-[11px] tracking-wide text-white/25">
        OLEFOOT · <b className="text-white/45">PLAYERVIP</b> · Seu espaço de lenda
      </p>

      {/* ── Modais ── */}
      <WithdrawModal
        open={modal === 'withdraw'}
        onClose={() => setModal(null)}
        maxCents={withdrawable}
        kycApproved={kycApproved}
        onDone={() => { setModal(null); void reloadWithdrawals(); }}
      />
      <SupportModal open={modal === 'support'} onClose={() => setModal(null)} />
      <CollectionModal open={modal === 'collection'} onClose={() => setModal(null)} />
    </div>
  );
}

// ─── sub-componentes de layout ──────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 mt-11 flex items-center gap-3.5">
      <span className="h-8 w-[3px] rounded-sm" style={{ background: YELLOW }} />
      <h2 className="ole-headline-italic" style={{ fontSize: 'clamp(24px,6vw,32px)' }}>{title}</h2>
    </div>
  );
}
function Kv({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.12em] text-white/40">{k}</span>
      <span className="italic text-white" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16 }}>{v}</span>
    </span>
  );
}
function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-6 text-center text-sm text-white/55">{children}</div>;
}
function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
      ))}
    </div>
  );
}
function ActionTile({ icon, title, desc, accent, onClick }: {
  icon: React.ReactNode; title: string; desc: string; accent: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#121214] p-5 pl-6 text-left transition hover:border-white/20 hover:bg-[#1a1a1f]">
      <span className="absolute inset-y-[18%] left-0 w-[3px] rounded-r" style={{ background: accent }} />
      <span className="absolute right-4 top-5 text-white/25 transition group-hover:translate-x-0.5" style={{ color: accent }}>
        <ArrowUpRight className="h-4 w-4" />
      </span>
      <span className="mb-3 inline-block" style={{ color: accent }}>{icon}</span>
      <h4 className="text-base font-extrabold">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{desc}</p>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAIS DE AÇÃO
// ═══════════════════════════════════════════════════════════════════════════
function WithdrawModal({ open, onClose, maxCents, kycApproved, onDone }: {
  open: boolean; onClose: () => void; maxCents: number; kycApproved: boolean; onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => { if (open) { setAmount(''); setPixKey(''); setErr(''); setOk(false); setBusy(false); } }, [open]);

  const cents = Math.round((parseFloat(amount.replace(',', '.')) || 0) * 100);
  const valid = kycApproved && cents > 0 && cents <= maxCents && pixKey.trim().length >= 4;

  async function submit() {
    if (!valid) return;
    setBusy(true); setErr('');
    const r = await requestWithdrawal({ amountCents: cents, pixKey: pixKey.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Não foi possível.'); return; }
    setOk(true);
    setTimeout(onDone, 1400);
  }

  return (
    <ConfirmDialog
      open={open} onClose={onClose} onConfirm={() => void submit()}
      eyebrow="Saque · PIX" title={ok ? 'Pedido enviado' : 'Sacar valores'}
      confirmLabel={busy ? 'Enviando…' : 'Confirmar saque'} confirmDisabled={!valid || busy || ok}
    >
      {ok ? (
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Recebemos seu pedido. O depósito cai na conta em até <b className="text-white">2 dias úteis</b> após a conferência.
        </p>
      ) : !kycApproved ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5 text-[13px] leading-relaxed text-amber-100/85">
          <ShieldCheck className="mb-1.5 h-4 w-4 text-amber-300" />
          Para liberar saques precisamos verificar sua conta. Toque em <b>Falar com a OLEFOOT</b> que a gente resolve rápido.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Valor (R$)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#0c0c0d] px-3.5 py-3 text-base text-white outline-none focus:border-white/30" />
            <div className="mt-1 text-[11px] text-white/40">Disponível: <b className="text-white/70">{brl(maxCents)}</b></div>
          </div>
          <div>
            <label className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Chave PIX</label>
            <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail ou telefone"
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#0c0c0d] px-3.5 py-3 text-base text-white outline-none focus:border-white/30" />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}

function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setBody(''); setBusy(false); setOk(false); setErr(''); } }, [open]);

  async function submit() {
    if (body.trim().length < 3) return;
    setBusy(true); setErr('');
    const r = await sendSupportMessage({ body: body.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Não foi possível.'); return; }
    setOk(true); setTimeout(onClose, 1400);
  }
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={() => void submit()}
      eyebrow="Suporte" title={ok ? 'Mensagem enviada' : 'Falar com a OLEFOOT'}
      confirmLabel={busy ? 'Enviando…' : 'Enviar'} confirmDisabled={busy || ok || body.trim().length < 3}
      accent="#5b8def">
      {ok ? (
        <p className="mt-3 text-sm leading-relaxed text-white/70">Recebemos sua mensagem. Responderemos por e-mail em breve.</p>
      ) : (
        <div className="mt-4">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Como podemos ajudar?"
            className="w-full resize-none rounded-lg border border-white/12 bg-[#0c0c0d] px-3.5 py-3 text-base text-white outline-none focus:border-white/30" />
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}

function CollectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [athlete, setAthlete] = useState('');
  const [notes, setNotes] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setAthlete(''); setNotes(''); setRef(''); setBusy(false); setOk(false); setErr(''); } }, [open]);

  async function submit() {
    if (athlete.trim().length < 2) return;
    setBusy(true); setErr('');
    const r = await requestNewCollection({ athleteName: athlete.trim(), notes: notes.trim() || undefined, referredName: ref.trim() || undefined });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Não foi possível.'); return; }
    setOk(true); setTimeout(onClose, 1400);
  }
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={() => void submit()}
      eyebrow="Nova coleção" title={ok ? 'Solicitação enviada' : 'Pedir nova coleção'}
      confirmLabel={busy ? 'Enviando…' : 'Solicitar'} confirmDisabled={busy || ok || athlete.trim().length < 2}>
      {ok ? (
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          <Sparkles className="mb-1 mr-1 inline h-4 w-4" style={{ color: YELLOW }} />
          Recebemos! Nossa equipe monta a proposta e envia para sua aprovação.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <input value={athlete} onChange={(e) => setAthlete(e.target.value)} placeholder="Atleta (você ou um indicado)"
            className="w-full rounded-lg border border-white/12 bg-[#0c0c0d] px-3.5 py-3 text-base text-white outline-none focus:border-white/30" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="O que essa coleção deve ter? (opcional)"
            className="w-full resize-none rounded-lg border border-white/12 bg-[#0c0c0d] px-3.5 py-3 text-base text-white outline-none focus:border-white/30" />
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Está indicando alguém? Nome (opcional)"
            className="w-full rounded-lg border border-white/12 bg-[#0c0c0d] px-3.5 py-3 text-base text-white outline-none focus:border-white/30" />
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}

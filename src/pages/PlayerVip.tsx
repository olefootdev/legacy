/**
 * PLAYERVIP — game.olefoot.ai/playervip
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
  ShieldCheck, LogOut, Sparkles, Loader2,
} from 'lucide-react';
import { getSupabase } from '@/supabase/client';
import { getMyLinkedCards, type LinkedCardRow } from '@/admin/playerLinking';
import { LegendContributionModal } from '@/components/playervip/LegendContributionModal';
import type { ContributionKind } from '@/supabase/legendContributions';
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
import { ConfirmDialog } from '@/components/ui';
import { BotaoRua, MarcaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CAMPO_RUA } from '@/components/bolsa/Bolsa';
import { cn } from '@/lib/utils';
import { L, LOCALE, emIngles } from '@/i18n/L';

/** Campo de formulário DS 2027: asfalto chapado, canto vivo, foco em rua. */
const INPUT = CAMPO_RUA;
/** Rótulo "— PROVA" (dinheiro, seção, campo). */
const ROTULO = 'font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo';

const PHASE_LABEL: Record<string, string> = {
  revelacao: L('Revelação', 'Breakthrough'),
  consolidacao: L('Consolidação', 'Consolidation'),
  expansao: L('Expansão', 'Expansion'),
};

function brl(cents: number): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
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
    <div className="rua-grao min-h-screen w-full overflow-x-hidden bg-asfalto-27 font-sans text-papel">
      {session === 'loading' ? (
        <div className="grid min-h-screen place-items-center text-rua">
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
    if (!sb) { setErr(L('Serviço indisponível.', 'Service unavailable.')); setState('error'); return; }
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setErr(L('Digite um e-mail válido.', 'Enter a valid email.')); setState('error'); return; }
    setState('sending'); setErr('');
    const { error } = await sb.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: `${window.location.origin}/playervip` },
    });
    if (error) { setErr(L('Não conseguimos enviar. Tente de novo.', "We couldn't send it. Try again.")); setState('error'); return; }
    setState('sent');
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <MarcaPlayerVip />

      {state === 'sent' ? (
        // Lambe de cal colado torto: o recado ficou no muro.
        <div className="flex min-w-0 -rotate-1 flex-col gap-3 bg-cal p-6 text-asfalto-27 shadow-[5px_5px_0_var(--color-rua)]">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em]">— {L('Confere teu e-mail', 'Check your email')}</span>
          <h1 className="font-voz text-[clamp(40px,11vw,54px)] leading-[0.95]">{L('Link enviado.', 'Link sent.')}</h1>
          <p className="font-sans text-[15px] leading-relaxed">
            {emIngles() ? (
              <>We sent an access link to <b>{email.trim()}</b>. Open your email and tap the
              link to sign in — no password.</>
            ) : (
              <>Enviamos um link de acesso para <b>{email.trim()}</b>. Abra seu e-mail e toque no
              link para entrar — sem senha.</>
            )}
          </p>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[17px] uppercase underline-offset-4 hover:underline"
          >
            {L('Usar outro e-mail', 'Use another email')}
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <h1 className="flex flex-col leading-[0.9]">
            <span className="font-voz text-[clamp(48px,13vw,68px)] text-papel">{L('Bem-vindo,', 'Welcome,')}</span>
            <span className="font-impact text-[clamp(52px,15vw,84px)] uppercase text-ouro-27">{L('lenda.', 'legend.')}</span>
          </h1>
          <p className="font-sans text-[15px] leading-relaxed text-suave">
            {L('Digite seu e-mail e enviamos um link de acesso.', "Enter your email and we'll send you an access link.")}
          </p>
          <div className="flex min-w-0 flex-col gap-3">
            <label className={ROTULO} htmlFor="playervip-email">E-mail</label>
            <input
              id="playervip-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              placeholder={L('seu@email.com', 'you@email.com')}
              className={cn(INPUT, 'py-4')}
            />
            {state === 'error' && <p className="font-sans text-[13px] font-semibold text-baixa">{err}</p>}
            <BotaoRua onClick={() => void send()} disabled={state === 'sending'} className="mt-1 w-full">
              {state === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{L('Receber link de acesso', 'Get access link')} <span aria-hidden>→</span></>}
            </BotaoRua>
          </div>
          <p className="font-prova text-[11px] uppercase leading-relaxed tracking-[0.08em] text-mudo">
            {L('Prefere WhatsApp? Peça seu link direto ao seu contato na OLEFOOT.', 'Prefer WhatsApp? Ask your OLEFOOT contact for your link.')}
          </p>
        </div>
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
  const [summary, setSummary] = useState<CardSalesSummary>({ totalSales: 0, broOwnerCents: 0, olefootOwnerCents: 0, facilitatorSales: 0, facilitatorBroCents: 0, platformSales: 0, platformBroCents: 0, lastSaleAt: null });
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
  const [contribution, setContribution] = useState<{ kind: ContributionKind; card: LinkedCardRow | null } | null>(null);
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
        // 4 papéis desde 2026-07-17: player · facilitator · olefoot · community.
        // Os dois últimos são a receita da plataforma e só caem na conta OLEFOOT.
        const isFac = row.role === 'facilitator';
        const isPlatform = row.role === 'olefoot' || row.role === 'community';
        const isOwner = !isFac && !isPlatform;
        const bro = row.currency === 'BRO' ? Number(row.owner_cents || 0) : 0;
        setSales((prev) => [row, ...prev].slice(0, 50));
        setSummary((prev) => ({
          totalSales: prev.totalSales + (isOwner ? 1 : 0),
          broOwnerCents: prev.broOwnerCents + (isOwner ? bro : 0),
          olefootOwnerCents: prev.olefootOwnerCents + (isOwner && row.currency === 'OLEFOOT' ? Number(row.owner_cents || 0) : 0),
          facilitatorSales: prev.facilitatorSales + (isFac ? 1 : 0),
          facilitatorBroCents: prev.facilitatorBroCents + (isFac ? bro : 0),
          platformSales: prev.platformSales + (isPlatform ? 1 : 0),
          platformBroCents: prev.platformBroCents + (isPlatform ? bro : 0),
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

  // Vendas agregadas por card (fonte: card_sales — só como DONO, role=player).
  // facilitator e as fatias da plataforma (olefoot/community) ficam de fora:
  // não são venda do card do atleta.
  const salesByCard = useMemo(() => {
    const m = new Map<string, { count: number; broCents: number; olefootCents: number }>();
    for (const s of sales) {
      if (s.role !== 'player') continue;
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
      try { await navigator.share({ title: 'OLEFOOT', text: L('Entre na OLEFOOT', 'Join OLEFOOT'), url: shareUrl }); return; } catch { /* fallthrough */ }
    }
    copyLink();
  }
  async function logout() {
    const sb = getSupabase();
    try { await sb?.auth.signOut(); } catch { /* noop */ }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl px-4 pb-24 pt-6">
      {/* Top bar */}
      <header className="sticky top-0 z-20 -mx-4 mb-6 flex max-w-none items-center justify-between border-b-2 border-linha bg-asfalto-27 px-4 py-3">
        <MarcaPlayerVip />
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex h-11 w-11 items-center justify-center text-mudo transition-colors hover:text-papel"
          aria-label={L('Sair', 'Sign out')}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* SALDO — degrau RESPEITO: asfalto + fio de ouro. O botão de rua manda. */}
      <section aria-label={L('Disponível para saque', 'Available to withdraw')} className="flex min-w-0 flex-col gap-5 border-[3px] border-ouro-27 bg-asfalto-27 p-5 sm:p-7">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-ouro-27">— {L('Disponível para saque', 'Available to withdraw')}</span>
            <span className="block min-w-0 font-spray font-black leading-[0.85] tabular-nums text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(44px,13vw,80px)' }}>
              {loading ? '—' : brl(withdrawable)}
            </span>
          </div>
          <MarcaRua tipo="nove" className="hidden h-20 bg-ouro-27 sm:block" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {withdrawals.some((w) => w.status === 'pending') && (
            <SeloRua tom="cal">{L('Saque em análise', 'Withdrawal under review')}</SeloRua>
          )}
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo">
            {emIngles()
              ? <>Deposit within <span className="text-papel">2 business days</span></>
              : <>Depósito em até <span className="text-papel">2 dias úteis</span></>}
          </span>
        </div>
        <BotaoRua onClick={() => setModal('withdraw')} className="w-full sm:w-auto sm:self-start">
          {L('Sacar', 'Withdraw')} <span aria-hidden>→</span>
        </BotaoRua>
      </section>

      {/* NÚMEROS */}
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Numero label={L('Coleções', 'Collections')} value={loading ? '—' : String(cards.length)} />
        <Numero label={L('Vendidos', 'Sold')} value={loading ? '—' : String(summary.totalSales)} />
        <Numero label={L('Curtidas', 'Likes')} value={loading ? '—' : likes.toLocaleString(LOCALE)} />
        <Numero label={L('Indicados', 'Referrals')} value={loading ? '—' : String(referrals.length)} />
      </div>

      {/* COMISSÃO DE FACILITADOR — só aparece se a lenda trouxe outras lendas */}
      {!loading && (summary.facilitatorBroCents > 0 || summary.facilitatorSales > 0) && (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 bg-concreto px-5 py-4">
          <div className="min-w-0">
            <div className={ROTULO}>
              {L('Comissão de facilitador', 'Facilitator commission')}
            </div>
            <div className="mt-1 font-sans text-[13px] text-suave">
              {emIngles()
                ? `${summary.facilitatorSales} sale${summary.facilitatorSales === 1 ? '' : 's'} by legends you brought in`
                : `${summary.facilitatorSales} venda${summary.facilitatorSales === 1 ? '' : 's'} de lendas que você trouxe`}
            </div>
          </div>
          <div className="shrink-0 font-impact text-[24px] leading-none tabular-nums text-papel">
            {brl(summary.facilitatorBroCents)}
          </div>
        </div>
      )}

      {/* RECEITA DA PLATAFORMA — só aparece na conta OLEFOOT (fatias
          olefoot 25% + community 15%). Pro atleta isso é sempre zero. */}
      {!loading && summary.platformSales > 0 && (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 border-2 border-ouro-27 bg-asfalto-27 px-5 py-4">
          <div className="min-w-0">
            <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-ouro-27">
              {L('Receita OLEFOOT', 'OLEFOOT revenue')}
            </div>
            <div className="mt-1 font-sans text-[13px] text-suave">
              {emIngles()
                ? `${summary.platformSales} card sale payout${summary.platformSales === 1 ? '' : 's'} (25% + 15%)`
                : `${summary.platformSales} repasse${summary.platformSales === 1 ? '' : 's'} de venda de card (25% + 15%)`}
            </div>
          </div>
          <div className="shrink-0 font-impact text-[24px] leading-none tabular-nums text-ouro-27">
            {brl(summary.platformBroCents)}
          </div>
        </div>
      )}

      {/* COLEÇÕES */}
      <SectionHeader title={L('Minhas coleções', 'My collections')} aside={!loading && cards.length > 0 ? String(cards.length) : undefined} />
      {loading ? (
        <SkeletonRows n={2} />
      ) : cards.length === 0 ? (
        <EmptyCard>{L('Assim que suas coleções forem publicadas, elas aparecem aqui.', 'Once your collections are published, they show up here.')}</EmptyCard>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          {cards.map((c) => {
            const cardStats = salesByCard.get(c.id) ?? { count: 0, broCents: 0, olefootCents: 0 };
            const phase = phaseFromId(c.id);
            const ganhoBro = cardStats.broCents > 0 || cardStats.olefootCents === 0;
            return (
              <div key={`${c.source}:${c.id}`} className="flex min-w-0 items-stretch gap-3.5 bg-concreto p-3">
                {/* Retrato no degrau RESPEITO: a coleção já existe e tem valor. */}
                <div className="relative w-[84px] shrink-0 overflow-hidden border-[3px] border-ouro-27 bg-asfalto-27 sm:w-24">
                  {c.portrait_public_url ? (
                    <img src={c.portrait_public_url} alt={c.name}
                      className="absolute inset-0 object-cover"
                      // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
                      // fora de camada, que vence o h-full do Tailwind.
                      style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition: '50% 16%' }} loading="lazy" />
                  ) : (
                    <span className="grid h-full min-h-[104px] w-full place-items-center font-voz text-[52px] text-ouro-27/40">
                      {initialOf(c.name)}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
                  <div className={cn(ROTULO, 'truncate')}>
                    {phase ? `${L('Fase', 'Phase')} · ${phase}` : (c.rarity_label || L('Coleção', 'Collection'))}
                  </div>
                  <h3 className="block min-w-0 truncate font-voz text-[26px] leading-none text-papel">{c.name}</h3>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                    {c.listed_on_market
                      ? <SeloRua tom="cal" className="py-0.5 text-[10.5px]">{L('À venda', 'For sale')}</SeloRua>
                      : <SeloRua tom="mudo" className="py-0 text-[10.5px]">{L('Pausada', 'Paused')}</SeloRua>}
                    <Kv k={L('Vendidos', 'Sold')} v={String(cardStats.count)} />
                    <Kv
                      k={ganhoBro ? L('Ganhos', 'Earnings') : L('Ganhos OLE', 'OLE earnings')}
                      v={ganhoBro ? brl(cardStats.broCents) : formatExp(cardStats.olefootCents)}
                    />
                  </div>
                  {/* Só quem é dono do card chega aqui (get_my_linked_cards filtra por
                      beneficiary) — e o servidor recusa de novo no RPC. */}
                  <div className="mt-0.5 flex flex-wrap gap-x-4">
                    <button type="button" onClick={() => setContribution({ kind: 'correcao', card: c })}
                      className="inline-flex min-h-[36px] items-center font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-suave underline-offset-4 transition-colors hover:text-rua hover:underline">
                      {L('Sugerir correção', 'Suggest a fix')}
                    </button>
                    <button type="button" onClick={() => setContribution({ kind: 'historia', card: c })}
                      className="inline-flex min-h-[36px] items-center font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-suave underline-offset-4 transition-colors hover:text-rua hover:underline">
                      {L('Contar a história', 'Tell the story')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HISTÓRICO DE VENDAS */}
      <SectionHeader title={L('Histórico de vendas', 'Sales history')} aside={<span className="text-rua">● {L('Ao vivo', 'Live')}</span>} />
      {loading ? (
        <SkeletonRows n={3} />
      ) : sales.length === 0 ? (
        <EmptyCard>{L('Quando alguém comprar um card seu, a venda aparece aqui na hora.', 'When someone buys one of your cards, the sale shows up here instantly.')}</EmptyCard>
      ) : (
        <div className="flex min-w-0 flex-col gap-1.5">
          {sales.map((s) => {
            const name = cards.find((c) => c.id === s.legacy_player_id)?.name ?? s.legacy_player_id;
            const isBro = s.currency === 'BRO';
            const isFac = s.role === 'facilitator';
            const isPlatform = s.role === 'olefoot' || s.role === 'community';
            const tag = isFac ? L('Comissão', 'Commission') : s.role === 'olefoot' ? 'Olefoot 25%' : s.role === 'community' ? L('Comunidade 15%', 'Community 15%') : null;
            const nova = flashId === s.id;
            return (
              <div key={s.id}
                className={cn(
                  'flex min-w-0 items-center gap-3.5 px-4 py-3 transition',
                  // Venda que acabou de cair: lambe de rua colado por cima.
                  nova ? '-rotate-1 bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]' : 'bg-concreto',
                )}>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {nova && <SeloRua tom="corre" className="bg-asfalto-27 py-0.5 text-[10px] text-rua">{L('Agora', 'Now')}</SeloRua>}
                    {tag && !nova && <SeloRua tom="ouro-contorno" className="py-0 text-[10px]">{tag}</SeloRua>}
                    <span className="block min-w-0 truncate font-voz text-[22px] leading-none">{name}</span>
                  </div>
                  <div className={cn('mt-1 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.1em]', nova ? 'text-asfalto-27/75' : 'text-mudo')}>
                    {isFac ? L('Facilitador · ', 'Facilitator · ') : isPlatform ? L('Plataforma · ', 'Platform · ') : ''}{isBro ? 'PIX' : 'OLEFOOT'} · {new Date(s.created_at).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={cn('shrink-0 font-impact text-[19px] leading-none tabular-nums', nova ? 'text-asfalto-27' : isFac || isPlatform ? 'text-ouro-27' : 'text-alta')}>
                  +{isBro ? brl(s.owner_cents) : formatExp(s.owner_cents)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMISSÕES */}
      <SectionHeader title={L('Comissões', 'Commissions')} />
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-[1fr_1.35fr]">
        <div className="flex min-w-0 flex-col gap-2 bg-concreto p-5">
          <div className={ROTULO}>{L('Recebido por indicações', 'Earned from referrals')}</div>
          <div className="font-spray font-black leading-[0.9] tabular-nums text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(34px,10vw,44px)' }}>
            {loading ? '—' : brl(commissionBroCents)}
          </div>
          <p className="font-sans text-[13px] leading-relaxed text-suave">
            {L('Você ganha sobre as vendas dos jogadores que trouxe para a OLEFOOT.', 'You earn on sales by the players you brought to OLEFOOT.')}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden bg-concreto">
          {loading ? (
            <div className="p-5 font-sans text-sm text-mudo">{L('Carregando…', 'Loading…')}</div>
          ) : referrals.length === 0 ? (
            <div className="p-5 font-sans text-sm text-suave">{L('Você ainda não indicou ninguém. Compartilhe seu link abaixo.', "You haven't referred anyone yet. Share your link below.")}</div>
          ) : (
            referrals.slice(0, 6).map((r, i) => (
              <div key={r.id} className={cn('flex min-w-0 items-center gap-3 px-4 py-3', i > 0 && 'border-t-2 border-asfalto-27')}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cal font-voz text-[22px] leading-none text-asfalto-27">
                  {initialOf(r.displayName ?? r.clubName ?? '?')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-impact text-[17px] uppercase leading-tight text-papel">{r.displayName ?? r.clubName ?? 'Manager'}</div>
                  <div className="mt-0.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.1em] text-mudo">{L('Entrou pelo seu link', 'Joined via your link')}</div>
                </div>
                {/* Tamanho da equipe dele. A comissão sobre o EXP do indicado foi
                    removida em 2026-07-17 — agora o ganho vem por marco de rede. */}
                {r.legSize > 0 ? (
                  <span className="shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
                    {L('equipe de', 'team of')} {r.legSize.toLocaleString(LOCALE)}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* INDICAÇÃO — momento rua: faixa amarela com alambrado (é ação: chamar). */}
      <SectionHeader title={L('Indique uma lenda', 'Refer a legend')} />
      <div className="relative flex min-w-0 flex-col gap-4 overflow-hidden bg-rua p-5 text-asfalto-27 sm:p-6">
        <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-28 [--alambrado:rgba(13,13,12,0.28)]" />
        <div className="relative flex min-w-0 items-center justify-between gap-3">
          <h4 className="font-impact text-[clamp(32px,9vw,48px)] uppercase leading-[0.88]">
            {L('Traga outros', 'Bring other')}
            <br />
            {L('craques', 'stars')}
          </h4>
          <MarcaRua tipo="nove" className="h-20 shrink-0 bg-asfalto-27" />
        </div>
        <p className="relative font-voz text-[clamp(20px,5.4vw,24px)] leading-[1.1]">
          {L('Compartilhe seu link e ganhe comissão sobre o que eles venderem.', 'Share your link and earn commission on what they sell.')}
        </p>
        <div className="relative flex min-w-0 items-stretch border-2 border-asfalto-27 bg-asfalto-27">
          <code className="flex min-w-0 grow items-center truncate px-3 font-prova text-[12px] font-medium text-papel">
            {shareUrl || '—'}
          </code>
          <button type="button" onClick={copyLink} disabled={!shareUrl}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center bg-cal text-asfalto-27 transition-colors hover:bg-papel disabled:opacity-40" aria-label={L('Copiar link', 'Copy link')}>
            {copied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <button type="button" onClick={() => void shareLink()} disabled={!shareUrl}
          className="relative inline-flex min-h-[52px] items-center justify-center gap-2 self-start bg-asfalto-27 px-6 font-impact text-[20px] uppercase leading-none text-rua transition-transform hover:-translate-y-0.5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-asfalto-27">
          <Share2 className="h-5 w-5" /> {copied ? L('Link copiado', 'Link copied') : L('Compartilhar', 'Share')} <span aria-hidden>→</span>
        </button>
      </div>

      {/* AÇÕES */}
      <div className="mt-6 grid min-w-0 gap-1.5 sm:grid-cols-2">
        <ActionTile icon={<Plus className="h-5 w-5" />} destaque
          title={L('Pedir um card meu', 'Request my own card')} desc={L('Conte o ano e o clube.', 'Tell us the year and the club.')}
          onClick={() => setContribution({ kind: 'novo_card', card: null })} />
        <ActionTile icon={<Sparkles className="h-5 w-5" />}
          title={L('Indicar um atleta', 'Refer an athlete')} desc={L('Quem merece uma coleção?', 'Who deserves a collection?')}
          onClick={() => setModal('collection')} />
        <ActionTile icon={<MessageCircle className="h-5 w-5" />}
          title={L('Falar com a OLEFOOT', 'Contact OLEFOOT')} desc={L('Dúvida, saque, contrato.', 'Questions, withdrawals, contracts.')}
          onClick={() => setModal('support')} />
      </div>

      <footer className="mt-12 flex min-w-0 items-end justify-between gap-4 border-t-2 border-linha pt-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="font-voz text-[clamp(32px,9vw,44px)] leading-none text-ouro-27">{L('Respeito é ouro.', 'Respect is gold.')}</span>
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">Olefoot · PlayerVip</span>
        </div>
        <MarcaRua tipo="escudo" className="h-12 bg-fio" />
      </footer>

      {/* ── Modais ── */}
      <WithdrawModal
        open={modal === 'withdraw'}
        onClose={() => setModal(null)}
        maxCents={withdrawable}
        kycApproved={kycApproved}
        onDone={() => { setModal(null); void reloadWithdrawals(); }}
      />
      <SupportModal open={modal === 'support'} onClose={() => setModal(null)} />
      <LegendContributionModal
        kind={contribution?.kind ?? null}
        cardId={contribution?.card?.id ?? null}
        cardName={contribution?.card?.name}
        onClose={() => setContribution(null)}
      />
      <CollectionModal open={modal === 'collection'} onClose={() => setModal(null)} />
    </div>
  );
}

// ─── sub-componentes de layout ──────────────────────────────────────────────
/** Wordmark + PLAYERVIP em mono — a assinatura das telas da lenda. */
function MarcaPlayerVip() {
  return (
    <div className="flex items-center gap-3">
      <MarcaRua tipo="wordmark" label="Olefoot" className="h-[19px] bg-rua" />
      <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">PlayerVip</span>
    </div>
  );
}
// Título de seção = SecaoRua ("— RÓTULO" em mono).
function SectionHeader({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return <SecaoRua label={title} aside={aside} className="mb-4 mt-12" />;
}
function Numero({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-concreto px-4 py-3.5">
      <span className="truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{label}</span>
      <span className="font-impact text-[30px] leading-none tabular-nums text-papel">{value}</span>
    </div>
  );
}
function Kv({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{k}</span>
      <span className="font-impact text-[16px] leading-none tabular-nums text-papel">{v}</span>
    </span>
  );
}
function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="border-2 border-dashed border-fio px-5 py-6 font-sans text-[14px] leading-snug text-suave">{children}</div>;
}
function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse bg-concreto" />
      ))}
    </div>
  );
}
function ActionTile({ icon, title, desc, destaque, onClick }: {
  icon: React.ReactNode; title: string; desc: string; destaque?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="group relative flex min-w-0 flex-col gap-2 border-2 border-linha bg-concreto p-5 text-left transition-colors hover:border-papel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rua">
      <span className={destaque ? 'text-rua' : 'text-mudo'}>{icon}</span>
      <h4 className="truncate pr-8 font-impact text-[22px] uppercase leading-[1.05] text-papel">{title}</h4>
      <p className="truncate font-sans text-[13px] text-suave">{desc}</p>
      <span aria-hidden className="absolute right-4 top-4 font-impact text-[22px] leading-none text-mudo transition-colors group-hover:text-rua">→</span>
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
    if (!r.ok) { setErr(r.error ?? L('Não foi possível.', 'Something went wrong.')); return; }
    setOk(true);
    setTimeout(onDone, 1400);
  }

  return (
    <ConfirmDialog
      open={open} onClose={onClose} onConfirm={() => void submit()}
      eyebrow={L('Saque · PIX', 'Withdrawal · PIX')} title={ok ? L('Pedido enviado', 'Request sent') : L('Sacar valores', 'Withdraw funds')}
      confirmLabel={busy ? L('Enviando…', 'Sending…') : L('Confirmar saque', 'Confirm withdrawal')} confirmDisabled={!valid || busy || ok}
    >
      {ok ? (
        <p className="mt-3 font-sans text-sm leading-relaxed text-papel">
          {emIngles()
            ? <>Request received. The deposit reaches your account within <b>2 business days</b> after review.</>
            : <>Recebemos seu pedido. O depósito cai na conta em até <b>2 dias úteis</b> após a conferência.</>}
        </p>
      ) : !kycApproved ? (
        <div className="mt-3 -rotate-1 bg-cal p-4 font-sans text-[13px] leading-relaxed text-asfalto-27">
          <ShieldCheck className="mb-1.5 h-5 w-5" />
          {emIngles()
            ? <>To unlock withdrawals we need to verify your account. Tap <b>Contact OLEFOOT</b> and we'll sort it out fast.</>
            : <>Para liberar saques precisamos verificar sua conta. Toque em <b>Falar com a OLEFOOT</b> que a gente resolve rápido.</>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className={ROTULO}>{L('Valor (R$)', 'Amount (R$)')}</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={L('0,00', '0.00')}
              className={cn(INPUT, 'mt-1')} />
            <div className="mt-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo">{L('Disponível', 'Available')} · <span className="text-papel">{brl(maxCents)}</span></div>
          </div>
          <div>
            <label className={ROTULO}>{L('Chave PIX', 'PIX key')}</label>
            <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder={L('CPF, e-mail ou telefone', 'CPF, email or phone')}
              className={cn(INPUT, 'mt-1')} />
          </div>
          {err && <p className="font-sans text-[13px] font-semibold text-baixa">{err}</p>}
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
    if (!r.ok) { setErr(r.error ?? L('Não foi possível.', 'Something went wrong.')); return; }
    setOk(true); setTimeout(onClose, 1400);
  }
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={() => void submit()}
      eyebrow={L('Suporte', 'Support')} title={ok ? L('Mensagem enviada', 'Message sent') : L('Falar com a OLEFOOT', 'Contact OLEFOOT')}
      confirmLabel={busy ? L('Enviando…', 'Sending…') : L('Enviar', 'Send')} confirmDisabled={busy || ok || body.trim().length < 3}>
      {ok ? (
        <p className="mt-3 font-sans text-sm leading-relaxed text-papel">{L('Recebemos sua mensagem. Responderemos por e-mail em breve.', "We got your message. We'll reply by email soon.")}</p>
      ) : (
        <div className="mt-4">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={L('Como podemos ajudar?', 'How can we help?')}
            className={cn(INPUT, 'resize-none')} />
          {err && <p className="mt-2 font-sans text-[13px] font-semibold text-baixa">{err}</p>}
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
    if (!r.ok) { setErr(r.error ?? L('Não foi possível.', 'Something went wrong.')); return; }
    setOk(true); setTimeout(onClose, 1400);
  }
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={() => void submit()}
      eyebrow={L('Indicação', 'Referral')} title={ok ? L('Indicação enviada', 'Referral sent') : L('Indicar um atleta', 'Refer an athlete')}
      confirmLabel={busy ? L('Enviando…', 'Sending…') : L('Solicitar', 'Submit')} confirmDisabled={busy || ok || athlete.trim().length < 2}>
      {ok ? (
        <p className="mt-3 font-sans text-sm leading-relaxed text-papel">
          <Sparkles className="mb-1 mr-1 inline h-4 w-4 text-rua" />
          {L('Recebemos! Nossa equipe monta a proposta e envia para sua aprovação.', 'Got it! Our team will put together the proposal and send it for your approval.')}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <input value={athlete} onChange={(e) => setAthlete(e.target.value)} placeholder={L('Nome do atleta que você indica', 'Name of the athlete you refer')}
            className={INPUT} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={L('Por que ele merece uma coleção? (opcional)', 'Why does he deserve a collection? (optional)')}
            className={cn(INPUT, 'resize-none')} />
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={L('Como falar com ele? WhatsApp ou e-mail (opcional)', 'How do we reach him? WhatsApp or email (optional)')}
            className={INPUT} />
          {err && <p className="font-sans text-[13px] font-semibold text-baixa">{err}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}

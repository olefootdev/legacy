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
import { RailStat, ConfirmDialog, SecaoVolt } from '@/components/ui';
import { cn } from '@/lib/utils';

const YELLOW = 'var(--color-neon-yellow)';
/** Verde de "entrou dinheiro" — token VOLT2 (alta), não hex solto. */
const ALTA = 'var(--color-alta)';
/** Campo de formulário VOLT2: asfalto chapado, canto vivo. */
const INPUT = 'w-full border border-white/16 bg-deep-black px-3.5 py-3 text-base text-white outline-none placeholder:text-poeira focus:border-neon-yellow';
/** Rótulo mono (dinheiro, seção, campo). */
const ROTULO = 'font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento';

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
    <div className="min-h-screen bg-deep-black text-white" style={{ fontFamily: 'var(--font-ui)' }}>
      {session === 'loading' ? (
        <div className="grid min-h-screen place-items-center text-cimento">
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
        <img src="/brand/olefoot-yellow-01.svg" alt="Olefoot" className="w-auto shrink-0" style={{ height: 22 }} />
        <span className="font-impact text-[15px] uppercase tracking-wide text-cimento">PLAYERVIP</span>
      </div>

      {state === 'sent' ? (
        <div className="border border-white/10 bg-panel p-7 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-neon-yellow" />
          <h1 className="font-impact text-[32px] uppercase leading-[1.05]">Link enviado</h1>
          <p className="mt-3 text-sm leading-relaxed text-cimento">
            Enviamos um link de acesso para <b className="text-white">{email.trim()}</b>. Abra seu e-mail e toque no
            link para entrar — sem senha.
          </p>
          <button
            onClick={() => setState('idle')}
            className="mt-5 text-xs font-bold uppercase tracking-wider text-cimento transition-colors hover:text-white"
          >
            Usar outro e-mail
          </button>
        </div>
      ) : (
        <>
          <h1 className="font-impact uppercase leading-[1.02]" style={{ fontSize: 'clamp(40px,12vw,64px)' }}>
            Bem-vindo,<br /><span className="text-neon-yellow">lenda.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-cimento">
            Digite seu e-mail e enviamos um link de acesso.
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
              className="w-full border border-white/16 bg-panel px-4 py-4 text-base text-white outline-none placeholder:text-poeira focus:border-neon-yellow"
            />
            {state === 'error' && <p className="text-xs text-baixa">{err}</p>}
            <button
              onClick={() => void send()}
              disabled={state === 'sending'}
              className="btn-primary flex h-14 w-full items-center justify-center gap-2 disabled:opacity-60"
            >
              {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Receber link de acesso'}
            </button>
          </div>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-poeira">
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
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex max-w-none items-center justify-between border-b border-white/10 bg-deep-black px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img src="/brand/olefoot-yellow-01.svg" alt="Olefoot" className="w-auto shrink-0" style={{ height: 19 }} />
          <span className="font-impact text-[13px] uppercase tracking-wide text-cimento">PLAYERVIP</span>
        </div>
        <button onClick={() => void logout()} className="flex items-center gap-1.5 text-xs text-cimento transition-colors hover:text-white" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* SALDO HERO */}
      <section className="border border-white/10 bg-panel">
        <div className="flex flex-wrap items-end justify-between gap-5 p-5 pb-4 sm:p-7 sm:pb-5">
          <div className="min-w-0">
            <div className={ROTULO}>Disponível para saque</div>
            <div className="ole-num mt-3 leading-none text-white [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(26px,8.5vw,52px)' }}>
              {loading ? '—' : brl(withdrawable)}
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setModal('withdraw')}
              className="btn-primary flex h-14 items-center justify-center"
            >
              Sacar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5 sm:px-7 sm:pb-6">
          {withdrawals.some((w) => w.status === 'pending') && (
            <span className="inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 font-mono text-[11px] font-medium text-cimento">
              <span className="h-1.5 w-1.5 rounded-full bg-atencao" />
              Saque em análise
            </span>
          )}
          <span className="inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 font-mono text-[11px] font-medium text-cimento">
            Depósito em até <b className="text-white">2 dias úteis</b>
          </span>
        </div>
      </section>

      {/* STAT STRIP */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <RailStat label="Coleções" value={loading ? '—' : String(cards.length)} />
        <RailStat label="Vendidos" value={loading ? '—' : String(summary.totalSales)} rail={ALTA} />
        <RailStat label="Curtidas" value={loading ? '—' : likes.toLocaleString('pt-BR')} />
        <RailStat label="Indicados" value={loading ? '—' : String(referrals.length)} />
      </div>

      {/* COMISSÃO DE FACILITADOR — só aparece se a lenda trouxe outras lendas */}
      {!loading && (summary.facilitatorBroCents > 0 || summary.facilitatorSales > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-3 border border-white/10 bg-panel px-5 py-4">
          <div className="min-w-0">
            <div className={ROTULO}>
              Comissão de facilitador
            </div>
            <div className="mt-0.5 text-[11px] text-cimento">
              {summary.facilitatorSales} venda{summary.facilitatorSales === 1 ? '' : 's'} de lendas que você trouxe
            </div>
          </div>
          <div className="ole-num shrink-0 text-[20px] text-white">
            {brl(summary.facilitatorBroCents)}
          </div>
        </div>
      )}

      {/* RECEITA DA PLATAFORMA — só aparece na conta OLEFOOT (fatias
          olefoot 25% + community 15%). Pro atleta isso é sempre zero. */}
      {!loading && summary.platformSales > 0 && (
        <div className="mt-2.5 flex items-center justify-between gap-3 border border-neon-yellow/30 bg-panel px-5 py-4">
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-neon-yellow">
              Receita OLEFOOT
            </div>
            <div className="mt-0.5 text-[11px] text-cimento">
              {summary.platformSales} repasse{summary.platformSales === 1 ? '' : 's'} de venda de card (25% + 15%)
            </div>
          </div>
          <div className="ole-num shrink-0 text-[20px] text-white">
            {brl(summary.platformBroCents)}
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
              <div key={`${c.source}:${c.id}`} className="flex items-stretch overflow-hidden border border-white/10 bg-panel">
                <div className="relative m-3.5 flex w-24 shrink-0 overflow-hidden border border-white/10 bg-card">
                  {c.portrait_public_url ? (
                    <img src={c.portrait_public_url} alt={c.name}
                      className="object-cover opacity-90"
                      // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
                      // fora de camada, que vence o h-full do Tailwind.
                      style={{ width: '100%', height: '100%', filter: 'grayscale(.15)' }} loading="lazy" />
                  ) : (
                    <span className="grid h-full w-full place-items-center font-impact text-[56px] uppercase text-white/10">
                      {initialOf(c.name)}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-4 pr-3">
                  <div className={cn(ROTULO, 'truncate')}>
                    {phase ? `Fase · ${phase}` : (c.rarity_label || 'Coleção')}
                  </div>
                  <h3 className="truncate font-impact text-[20px] uppercase leading-[1.1] text-white">{c.name}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Kv k="Vendidos" v={String(cardStats.count)} />
                    {c.listed_on_market
                      ? <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-neon-yellow">À venda</span>
                      : <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-poeira">Pausada</span>}
                  </div>
                  {/* Só quem é dono do card chega aqui (get_my_linked_cards filtra por
                      beneficiary) — e o servidor recusa de novo no RPC. */}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    <button type="button" onClick={() => setContribution({ kind: 'correcao', card: c })}
                      className="text-[11px] font-bold uppercase tracking-wider text-cimento underline-offset-2 transition-colors hover:text-white hover:underline">
                      Sugerir correção
                    </button>
                    <button type="button" onClick={() => setContribution({ kind: 'historia', card: c })}
                      className="text-[11px] font-bold uppercase tracking-wider text-cimento underline-offset-2 transition-colors hover:text-white hover:underline">
                      Contar a história
                    </button>
                  </div>
                </div>
                <div className="hidden w-36 shrink-0 flex-col items-end justify-center gap-0.5 border-l border-white/10 px-4 sm:flex">
                  <div className="max-w-full truncate font-mono text-[14px] font-medium text-white">
                    {cardStats.broCents > 0 || cardStats.olefootCents === 0
                      ? brl(cardStats.broCents)
                      : `${formatExp(cardStats.olefootCents)}`}
                  </div>
                  <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-poeira">
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
        <div className="overflow-hidden border border-white/10 bg-panel">
          {sales.map((s, i) => {
            const name = cards.find((c) => c.id === s.legacy_player_id)?.name ?? s.legacy_player_id;
            const isBro = s.currency === 'BRO';
            const isFac = s.role === 'facilitator';
            const isPlatform = s.role === 'olefoot' || s.role === 'community';
            const tag = isFac ? 'Comissão' : s.role === 'olefoot' ? 'Olefoot 25%' : s.role === 'community' ? 'Comunidade 15%' : null;
            const accent = isFac || isPlatform ? YELLOW : ALTA;
            return (
              <div key={s.id}
                className={cn('flex items-center gap-3.5 px-5 py-3.5 transition', i > 0 && 'border-t border-white/[0.07]',
                  flashId === s.id && 'bg-alta/10')}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {tag && <span className="mr-1.5 bg-neon-yellow/15 px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-wide text-neon-yellow">{tag}</span>}
                    {name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-cimento">
                    {isFac ? 'Facilitador · ' : isPlatform ? 'Plataforma · ' : ''}{isBro ? 'PIX' : 'OLEFOOT'} · {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={cn('ole-num shrink-0 text-[14px]', isFac ? 'text-neon-yellow' : 'text-alta')}>
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
        <div className="border border-white/10 bg-panel p-5">
          <div className={ROTULO}>Recebido por indicações</div>
          <div className="ole-num mt-3 text-white [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(24px,7vw,32px)' }}>
            {loading ? '—' : brl(commissionBroCents)}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-cimento">
            Você ganha sobre as vendas dos jogadores que trouxe para a OLEFOOT.
          </p>
        </div>
        <div className="overflow-hidden border border-white/10 bg-panel">
          {loading ? (
            <div className="p-5 text-sm text-poeira">Carregando…</div>
          ) : referrals.length === 0 ? (
            <div className="p-5 text-sm text-cimento">Você ainda não indicou ninguém. Compartilhe seu link abaixo.</div>
          ) : (
            referrals.slice(0, 6).map((r, i) => (
              <div key={r.id} className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && 'border-t border-white/[0.07]')}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/16 bg-card font-impact text-[15px] uppercase text-giz">
                  {initialOf(r.displayName ?? r.clubName ?? '?')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.displayName ?? r.clubName ?? 'Manager'}</div>
                  <div className="mt-0.5 text-[11px] text-cimento">Entrou pelo seu link</div>
                </div>
                {/* Tamanho da equipe dele. A comissão sobre o EXP do indicado foi
                    removida em 2026-07-17 — agora o ganho vem por marco de rede. */}
                {r.legSize > 0 ? (
                  <span className="shrink-0 font-mono text-[11px] text-cimento">
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
      <div className="flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-panel p-5">
        <div className="min-w-0">
          <h4 className="font-impact text-[20px] uppercase leading-[1.1] text-white">Traga outros craques</h4>
          <p className="mt-1 text-xs text-cimento">Compartilhe seu link e ganhe comissão sobre o que eles venderem.</p>
        </div>
        <div className="flex items-center overflow-hidden border border-white/16 bg-deep-black">
          <code className="max-w-[52vw] truncate px-3.5 font-mono text-xs font-medium text-giz sm:max-w-[220px]">
            {shareUrl || '—'}
          </code>
          <button onClick={copyLink} disabled={!shareUrl}
            className="px-3 py-3.5 text-cimento transition-colors hover:text-white disabled:opacity-40" aria-label="Copiar link">
            {copied ? <CheckCircle2 className="h-4 w-4 text-alta" /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={() => void shareLink()} disabled={!shareUrl}
            className="bg-neon-yellow px-4 py-3.5 font-display text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-white disabled:opacity-40">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AÇÕES */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <ActionTile icon={<Plus className="h-5 w-5" />} accent={YELLOW}
          title="Pedir um card meu" desc="Conte o ano e o clube."
          onClick={() => setContribution({ kind: 'novo_card', card: null })} />
        <ActionTile icon={<Sparkles className="h-5 w-5" />} accent="var(--color-lenda)"
          title="Indicar um atleta" desc="Quem merece uma coleção?"
          onClick={() => setModal('collection')} />
        <ActionTile icon={<MessageCircle className="h-5 w-5" />} accent="var(--color-giz)"
          title="Falar com a OLEFOOT" desc="Dúvida, saque, contrato."
          onClick={() => setModal('support')} />
      </div>

      <p className="mt-10 text-center font-mono text-[11px] tracking-wide text-poeira">
        OLEFOOT · <b className="font-medium text-cimento">PLAYERVIP</b>
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
// Título de seção = SecaoVolt (risco volt + mono + linha que se apaga).
function SectionHeader({ title }: { title: string }) {
  return <SecaoVolt label={title} className="mb-4 mt-11" />;
}
function Kv({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-poeira">{k}</span>
      <span className="ole-num text-[14px] text-white">{v}</span>
    </span>
  );
}
function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-white/10 bg-panel p-6 text-center text-sm text-cimento">{children}</div>;
}
function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse border border-white/10 bg-panel" />
      ))}
    </div>
  );
}
function ActionTile({ icon, title, desc, accent, onClick }: {
  icon: React.ReactNode; title: string; desc: string; accent: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="relative border border-white/10 bg-panel p-5 text-left transition-colors hover:border-white/30">
      <span className="absolute right-4 top-5" style={{ color: accent }}>
        <ArrowUpRight className="h-4 w-4" />
      </span>
      <span className="mb-3 inline-block" style={{ color: accent }}>{icon}</span>
      <h4 className="truncate pr-6 font-impact text-[20px] uppercase leading-[1.1] text-white">{title}</h4>
      <p className="mt-1 truncate text-xs text-cimento">{desc}</p>
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
        <p className="mt-3 text-sm leading-relaxed text-giz">
          Recebemos seu pedido. O depósito cai na conta em até <b className="text-white">2 dias úteis</b> após a conferência.
        </p>
      ) : !kycApproved ? (
        <div className="mt-3 border border-atencao/40 bg-atencao/10 p-3.5 text-[13px] leading-relaxed text-giz">
          <ShieldCheck className="mb-1.5 h-4 w-4 text-atencao" />
          Para liberar saques precisamos verificar sua conta. Toque em <b>Falar com a OLEFOOT</b> que a gente resolve rápido.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className={ROTULO}>Valor (R$)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              className={cn(INPUT, 'mt-1')} />
            <div className="mt-1 text-[11px] text-cimento">Disponível: <b className="font-mono font-medium text-white">{brl(maxCents)}</b></div>
          </div>
          <div>
            <label className={ROTULO}>Chave PIX</label>
            <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail ou telefone"
              className={cn(INPUT, 'mt-1')} />
          </div>
          {err && <p className="text-xs text-baixa">{err}</p>}
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
      confirmLabel={busy ? 'Enviando…' : 'Enviar'} confirmDisabled={busy || ok || body.trim().length < 3}>
      {ok ? (
        <p className="mt-3 text-sm leading-relaxed text-giz">Recebemos sua mensagem. Responderemos por e-mail em breve.</p>
      ) : (
        <div className="mt-4">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Como podemos ajudar?"
            className={cn(INPUT, 'resize-none')} />
          {err && <p className="mt-2 text-xs text-baixa">{err}</p>}
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
      eyebrow="Indicação" title={ok ? 'Indicação enviada' : 'Indicar um atleta'}
      confirmLabel={busy ? 'Enviando…' : 'Solicitar'} confirmDisabled={busy || ok || athlete.trim().length < 2}>
      {ok ? (
        <p className="mt-3 text-sm leading-relaxed text-giz">
          <Sparkles className="mb-1 mr-1 inline h-4 w-4 text-neon-yellow" />
          Recebemos! Nossa equipe monta a proposta e envia para sua aprovação.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <input value={athlete} onChange={(e) => setAthlete(e.target.value)} placeholder="Nome do atleta que você indica"
            className={INPUT} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Por que ele merece uma coleção? (opcional)"
            className={cn(INPUT, 'resize-none')} />
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Como falar com ele? WhatsApp ou e-mail (opcional)"
            className={INPUT} />
          {err && <p className="text-xs text-baixa">{err}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}

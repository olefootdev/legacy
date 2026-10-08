import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Lock,
  ChevronRight,
  Wallet,
  Trophy,
  Activity,
  ShieldCheck,
  TrendingUp,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { getMyVerification, type VerificationStatus } from '@/supabase/verification';
import { getMyLinkedCards, type LinkedCardRow } from '@/admin/playerLinking';
import {
  getMyProSummary,
  getMyProPayouts,
  subscribeMyProPayouts,
  type ProPayoutRow,
  type ProSummary,
} from '@/supabase/proPayouts';
import { getSupabase } from '@/supabase/client';
import { formatExp } from '@/systems/economy';
import { overallFromAttributes } from '@/entities/player';
import { cn } from '@/lib/utils';
import { rarityLabelPt } from '@/entities/rarityLabels';
import { L, LOCALE } from '@/i18n/L';
import { SecaoRua, SeloRua } from '@/components/ui';

export function ManagerPro() {
  const navigate = useNavigate();
  const players = useGameStore((s) => s.players);

  const academyCards = useMemo(
    () => Object.values(players).filter((p) => p.managerCreated === true),
    [players],
  );

  const [linkedCards, setLinkedCards] = useState<LinkedCardRow[]>([]);
  const [proSummary, setProSummary] = useState<ProSummary>({ balance_exp: 0, total_sales: 0, last_sale_at: null });
  const [proPayouts, setProPayouts] = useState<ProPayoutRow[]>([]);
  const [flashPayoutId, setFlashPayoutId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, sum, payouts] = await Promise.all([
        getMyLinkedCards(),
        getMyProSummary(),
        getMyProPayouts(50),
      ]);
      if (cancelled) return;
      setLinkedCards(list);
      if (sum) setProSummary(sum);
      setProPayouts(payouts);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      const uid = data?.user?.id;
      if (!uid || cancelled) return;
      cleanup = subscribeMyProPayouts(uid, (row) => {
        setProPayouts((prev) => [row, ...prev].slice(0, 50));
        setProSummary((prev) => ({
          balance_exp: prev.balance_exp + Number(row.amount_exp || 0),
          total_sales: prev.total_sales + 1,
          last_sale_at: row.created_at,
        }));
        setFlashPayoutId(row.id);
        setTimeout(() => setFlashPayoutId((cur) => (cur === row.id ? null : cur)), 5000);
      });
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const [verified, setVerified] = useState(false);
  const [vStatus, setVStatus] = useState<VerificationStatus>('not_submitted');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getMyVerification();
      if (cancelled) return;
      setVerified(Boolean(r?.verified));
      setVStatus((r?.verification_status as VerificationStatus) ?? 'not_submitted');
    })();
    return () => { cancelled = true; };
  }, []);

  const totalCards = academyCards.length + linkedCards.length;
  const listedCount =
    academyCards.filter((p) => p.listedOnMarket).length + linkedCards.filter((c) => c.listed_on_market).length;
  const balanceDisplay = verified ? `${formatExp(proSummary.balance_exp)} EXP` : `${formatExp(proSummary.balance_exp)} EXP`;
  const salesCount = proSummary.total_sales;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-7 px-3 pb-16 sm:px-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 items-end gap-3 border-b-2 border-papel pb-3 pt-2">
        <button
          type="button"
          onClick={() => navigate('/manager')}
          className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha text-mudo hover:border-papel hover:text-papel"
          aria-label={L('Voltar', 'Back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-ouro-27">
            — Manager · PRO
          </div>
          <h1 className="mt-1 font-impact uppercase text-papel" style={{ fontSize: 'clamp(36px, 10vw, 56px)', lineHeight: 0.9 }}>
            {L('Vendas dos teus cards', 'Your card sales')}
          </h1>
        </div>
      </div>

      {/* ── Banner de verificação (só se não verificado) — placa de cal ── */}
      {!verified ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex -rotate-[0.6deg] items-start gap-3 bg-cal p-4 text-asfalto-27"
        >
          <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-impact text-[19px] uppercase leading-[1.05]">
              {vStatus === 'pending'
                ? L('Em análise pelo Admin', 'Under Admin review')
                : vStatus === 'rejected'
                ? L('Verificação rejeitada — ajusta e reenvia', 'Verification rejected — fix and resubmit')
                : L('Modo prévia — conta não verificada', 'Preview mode — account not verified')}
            </p>
            <p className="mt-1.5 text-[13px] leading-snug">
              {vStatus === 'pending'
                ? L('Aguarda a aprovação. Assim que liberada, o saldo real e o botão de saque ficam ativos.', 'Awaiting approval. Once cleared, your real balance and withdraw button go live.')
                : L('Podes ver os teus cards e como ficará o painel. O saldo real e o saque ficam ativos depois que a verificação for aprovada pelo Admin.', 'You can see your cards and how the panel will look. Real balance and withdrawals go live once the Admin approves your verification.')}
            </p>
            {vStatus !== 'pending' ? (
              <Link
                to="/config"
                className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 bg-asfalto-27 px-4 font-impact text-[16px] uppercase leading-none text-rua hover:bg-concreto"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden /> {vStatus === 'rejected' ? L('Reenviar verificação', 'Resubmit verification') : L('Verificar conta', 'Verify account')}
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {/* ── KPIs principais ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={L('Saldo', 'Balance')}
          value={balanceDisplay}
          tone="yellow"
          footer={
            verified
              ? proSummary.balance_exp > 0 ? L('Pronto pra sacar', 'Ready to withdraw') : L('Sem saldo ainda', 'No balance yet')
              : L('Aguarda verificação', 'Awaiting verification')
          }
        />
        <KpiCard
          label={L('Vendas', 'Sales')}
          value={String(salesCount)}
          tone="emerald"
          footer={L('Cards vendidos no total', 'Total cards sold')}
        />
        <KpiCard
          label="Cards"
          value={String(totalCards)}
          tone="cyan"
          footer={L('Criados pelo manager', 'Created by manager')}
        />
        <KpiCard
          label={L('À venda', 'For sale')}
          value={String(listedCount)}
          tone="fuchsia"
          footer={L('Listados no mercado', 'Listed on the Market')}
        />
      </div>

      {/* ── Ações rápidas ──────────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          to="/wallet"
          className={cn(
            'group flex min-w-0 items-center gap-3 p-4 transition-colors',
            verified
              ? 'border-[3px] border-ouro-27 bg-asfalto-27 hover:bg-concreto'
              : 'pointer-events-none border-2 border-dashed border-fio',
          )}
        >
          <Download className={cn('h-6 w-6 shrink-0', verified ? 'text-ouro-27' : 'text-fio')} strokeWidth={2.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className={cn('font-impact text-[20px] uppercase leading-[1.05]', verified ? 'text-papel' : 'text-mudo')}>
              {L('Sacar para Wallet', 'Withdraw to Wallet')}
            </p>
            <p className="mt-0.5 font-prova text-[11.5px] text-mudo">
              {verified ? L('Converte saldo em BRO', 'Convert balance to BRO') : L('Disponível após verificação', 'Available after verification')}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-mudo transition-colors group-hover:text-papel" aria-hidden />
        </Link>

        <Link
          to="/city/youth-prospects"
          className="group flex min-w-0 items-center gap-3 bg-rua p-4 text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)]"
        >
          <TrendingUp className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-impact text-[20px] uppercase leading-[1.05]">
              {L('Criar novo card', 'Create new card')}
            </p>
            <p className="mt-0.5 font-prova text-[11.5px] font-bold">
              {L('#academia', '#academy')}
            </p>
          </div>
          <span aria-hidden className="shrink-0 font-impact text-[22px]">→</span>
        </Link>
      </div>

      {/* ── Meus cards ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <SecaoRua label={L('Meus cards', 'My cards')} aside={totalCards} />

        {totalCards === 0 ? (
          <div className="flex flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-5">
            <Trophy aria-hidden className="h-6 w-6 text-fio" />
            <p className="font-voz text-[23px] leading-[1.05] text-papel">{L('Ainda não criaste nenhum card e nada vinculado pelo Admin.', 'No cards created yet and nothing linked by the Admin.')}</p>
            <Link
              to="/city/youth-prospects"
              className="inline-flex min-h-[46px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
            >
              {L('Criar meu primeiro card', 'Create my first card')} <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col">
            {linkedCards.map((c) => {
              const playerPct = Array.isArray(c.payment_split)
                ? c.payment_split.find((e) => e.kind === 'player')?.percent ?? 50
                : 50;
              return (
                <li
                  key={`${c.source}:${c.id}`}
                  className="flex min-w-0 items-center justify-between gap-3 border-b border-linha py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-voz text-[22px] leading-none text-papel">{c.name}</p>
                    <p className="mt-1 truncate font-prova text-[11px] uppercase tracking-[0.06em] text-mudo">
                      {c.pos || '—'}
                      {c.rarity_label ? ` · ${rarityLabelPt(c.rarity_label)}` : ''}
                      {` · split ${playerPct}%`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.listed_on_market && <SeloRua tom="corre-contorno">{L('À venda', 'For sale')}</SeloRua>}
                    <SeloRua tom="ouro-contorno">{c.source}</SeloRua>
                  </div>
                </li>
              );
            })}
            {academyCards.map((p) => (
              <li
                key={`academy:${p.id}`}
                className="flex min-w-0 items-center justify-between gap-3 border-b border-linha py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-voz text-[22px] leading-none text-papel">{p.name}</p>
                  <p className="mt-1 truncate font-prova text-[11px] uppercase tracking-[0.06em] text-mudo">
                    {p.pos} · OVR {Math.round(overallFromAttributes(p.attrs, p.pos))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.listedOnMarket && <SeloRua tom="corre-contorno">{L('À venda', 'For sale')}</SeloRua>}
                  <SeloRua tom="mudo">academy</SeloRua>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Histórico de vendas ────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <SecaoRua label={L('Histórico de vendas', 'Sales history')} aside={proPayouts.length} />
        {proSummary.last_sale_at ? (
          <span className="flex items-center gap-1.5 font-prova text-[11px] uppercase tracking-[0.1em] text-mudo">
            <Activity aria-hidden className="h-3.5 w-3.5" />
            {L('Última', 'Last')}: {new Date(proSummary.last_sale_at).toLocaleString(LOCALE)}
          </span>
        ) : null}
        {proPayouts.length === 0 ? (
          <div className="flex flex-col items-start gap-2 border-2 border-dashed border-fio px-4 py-5">
            <p className="font-voz text-[23px] leading-[1.05] text-papel">{L('Sem vendas ainda.', 'No sales yet.')}</p>
            <p className="text-[12.5px] leading-snug text-suave">
              {L('Quando alguém comprar um card teu, a venda aparece aqui em tempo real.', 'When someone buys one of your cards, the sale shows up here in real time.')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {proPayouts.map((p) => {
              const isFlash = flashPayoutId === p.id;
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 border-b border-linha py-3 transition-colors last:border-b-0',
                    isFlash && 'border-l-[5px] border-l-rua bg-concreto pl-3',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-voz text-[21px] leading-none text-papel">
                      {p.player_name ?? p.player_id}
                    </p>
                    <p className="mt-1 truncate font-prova text-[11px] text-mudo">
                      {new Date(p.created_at).toLocaleString(LOCALE)} · {p.split_kind} · {p.percent}%
                    </p>
                  </div>
                  <span className="shrink-0 font-impact text-[20px] leading-none text-alta">
                    +{formatExp(p.amount_exp)} <span className="font-prova text-[11px] text-mudo">EXP</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Como funciona ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3 bg-concreto p-4">
        <SecaoRua label={L('Como o PRO funciona', 'How PRO works')} />
        <ol className="flex flex-col gap-2.5 text-[13px] leading-snug text-suave">
          {[
            L('Crias um card na Academia (ou vinculas um card real).', 'Create a card in the Academy (or link a real card).'),
            L('Anuncias no mercado com preço em EXP.', 'List it on the Market priced in EXP.'),
            L('Cada venda confirmada credita o teu saldo aqui em tempo real.', 'Each confirmed sale credits your balance here in real time.'),
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 shrink-0 font-spray text-[20px] font-black leading-none text-rua">{i + 1}</span>
              {t}
            </li>
          ))}
          <li className="flex items-start gap-3">
            <Wallet aria-hidden className="mt-0.5 h-4 w-6 shrink-0 text-ouro-27" />
            {L('Saque é feito pela Wallet após verificação da conta.', 'Withdrawals go through the Wallet after account verification.')}
          </li>
        </ol>
      </section>
    </div>
  );
}

/**
 * KPI do PRO na escada do DS: saldo é valor que existe (RESPEITO: fio de ouro);
 * o resto é concreto com número em spray.
 */
function KpiCard({
  label,
  value,
  footer,
  tone,
}: {
  label: string;
  value: string;
  footer: string;
  tone: 'cyan' | 'emerald' | 'yellow' | 'fuchsia';
}) {
  const respeito = tone === 'yellow';
  return (
    <div className={cn('flex min-w-0 flex-col p-3.5', respeito ? 'border-[3px] border-ouro-27 bg-asfalto-27' : 'bg-concreto')}>
      <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{label}</p>
      <p
        className={cn('mt-1.5 block min-w-0 truncate font-spray font-black leading-none', respeito ? 'text-ouro-27' : 'text-papel')}
        style={{ fontSize: 'clamp(26px, 7vw, 34px)' }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-mudo">{footer}</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Lock,
  ChevronRight,
  Wallet,
  Trophy,
  Activity,
  ShieldCheck,
  Search,
  Filter,
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
    <div className="mx-auto min-w-0 max-w-4xl space-y-5 pb-16">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/manager')}
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-black text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
            MANAGER · PRO
          </div>
          <h1 className="ole-headline-italic text-cyan-400 mt-1" style={{ fontSize: 'clamp(32px, 6vw, 48px)' }}>
            Vendas dos teus cards
          </h1>
        </div>
      </div>

      {/* ── Banner de verificação (só se não verificado) ──────── */}
      {!verified ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 border border-amber-500/35 bg-amber-500/[0.08] p-4"
        >
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-black uppercase tracking-wider text-amber-200">
              {vStatus === 'pending'
                ? 'Em análise pelo Admin'
                : vStatus === 'rejected'
                ? 'Verificação rejeitada — ajusta e reenvia'
                : 'Modo prévia — conta não verificada'}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-amber-100/80">
              {vStatus === 'pending'
                ? 'Aguarda a aprovação. Assim que liberada, o saldo real e o botão de saque ficam ativos.'
                : 'Podes ver os teus cards e como ficará o painel. O saldo real e o saque ficam ativos depois que a verificação for aprovada pelo Admin.'}
            </p>
            {vStatus !== 'pending' ? (
              <Link
                to="/config"
                className="mt-2 inline-flex items-center gap-1.5 border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-amber-100 hover:bg-amber-500/25"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {vStatus === 'rejected' ? 'Reenviar verificação' : 'Verificar conta'}
                <ChevronRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {/* ── KPIs principais ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Saldo"
          value={balanceDisplay}
          tone="cyan"
          footer={
            verified
              ? proSummary.balance_exp > 0 ? 'Pronto pra sacar' : 'Sem saldo ainda'
              : 'Aguarda verificação'
          }
        />
        <KpiCard
          label="Vendas"
          value={String(salesCount)}
          tone="emerald"
          footer="Cards vendidos no total"
        />
        <KpiCard
          label="Cards"
          value={String(totalCards)}
          tone="yellow"
          footer="Criados pelo manager"
        />
        <KpiCard
          label="À venda"
          value={String(listedCount)}
          tone="fuchsia"
          footer="Listados no mercado"
        />
      </div>

      {/* ── Ações rápidas ──────────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          to="/wallet"
          className={cn(
            'group flex items-center gap-3 border p-5 transition-all hover:scale-[1.01]',
            verified
              ? 'border-cyan-500/40 bg-black hover:border-cyan-500/60'
              : 'border-white/10 bg-black opacity-60 pointer-events-none',
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-cyan-500/20">
            <Download className="h-6 w-6 text-cyan-200" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-black uppercase tracking-wide text-white">
              Sacar para Wallet
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">
              {verified ? 'Converte saldo em BRO' : 'Disponível após verificação'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          to="/city/youth-prospects"
          className="group flex items-center gap-3 border border-neon-yellow/40 bg-black p-5 transition-all hover:scale-[1.01] hover:border-neon-yellow/60"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-neon-yellow/20">
            <TrendingUp className="h-6 w-6 text-neon-yellow" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-black uppercase tracking-wide text-white">
              Criar novo card
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">
              Mais cards na academia = mais vendas possíveis
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* ── Meus cards ─────────────────────────────────────────── */}
      <section className="border border-white/10 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-display text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
            <Trophy className="h-3.5 w-3.5 text-cyan-300" />
            Meus cards ({totalCards})
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40 opacity-60"
              title="Em breve"
            >
              <Search className="h-3 w-3" /> Buscar
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40 opacity-60"
              title="Em breve"
            >
              <Filter className="h-3 w-3" /> Filtrar
            </button>
          </div>
        </div>

        {totalCards === 0 ? (
          <div className="border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <p className="text-sm text-white/80">Ainda não criaste nenhum card e nada vinculado pelo Admin.</p>
            <Link
              to="/city/youth-prospects"
              className="mt-2 inline-flex text-xs font-bold text-cyan-300 hover:underline"
            >
              Criar meu primeiro card →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {linkedCards.map((c) => {
              const playerPct = Array.isArray(c.payment_split)
                ? c.payment_split.find((e) => e.kind === 'player')?.percent ?? 50
                : 50;
              return (
                <li
                  key={`${c.source}:${c.id}`}
                  className="flex items-center justify-between gap-3 border border-cyan-500/20 bg-cyan-500/[0.04] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-white">
                      {c.name}
                      <span className="ml-2 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">
                        {c.source}
                      </span>
                    </p>
                    <p className="text-[10px] text-white/45">
                      {c.pos || '—'}
                      {c.rarity_label ? ` · ${rarityLabelPt(c.rarity_label)}` : ''}
                      {c.listed_on_market ? ' · À venda' : ''}
                      {` · split ${playerPct}%`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
                      0 vendas
                    </span>
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  </div>
                </li>
              );
            })}
            {academyCards.map((p) => (
              <li
                key={`academy:${p.id}`}
                className="flex items-center justify-between gap-3 border border-white/10 bg-black/30 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-white">
                    {p.name}
                    <span className="ml-2 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">
                      academy
                    </span>
                  </p>
                  <p className="text-[10px] text-white/45">
                    {p.pos} · OVR {Math.round(overallFromAttributes(p.attrs))}
                    {p.listedOnMarket ? ' · À venda' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
                    0 vendas
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Histórico de vendas ────────────────────────────────── */}
      <section className="border border-white/10 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-display text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
            <Activity className="h-3.5 w-3.5 text-cyan-300" />
            Histórico de vendas ({proPayouts.length})
          </h3>
          {proSummary.last_sale_at ? (
            <span className="text-[10px] text-white/45">
              Última: {new Date(proSummary.last_sale_at).toLocaleString('pt-BR')}
            </span>
          ) : null}
        </div>
        {proPayouts.length === 0 ? (
          <div className="border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <p className="text-sm text-white/80">Sem vendas ainda.</p>
            <p className="mt-1 text-[11px] text-white/45">
              Quando alguém comprar um card teu, a venda aparece aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {proPayouts.map((p) => {
              const isFlash = flashPayoutId === p.id;
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center justify-between gap-3 border px-3 py-2 transition',
                    isFlash
                      ? 'border-neon-green/50 bg-neon-green/10 shadow-[0_0_12px_rgba(0,255,128,0.18)]'
                      : 'border-white/10 bg-black/30',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-white">
                      {p.player_name ?? p.player_id}
                    </p>
                    <p className="text-[10px] text-white/45">
                      {new Date(p.created_at).toLocaleString('pt-BR')} · {p.split_kind} · {p.percent}%
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold text-cyan-200">
                    +{formatExp(p.amount_exp)} EXP
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Como funciona ──────────────────────────────────────── */}
      <section className="border border-cyan-500/20 bg-cyan-950/20 p-4">
        <h3 className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
          Como o PRO funciona
        </h3>
        <ul className="mt-2 space-y-1.5 text-[12px] text-white/75">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            Crias um card na Academia (ou vinculas um card real).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            Anuncias no mercado com preço em EXP.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            Cada venda confirmada credita o teu saldo aqui em tempo real.
          </li>
          <li className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            Saque é feito pela Wallet após verificação da conta.
          </li>
        </ul>
      </section>
    </div>
  );
}

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
  const tones: Record<typeof tone, string> = {
    cyan: 'border-cyan-500/25 bg-black',
    emerald: 'border-emerald-500/25 bg-black',
    yellow: 'border-neon-yellow/25 bg-black',
    fuchsia: 'border-fuchsia-500/25 bg-black',
  };
  const valueClass: Record<typeof tone, string> = {
    cyan: 'text-cyan-200',
    emerald: 'text-emerald-300',
    yellow: 'text-neon-yellow',
    fuchsia: 'text-fuchsia-300',
  };
  return (
    <div className={cn('border p-3', tones[tone])}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className={cn('mt-1 ole-headline-italic tabular-nums', valueClass[tone])} style={{ fontSize: 'clamp(24px, 4vw, 32px)' }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-white/45">{footer}</p>
    </div>
  );
}

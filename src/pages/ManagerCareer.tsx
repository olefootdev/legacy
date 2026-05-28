/**
 * ManagerCareer — Painel completo da carreira do afiliado.
 *
 * Composição:
 *   1. Hero editorial com rank atual + progresso pro próximo nível
 *   2. Career Progress card (pontos vitalícios, próximo bônus, claim)
 *   3. Super-Bônus de Depósito (totais L1/L2/L3 por moeda + claim)
 *   4. HODL Vault (locks ativos + criar novo + rewards acumulados)
 *   5. Premium Cards pendentes
 *   6. Leaderboard global
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Trophy,
  TrendingUp,
  Lock,
  Sparkles,
  Crown,
  Gift,
  Award,
  ArrowRight,
  Coins,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Sprout,
  Zap,
  Flame,
  Gem,
  CheckCircle2,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  fetchMyCareerProgress,
  claimCareerBonus,
  getRankDef,
  getNextRankDef,
  RANK_CATALOG,
  type CareerProgress,
  type CareerRank,
} from '@/wallet/careerProgress';
import {
  fetchMyAffiliateCommissions,
  claimMyAffiliateCommissions,
  type AffiliateCommissionSummary,
} from '@/wallet/affiliateCommissions';
import {
  fetchMyHodlLocks,
  createHodlLock,
  fetchMyPremiumCards,
  projectHodlRewards,
  type HodlLock,
  type PremiumCardGrant,
} from '@/wallet/hodlLocks';
import { getTokenPrice, type TokenEconomyConfig } from '@/economy/tokenEconomyConfig';
import {
  fetchMyActivationStatus,
  purchaseActivationPack,
  ACTIVATION_AMOUNT_USD,
  type ActivationStatus,
} from '@/wallet/activationPack';
import type { RankIconName } from '@/wallet/careerProgress';

const RANK_ICON_MAP: Record<RankIconName, LucideIcon> = {
  Sprout, Zap, Flame, Gem, Trophy, Crown,
};

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number, frac = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

export function ManagerCareer() {
  const navigate = useNavigate();
  const [career, setCareer] = useState<CareerProgress | null>(null);
  const [affiliateSummaries, setAffiliateSummaries] = useState<AffiliateCommissionSummary[]>([]);
  const [locks, setLocks] = useState<HodlLock[]>([]);
  const [cards, setCards] = useState<PremiumCardGrant[]>([]);
  const [tokenConfig, setTokenConfig] = useState<TokenEconomyConfig | null>(null);
  const [activation, setActivation] = useState<ActivationStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [claimingCareer, setClaimingCareer] = useState(false);
  const [claimingAffiliate, setClaimingAffiliate] = useState(false);
  const [creatingLock, setCreatingLock] = useState(false);
  const [activating, setActivating] = useState(false);
  const [lockAmount, setLockAmount] = useState<string>('1000');
  const [toast, setToast] = useState<string | null>(null);

  const refresh = async () => {
    const [careerData, affData, locksData, cardsData, tokenData, activationData] = await Promise.all([
      fetchMyCareerProgress(),
      fetchMyAffiliateCommissions(),
      fetchMyHodlLocks(),
      fetchMyPremiumCards(true),
      getTokenPrice(),
      fetchMyActivationStatus(),
    ]);
    setCareer(careerData);
    setAffiliateSummaries(affData);
    setLocks(locksData);
    setCards(cardsData);
    setTokenConfig(tokenData);
    setActivation(activationData);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentRankDef = useMemo(() => getRankDef(career?.currentRank ?? 'rookie'), [career]);
  const nextRankDef = useMemo(() => getNextRankDef(career?.currentRank ?? 'rookie'), [career]);

  const broCommissionPending = useMemo(() => {
    return affiliateSummaries
      .filter((s) => s.currency === 'BRO')
      .reduce((sum, s) => sum + s.totalPendingCents, 0);
  }, [affiliateSummaries]);

  const expCommissionPending = useMemo(() => {
    return affiliateSummaries
      .filter((s) => s.currency === 'EXP')
      .reduce((sum, s) => sum + s.totalPendingCents, 0);
  }, [affiliateSummaries]);

  const commissionByLevel = useMemo(() => {
    const out: Record<1 | 2 | 3, { bro: number; exp: number }> = {
      1: { bro: 0, exp: 0 },
      2: { bro: 0, exp: 0 },
      3: { bro: 0, exp: 0 },
    };
    for (const s of affiliateSummaries) {
      const lvl = s.level as 1 | 2 | 3;
      const total = s.totalPendingCents + s.totalClaimedCents;
      if (s.currency === 'BRO') out[lvl].bro += total;
      if (s.currency === 'EXP') out[lvl].exp += total;
    }
    return out;
  }, [affiliateSummaries]);

  const activeLocks = useMemo(() => locks.filter((l) => l.status === 'active'), [locks]);
  const totalLocked = useMemo(
    () => activeLocks.reduce((sum, l) => sum + l.amountLocked, 0),
    [activeLocks],
  );
  const totalRewardsPaid = useMemo(
    () => locks.reduce((sum, l) => sum + l.totalRewardsPaid, 0),
    [locks],
  );

  const lockProjection = useMemo(() => {
    const amount = Number(lockAmount) || 0;
    if (amount <= 0) return null;
    return projectHodlRewards(amount, 0.0025, 90);
  }, [lockAmount]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleClaimCareer = async () => {
    if (claimingCareer || !career || career.pendingBonusCents <= 0) return;
    setClaimingCareer(true);
    try {
      const claimed = await claimCareerBonus();
      if (claimed > 0) {
        showToast(`${fmtUsd(claimed)} resgatados — aplicados ao próximo tick`);
        await refresh();
      }
    } finally {
      setClaimingCareer(false);
    }
  };

  const handleClaimAffiliate = async () => {
    if (claimingAffiliate || broCommissionPending <= 0) return;
    setClaimingAffiliate(true);
    try {
      const results = await claimMyAffiliateCommissions('BRO');
      const total = results.reduce((sum, r) => sum + r.totalCents, 0);
      if (total > 0) {
        showToast(`${fmtUsd(total)} de comissão de depósito resgatados`);
        await refresh();
      }
    } finally {
      setClaimingAffiliate(false);
    }
  };

  const handleActivate = async () => {
    if (activating) return;
    setActivating(true);
    try {
      const result = await purchaseActivationPack();
      if (result) {
        showToast(`Pack ativado — agora você recebe TODAS as comissões 5-5-5%`);
        await refresh();
      } else {
        showToast('Falha ao ativar — tente novamente');
      }
    } finally {
      setActivating(false);
    }
  };

  const handleCreateLock = async () => {
    const amount = Number(lockAmount);
    if (creatingLock || !amount || amount <= 0) return;
    setCreatingLock(true);
    try {
      const result = await createHodlLock(amount, 'OLEXP');
      if (result) {
        showToast(`${fmtNum(amount, 0)} OLEXP travado por 90 dias + 1 Premium Card`);
        setLockAmount('1000');
        await refresh();
      }
    } finally {
      setCreatingLock(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="text-sm text-gray-500 uppercase tracking-widest">A carregar carreira…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden pb-8 md:pb-12 px-3 sm:px-4 lg:px-6">
      {/* HERO EDITORIAL ──────────────────────────────────────────────── */}
      <section
        aria-label="Plano de Carreira"
        className="relative w-full max-w-full min-w-0 overflow-hidden bg-gradient-to-br from-amber-500 via-neon-yellow to-amber-300 -mx-3 sm:-mx-4 lg:-mx-6"
      >
        <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden" aria-hidden>
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.05]"
            style={{
              fontSize: 'clamp(120px, 22vw, 420px)',
              lineHeight: '0.85',
              letterSpacing: '-0.02em',
            }}
          >
            Carreira
          </motion.span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black/70 mb-4 sm:mb-6">
            <span>Plano OLEFOOT · Cash Only</span>
          </div>

          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Carreira
            </span>
            <span
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              {currentRankDef.label}
            </span>
          </h1>

          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Pontuação atual + progresso */}
          <div className="mt-8 mx-auto max-w-md">
            <div className="bg-black/15 border-2 border-black/20 px-4 py-4 rounded-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mb-2">
                Pontos vitalícios
              </p>
              <p className="font-display text-4xl sm:text-5xl font-black text-black tabular-nums leading-none">
                {career?.lifetimePoints.toLocaleString('pt-BR') ?? '0'}
              </p>

              {nextRankDef && (
                <>
                  <div className="mt-4 h-3 w-full bg-black/15 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, career?.progressPct ?? 0)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full bg-black rounded-full"
                    />
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-black/70">
                    {((career?.lifetimePoints ?? 0)).toLocaleString('pt-BR')} /{' '}
                    {nextRankDef.thresholdPoints.toLocaleString('pt-BR')} pts →{' '}
                    <strong>{nextRankDef.label}</strong> · {fmtUsd(nextRankDef.bonusCents)}
                  </p>
                </>
              )}
              {!nextRankDef && (
                <p className="mt-2 text-[10px] uppercase tracking-wider text-black/70 inline-flex items-center gap-1 justify-center">
                  <Crown className="w-3 h-3" /> Você atingiu o topo
                </p>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto">
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0" style={{ borderRadius: 'var(--radius-sm)' }}>
              <p className="text-neon-yellow tabular-nums leading-none truncate font-display font-black text-xl sm:text-3xl">
                {fmtUsd(career?.totalCommissionsCents ?? 0)}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Comissões
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0" style={{ borderRadius: 'var(--radius-sm)' }}>
              <p className="text-cyan-300 tabular-nums leading-none truncate font-display font-black text-xl sm:text-3xl">
                {activeLocks.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                HODL ativos
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0" style={{ borderRadius: 'var(--radius-sm)' }}>
              <p className="text-emerald-300 tabular-nums leading-none truncate font-display font-black text-xl sm:text-3xl">
                {cards.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Cards
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* GATE DE ATIVAÇÃO ────────────────────────────────────────────── */}
      {activation && !activation.isActivated && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-rose-500/20 via-amber-500/15 to-amber-500/5 border-2 border-amber-400/60 rounded-sm p-5 sm:p-6 shadow-[0_0_36px_rgba(251,191,36,0.15)]"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="shrink-0 bg-amber-400/20 p-2.5 rounded-sm">
              <ShieldCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-amber-300 mb-1">
                Ativação obrigatória
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                Ative sua conta por <span className="text-amber-300">${ACTIVATION_AMOUNT_USD}</span>
              </h2>
              <p className="text-xs sm:text-sm text-white/70 mt-2 leading-relaxed">
                Pra <strong className="text-white">receber comissões 5-5-5%</strong> dos depósitos da
                tua rede, criar <strong className="text-white">HODL locks</strong> e resgatar
                <strong className="text-white"> bônus de carreira</strong>, você precisa ativar a
                conta com um pack único de <strong className="text-amber-300">${ACTIVATION_AMOUNT_USD}</strong>.
              </p>
            </div>
          </div>

          {activation.totalLostCommissionsCents > 0 && (
            <div className="bg-rose-500/15 border border-rose-400/40 rounded-sm p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
              <p className="text-xs text-rose-200 leading-snug">
                Você já <strong>perdeu {fmtUsd(activation.totalLostCommissionsCents)}</strong> em
                comissões da tua rede por estar inativo. Ative agora pra parar de perder.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="w-full bg-amber-400 hover:bg-white text-black py-4 rounded-sm font-display text-sm font-black uppercase tracking-[0.18em] transition-colors disabled:opacity-50"
          >
            {activating ? 'Ativando…' : `Ativar conta por $${ACTIVATION_AMOUNT_USD}`}
          </button>

          <p className="text-[10px] text-white/40 mt-3 text-center uppercase tracking-wider">
            Pagamento único · ativação vitalícia · acesso completo
          </p>
        </motion.div>
      )}

      {activation?.isActivated && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-sm px-4 py-2.5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
          <p className="text-xs text-emerald-200">
            <strong>Conta ativada</strong>
            {activation.activatedAt && (
              <> · {new Date(activation.activatedAt).toLocaleDateString('pt-BR')}</>
            )}
            {' · '}recebendo comissões 5-5-5%
          </p>
        </div>
      )}

      {/* TOAST ───────────────────────────────────────────────────────── */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-emerald-500/10 border border-emerald-400/40 rounded-sm px-4 py-3 text-emerald-300 text-sm font-display uppercase tracking-wider text-center inline-flex items-center justify-center gap-2 w-full"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </motion.div>
      )}

      {/* CAREER PROGRESS — Bônus pendente ───────────────────────────── */}
      {career && career.pendingBonusCents > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-2 border-amber-400/40 rounded-sm p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-amber-300 uppercase tracking-[0.2em] font-display font-bold mb-1">
                <Gift className="inline w-3 h-3 mr-1" /> Bônus de carreira liberado
              </p>
              <p className="font-display text-2xl sm:text-3xl font-black text-amber-300 tabular-nums">
                {fmtUsd(career.pendingBonusCents)}
              </p>
              <p className="text-xs text-white/60 mt-1">
                Você atingiu rank <strong className="text-amber-300">{currentRankDef.label}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleClaimCareer}
              disabled={claimingCareer || !activation?.isActivated}
              title={!activation?.isActivated ? 'Requer ativação' : undefined}
              className="shrink-0 bg-amber-400 text-black px-5 py-3 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimingCareer ? 'Resgatando…' : !activation?.isActivated ? (
                <span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3" /> Ativar</span>
              ) : 'Resgatar'}
            </button>
          </div>
        </motion.div>
      )}

      {/* RANK LADDER ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="ole-eyebrow !text-amber-300 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>Escalada de ranks</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {RANK_CATALOG.map((rd) => {
            const isCurrent = rd.rank === career?.currentRank;
            const isUnlocked = (career?.lifetimePoints ?? 0) >= rd.thresholdPoints;
            const Icon = RANK_ICON_MAP[rd.iconName];
            return (
              <div
                key={rd.rank}
                className={cn(
                  'bg-panel border rounded-sm p-3 text-center transition-all',
                  isCurrent ? 'border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.2)]' : 'border-white/10',
                  !isUnlocked && 'opacity-50',
                )}
              >
                <div className={cn('flex items-center justify-center mb-2', isCurrent && 'animate-pulse')}>
                  <Icon className={cn('w-6 h-6', rd.color)} strokeWidth={2} />
                </div>
                <p className={cn('font-display text-xs font-black uppercase tracking-wider', rd.color)}>
                  {rd.label}
                </p>
                <p className="text-[10px] text-white/40 mt-1 tabular-nums">
                  {rd.thresholdPoints.toLocaleString('pt-BR')} pts
                </p>
                <p className="text-[10px] text-white/60 font-bold tabular-nums">
                  {rd.bonusCents > 0 ? fmtUsd(rd.bonusCents) : '—'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SUPER-BÔNUS DE DEPÓSITO ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="ole-eyebrow !text-cyan-300 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Super-Bônus de Depósito</span>
          </div>
          {broCommissionPending > 0 && (
            <button
              type="button"
              onClick={handleClaimAffiliate}
              disabled={claimingAffiliate || !activation?.isActivated}
              title={!activation?.isActivated ? 'Requer ativação' : undefined}
              className="bg-cyan-500 text-white px-3 py-1.5 rounded-sm font-display text-[10px] font-black uppercase tracking-[0.18em] hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimingAffiliate ? 'Resgatando…' : !activation?.isActivated ? (
                <span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3" /> Ativar</span>
              ) : `Resgatar ${fmtUsd(broCommissionPending)}`}
            </button>
          )}
        </div>

        <div className="bg-panel border border-cyan-500/20 rounded-sm p-4 sm:p-5">
          <p className="text-xs text-white/60 mb-4">
            5% de comissão sobre cada depósito da tua rede, em 3 níveis.
          </p>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {([1, 2, 3] as const).map((lvl) => {
              const data = commissionByLevel[lvl];
              return (
                <div key={lvl} className="bg-black/40 border border-white/5 rounded-sm p-3 text-center">
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 mb-2">
                    Nível {lvl}
                  </p>
                  <p className="font-display text-lg sm:text-xl font-black text-white tabular-nums">
                    {fmtUsd(data.bro)}
                  </p>
                  {data.exp > 0 && (
                    <p className="text-[10px] text-amber-300 mt-1 tabular-nums">
                      +{data.exp.toLocaleString('pt-BR')} EXP
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {broCommissionPending === 0 && expCommissionPending === 0 && (
            <p className="text-[11px] text-white/40 mt-4 text-center italic">
              Quando alguém da tua rede depositar, o bônus aparece aqui automaticamente.
            </p>
          )}
        </div>
      </section>

      {/* HODL VAULT ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="ole-eyebrow !text-emerald-300 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          <span>HODL Vault</span>
        </div>

        {/* Criar lock */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 rounded-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <p className="font-display text-xs font-black uppercase tracking-wider text-emerald-300">
              Travar OLEXP por 90 dias
            </p>
          </div>
          <p className="text-xs text-white/60 mb-4">
            <strong className="text-emerald-300">0,25% ao dia</strong> · <strong>7,5% ao mês</strong> ·{' '}
            <strong>+1 Premium Card instantâneo</strong> · sorteio diário
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                Quantidade OLEXP
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={lockAmount}
                onChange={(e) => setLockAmount(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-sm px-3 py-3 text-white font-display tabular-nums text-lg focus:border-emerald-400/60 focus:outline-none"
                placeholder="1000"
              />
              {lockProjection && (
                <p className="text-[10px] text-white/50 mt-1.5">
                  Recebe ≈{' '}
                  <strong className="text-emerald-300 tabular-nums">
                    {fmtNum(lockProjection.totalReward, 2)} OLEXP
                  </strong>{' '}
                  em 90 dias ({fmtNum(lockProjection.dailyReward, 4)} OLEXP/dia)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCreateLock}
              disabled={creatingLock || !Number(lockAmount) || !activation?.isActivated}
              title={!activation?.isActivated ? 'Requer ativação' : undefined}
              className="bg-emerald-400 text-black px-6 py-3 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {creatingLock ? 'Travando…' : !activation?.isActivated ? (
                <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Ativar conta</span>
              ) : 'Travar 90 dias'}
            </button>
          </div>
        </div>

        {/* Locks ativos */}
        {locks.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 px-1">
              <div className="bg-panel border border-white/10 rounded-sm p-3 text-center">
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Saldo travado</p>
                <p className="font-display text-xl font-black text-emerald-300 tabular-nums">
                  {fmtNum(totalLocked, 2)} OLEXP
                </p>
              </div>
              <div className="bg-panel border border-white/10 rounded-sm p-3 text-center">
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Rendimentos pagos</p>
                <p className="font-display text-xl font-black text-amber-300 tabular-nums">
                  +{fmtNum(totalRewardsPaid, 4)}
                </p>
              </div>
            </div>

            {locks.map((lock) => (
              <div
                key={lock.id}
                className={cn(
                  'bg-panel border rounded-sm p-4',
                  lock.status === 'active'
                    ? 'border-emerald-500/30'
                    : lock.status === 'matured'
                      ? 'border-amber-500/30'
                      : 'border-white/10 opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-black text-white tabular-nums">
                      {fmtNum(lock.amountLocked, 2)} {lock.currency}
                    </p>
                    <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(lock.startDate).toLocaleDateString('pt-BR')} →{' '}
                      {new Date(lock.endDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        'font-display text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-sm inline-block',
                        lock.status === 'active' && 'bg-emerald-500/20 text-emerald-300',
                        lock.status === 'matured' && 'bg-amber-500/20 text-amber-300',
                        lock.status === 'cancelled' && 'bg-white/10 text-white/50',
                      )}
                    >
                      {lock.status === 'active'
                        ? `${lock.daysRemaining}d restantes`
                        : lock.status === 'matured'
                          ? 'Vencido'
                          : 'Cancelado'}
                    </p>
                    <p className="font-display text-sm font-black text-amber-300 tabular-nums mt-2">
                      +{fmtNum(lock.totalRewardsPaid, 4)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
            <Lock className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum lock ativo ainda</p>
          </div>
        )}
      </section>

      {/* PREMIUM CARDS ───────────────────────────────────────────────── */}
      {cards.length > 0 && (
        <section className="space-y-3">
          <div className="ole-eyebrow !text-fuchsia-300 flex items-center gap-2">
            <Award className="w-3.5 h-3.5" />
            <span>Premium Cards pendentes</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map((card) => {
              const TierIcon = card.cardTier === 'legendary' ? Crown : card.cardTier === 'rare' ? Gem : Star;
              const tierColor =
                card.cardTier === 'legendary' ? 'text-amber-300' : card.cardTier === 'rare' ? 'text-fuchsia-300' : 'text-cyan-300';
              return (
                <div
                  key={card.id}
                  className={cn(
                    'bg-gradient-to-br rounded-sm p-4 border-2',
                    card.cardTier === 'legendary' && 'from-amber-500/20 via-amber-400/10 to-transparent border-amber-400/40',
                    card.cardTier === 'rare' && 'from-fuchsia-500/20 via-fuchsia-400/10 to-transparent border-fuchsia-400/40',
                    card.cardTier === 'premium' && 'from-cyan-500/20 via-cyan-400/10 to-transparent border-cyan-400/40',
                  )}
                >
                  <TierIcon className={cn('w-7 h-7 mb-2', tierColor)} strokeWidth={2} />
                  <p className="font-display text-xs font-black uppercase tracking-wider text-white">
                    {card.cardTier === 'legendary' ? 'Legendary' : card.cardTier === 'rare' ? 'Rare' : 'Premium'}
                  </p>
                  <p className="text-[10px] text-white/50 mt-1">
                    {card.source === 'hodl_lock' ? 'HODL Lock' : card.source === 'hodl_lottery' ? 'Sorteio diário' : card.source}
                  </p>
                  <p className="text-[10px] text-white/30 mt-1 tabular-nums">
                    {new Date(card.grantedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* INFO BOX ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-panel border border-white/10 border-l-4 border-l-amber-400 rounded-sm p-4 sm:p-5"
      >
        <p className="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-wider text-white mb-3">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Como funciona o Plano OLEFOOT
        </p>
        <ul className="space-y-2 text-xs text-white/60">
          <li className="flex items-start gap-2">
            <span className="text-amber-300 font-bold mt-0.5">•</span>
            <span>
              <strong className="text-white">Super-Bônus 5-5-5%:</strong> cada depósito da tua rede
              paga 5% a 3 níveis instantaneamente
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 font-bold mt-0.5">•</span>
            <span>
              <strong className="text-white">Carreira Cash Only:</strong> 1 USD em comissão = 1 ponto
              vitalício. Ranks pagam até $5.000 ao atingir Legend
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 font-bold mt-0.5">•</span>
            <span>
              <strong className="text-white">HODL:</strong> trava OLEXP por 90 dias, recebe 7,5%/mês
              + 1 Premium Card + entra no sorteio diário
            </span>
          </li>
          {tokenConfig && tokenConfig.pricingMode === 'fixed' && (
            <li className="flex items-start gap-2 pt-2 border-t border-white/5">
              <Coins className="text-amber-300 w-3 h-3 mt-0.5" />
              <span className="text-[10px] text-white/40">
                Preço OLEFOOT atual: <strong className="tabular-nums">${tokenConfig.currentTokenPrice.toFixed(6)}</strong>
                {' '}(modo {tokenConfig.pricingMode})
              </span>
            </li>
          )}
        </ul>
      </motion.div>

      {/* CTA pra Network ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/manager/network')}
        className="w-full bg-panel border border-cyan-500/30 hover:border-cyan-400/60 rounded-sm p-4 flex items-center justify-between gap-3 transition-colors group"
      >
        <div className="text-left min-w-0">
          <p className="font-display text-xs font-black uppercase tracking-wider text-white">
            Convidar para a tua rede
          </p>
          <p className="text-[10px] text-white/50 mt-0.5">
            Compartilha o teu código e começa a faturar comissão
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-cyan-300 group-hover:translate-x-1 transition-transform shrink-0" />
      </button>
    </div>
  );
}

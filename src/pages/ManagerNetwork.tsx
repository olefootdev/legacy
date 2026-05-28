/**
 * ManagerNetwork — Página de Network do Manager
 * Solicitações de amizade + Indicações cadastradas + Link de indicação
 * Design system: HERO amarelo editorial + cards padrão do jogo
 */
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Network,
  Users,
  UserPlus,
  Copy,
  CheckCircle,
  CheckCircle2,
  Link2,
  X,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Trophy,
  Medal,
  Ticket,
  Lock,
  Crown,
  Gift,
  Award,
  Coins,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Sprout,
  Zap,
  Flame,
  Gem,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode, normalizeReferralCode } from '@/wallet/referralCode';
import { fetchMyReferrals, claimMyReferralCommission, type ReferredProfile } from '@/supabase/referrals';
import { applyPendingCredits } from '@/wallet/applyPendingCredits';
import {
  fetchMyCareerProgress,
  claimCareerBonus,
  getRankDef,
  getNextRankDef,
  RANK_CATALOG,
  type CareerProgress,
  type RankIconName,
} from '@/wallet/careerProgress';
import {
  fetchMyAffiliateCommissions,
  claimMyAffiliateCommissions,
  fetchAffiliateCommissionEntries,
  groupCommissionsByReferred,
  type AffiliateCommissionSummary,
  type AffiliateCommissionEntry,
} from '@/wallet/affiliateCommissions';

// ─────────────────────────────────────────────────────────────────────────
// Modo Privacidade — toggle tipo banco (Itaú/Nubank): oculta nomes e
// valores. Persiste em localStorage. NÃO criptografa nada — só mascara
// visualmente pra quem está olhando a tela junto.
// ─────────────────────────────────────────────────────────────────────────
const PRIVACY_KEY = 'olefoot-network-privacy';

function readPrivacy(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) === '1';
  } catch {
    return false;
  }
}

function persistPrivacy(on: boolean) {
  try {
    localStorage.setItem(PRIVACY_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Máscara genérica — usado pra valores formatados ($0.00, 1.234 EXP, etc) */
function maskIfHidden<T extends string | number>(value: T, hide: boolean): string {
  if (!hide) return String(value);
  return '••••';
}

/** Máscara de nome — preserva primeira letra pra dar pista de qual é qual */
function maskName(name: string | null | undefined, hide: boolean): string {
  if (!hide) return name ?? '';
  if (!name) return '••••';
  const first = name.trim().charAt(0).toUpperCase();
  return `${first}••••••`;
}
import {
  fetchMyHodlLocks,
  createHodlLock,
  fetchMyPremiumCards,
  projectHodlRewards,
  fetchHodlRewardsForLock,
  fetchRecentLotteryDraws,
  type HodlLock,
  type PremiumCardGrant,
  type HodlRewardEntry,
  type LotteryDrawEntry,
} from '@/wallet/hodlLocks';
import { fetchMyOlexpBalance } from '@/wallet/olexpSync';
import {
  fetchCareerLeaderboard,
  type LeaderboardEntry,
} from '@/wallet/careerProgress';
import { getTokenPrice, type TokenEconomyConfig } from '@/economy/tokenEconomyConfig';
import {
  fetchMyActivationStatus,
  ACTIVATION_AMOUNT_USD,
  type ActivationStatus,
} from '@/wallet/activationPack';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';

const RANK_ICON_MAP: Record<RankIconName, LucideIcon> = {
  Sprout, Zap, Flame, Gem, Trophy, Crown,
};

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number, frac = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

export function ManagerNetwork() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const club = useGameStore((s) => s.club);
  const social = useGameStore((s) => s.social);
  const finance = useGameStore((s) => s.finance);

  const wallet = useMemo(
    () => normalizeWalletState(finance.wallet ?? undefined),
    [finance.wallet],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const myReferralCode = wallet.myReferralCode ?? '';
  const inviteLink = myReferralCode ? inviteLinkForCode(myReferralCode) : '';

  // Indicações cadastradas — fonte autoritativa é o Supabase (RPC get_my_referrals).
  // wallet.referralTree é zustand local e não reflete cadastros via link.
  const [serverReferrals, setServerReferrals] = useState<ReferredProfile[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchMyReferrals();
      if (cancelled) return;
      setServerReferrals(list);
      setLoadingReferrals(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referrals = useMemo(
    () =>
      serverReferrals.map((r) => ({
        id: r.id,
        displayName: r.displayName ?? 'Manager',
        clubName: r.clubName ?? null,
        clubShort: r.clubShort,
        level: 1 as number,
        joinedAt: r.createdAt,
        lifetime: r.expLifetimeEarned,
        pending: r.commissionPending,
        total: r.commissionTotal,
      })),
    [serverReferrals],
  );

  const totalCommissionPending = useMemo(
    () => referrals.reduce((sum, r) => sum + r.pending, 0),
    [referrals],
  );
  const totalCommissionAccumulated = useMemo(
    () => referrals.reduce((sum, r) => sum + r.total, 0),
    [referrals],
  );

  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<number | null>(null);

  // Breakdown agregado de comissões por indicado — alimenta colunas USDT dos cards
  const [commissionEntries, setCommissionEntries] = useState<AffiliateCommissionEntry[]>([]);
  const commissionsByReferred = useMemo(
    () => groupCommissionsByReferred(commissionEntries),
    [commissionEntries],
  );

  // Fase 5 — Telemetria
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lotteryDraws, setLotteryDraws] = useState<LotteryDrawEntry[]>([]);
  const [olexpBalance, setOlexpBalance] = useState<number>(0);
  const [expandedLockId, setExpandedLockId] = useState<string | null>(null);
  const [lockRewardsCache, setLockRewardsCache] = useState<Record<string, HodlRewardEntry[]>>({});

  const toggleLockExpand = async (lockId: string) => {
    if (expandedLockId === lockId) {
      setExpandedLockId(null);
      return;
    }
    setExpandedLockId(lockId);
    if (!lockRewardsCache[lockId]) {
      const rewards = await fetchHodlRewardsForLock(lockId);
      setLockRewardsCache((prev) => ({ ...prev, [lockId]: rewards }));
    }
  };

  // Modo Privacidade
  const [privacy, setPrivacy] = useState<boolean>(false);
  useEffect(() => {
    setPrivacy(readPrivacy());
  }, []);
  const togglePrivacy = () => {
    setPrivacy((prev) => {
      const next = !prev;
      persistPrivacy(next);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await fetchAffiliateCommissionEntries();
      if (cancelled) return;
      setCommissionEntries(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Career / HODL / Affiliate states ─────────────────────────────────
  const [career, setCareer] = useState<CareerProgress | null>(null);
  const [affiliateSummaries, setAffiliateSummaries] = useState<AffiliateCommissionSummary[]>([]);
  const [locks, setLocks] = useState<HodlLock[]>([]);
  const [cards, setCards] = useState<PremiumCardGrant[]>([]);
  const [tokenConfig, setTokenConfig] = useState<TokenEconomyConfig | null>(null);
  const [activation, setActivation] = useState<ActivationStatus | null>(null);
  const [claimingCareer, setClaimingCareer] = useState(false);
  const [claimingAffiliate, setClaimingAffiliate] = useState(false);
  const [creatingLock, setCreatingLock] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [lockAmount, setLockAmount] = useState<string>('1000');
  const [careerToast, setCareerToast] = useState<string | null>(null);

  const refreshCareer = async () => {
    // Aplica wallet_credits pendentes ANTES de buscar status — evita race
    // onde claim/grant cria credit mas balance ainda não refletiu na UI.
    await applyPendingCredits();

    const [
      careerData,
      affData,
      locksData,
      cardsData,
      tokenData,
      activationData,
      leaderboardData,
      lotteryData,
      olexpBal,
    ] = await Promise.all([
      fetchMyCareerProgress(),
      fetchMyAffiliateCommissions(),
      fetchMyHodlLocks(),
      fetchMyPremiumCards(true),
      getTokenPrice(),
      fetchMyActivationStatus(),
      fetchCareerLeaderboard(20),
      fetchRecentLotteryDraws(10),
      fetchMyOlexpBalance(),
    ]);
    setCareer(careerData);
    setAffiliateSummaries(affData);
    setLocks(locksData);
    setCards(cardsData);
    setTokenConfig(tokenData);
    setActivation(activationData);
    setLeaderboard(leaderboardData);
    setLotteryDraws(lotteryData);
    setOlexpBalance(olexpBal);
    // Invalida cache de rewards se locks mudaram
    setLockRewardsCache({});
  };

  useEffect(() => {
    void refreshCareer();
  }, []);

  const currentRankDef = useMemo(() => getRankDef(career?.currentRank ?? 'rookie'), [career]);
  const nextRankDef = useMemo(() => getNextRankDef(career?.currentRank ?? 'rookie'), [career]);

  const broCommissionPending = useMemo(
    () => affiliateSummaries.filter((s) => s.currency === 'BRO').reduce((sum, s) => sum + s.totalPendingCents, 0),
    [affiliateSummaries],
  );
  const expCommissionPending = useMemo(
    () => affiliateSummaries.filter((s) => s.currency === 'EXP').reduce((sum, s) => sum + s.totalPendingCents, 0),
    [affiliateSummaries],
  );
  const commissionByLevel = useMemo(() => {
    const out: Record<1 | 2 | 3, { bro: number; exp: number }> = {
      1: { bro: 0, exp: 0 }, 2: { bro: 0, exp: 0 }, 3: { bro: 0, exp: 0 },
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
  const totalLocked = useMemo(() => activeLocks.reduce((sum, l) => sum + l.amountLocked, 0), [activeLocks]);
  const totalRewardsPaid = useMemo(() => locks.reduce((sum, l) => sum + l.totalRewardsPaid, 0), [locks]);

  const lockProjection = useMemo(() => {
    const amount = Number(lockAmount) || 0;
    if (amount <= 0) return null;
    return projectHodlRewards(amount, 0.0025, 90);
  }, [lockAmount]);

  const showCareerToast = (msg: string) => {
    setCareerToast(msg);
    setTimeout(() => setCareerToast(null), 4000);
  };

  const handleActivate = () => {
    setPixOpen(true);
  };

  const handlePixSuccess = async () => {
    showCareerToast('Pagamento confirmado — sua conta foi ativada');
    setPixOpen(false);
    await refreshCareer();
  };

  const handleClaimCareer = async () => {
    if (claimingCareer || !career || career.pendingBonusCents <= 0) return;
    setClaimingCareer(true);
    try {
      const claimed = await claimCareerBonus();
      if (claimed > 0) {
        showCareerToast(`${fmtUsd(claimed)} resgatados — aplicados ao próximo tick`);
        await refreshCareer();
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
        showCareerToast(`${fmtUsd(total)} de comissão de depósito resgatados`);
        await refreshCareer();
      }
    } finally {
      setClaimingAffiliate(false);
    }
  };

  const handleCreateLock = async () => {
    const amount = Number(lockAmount);
    if (creatingLock || !amount || amount <= 0) return;
    setCreatingLock(true);
    try {
      const result = await createHodlLock(amount, 'OLEXP');
      if (result) {
        showCareerToast(`${fmtNum(amount, 0)} OLEXP travado por 90 dias + 1 Premium Card`);
        setLockAmount('1000');
        await refreshCareer();
      }
    } finally {
      setCreatingLock(false);
    }
  };

  const handleClaimAll = async () => {
    if (claiming || totalCommissionPending <= 0) return;
    setClaiming(true);
    try {
      const amount = await claimMyReferralCommission();
      if (amount > 0) {
        dispatch({ type: 'WALLET_RECEIVE_REFERRAL_COMMISSION_EXP', amount });
        setClaimSuccess(amount);
        // Refresh do servidor pra zerar os pendings na UI
        const fresh = await fetchMyReferrals();
        setServerReferrals(fresh);
      }
      setTimeout(() => setClaimSuccess(null), 4000);
    } finally {
      setClaiming(false);
    }
  };

  const blockedManagerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of social.friends) ids.add(f.managerId);
    for (const o of social.outgoing) ids.add(o.toManagerId);
    for (const i of social.incoming) ids.add(i.fromManagerId);
    return ids;
  }, [social]);

  const suggestions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const DISCOVERABLE_MANAGERS: any[] = [];
    return DISCOVERABLE_MANAGERS.filter((m) => {
      if (blockedManagerIds.has(m.id)) return false;
      if (!qq) return true;
      return (
        m.clubName.toLowerCase().includes(qq) ||
        m.city.toLowerCase().includes(qq) ||
        m.id.toLowerCase().includes(qq)
      );
    });
  }, [q, blockedManagerIds]);

  const sendInvite = (managerId: string, clubName: string) => {
    dispatch({ type: 'SEND_FRIEND_REQUEST', managerId, clubName });
    setAddOpen(false);
    setQ('');
  };

  function handleCopyCode() {
    if (!myReferralCode) return;
    navigator.clipboard.writeText(myReferralCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden pb-6 md:pb-8 px-3 sm:px-4 lg:px-6">
      {/* ── HERO EDITORIAL — amarelo com watermark cinematográfico ── */}
      <section
        aria-label="Network do Manager"
        className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6"
      >
        {/* Watermark gigante — preto sobre amarelo, opacity baixa */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
            style={{
              fontSize: 'clamp(120px, 22vw, 420px)',
              lineHeight: '0.85',
              letterSpacing: '-0.02em',
            }}
          >
            Network
          </motion.span>
        </div>

        {/* Composição editorial centrada vertical */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          {/* Eyebrow */}
          <div
            className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6 truncate"
          >
            <span className="text-black">{club.name} · {club.city}</span>
          </div>

          {/* Headline duo: NETWORK + Conexões */}
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Network
            </span>
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              Conexões
            </motion.span>
          </h1>

          {/* Régua decorativa */}
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Quote italic — CENTERPIECE editorial */}
          <motion.blockquote
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
            style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
          >
            "construir rede é construir legado — cada conexão multiplica oportunidades."
          </motion.blockquote>

          {/* Link de indicação — destaque no hero */}
          <div className="mt-8 sm:mt-10 mx-auto max-w-lg">
            {inviteLink && (
              <div className="bg-black/10 border-2 border-black/20 px-4 py-4 rounded-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mb-2">
                  Teu link de indicação
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-black/20 border border-black/30 rounded-sm px-3 py-2.5">
                    <p className="font-mono text-base font-bold text-black tracking-wider truncate">
                      {myReferralCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="shrink-0 bg-black px-3 py-2.5 rounded-sm hover:bg-black/90 transition-colors"
                    aria-label="Copiar código"
                  >
                    {copiedCode ? (
                      <CheckCircle className="w-5 h-5 text-neon-yellow" />
                    ) : (
                      <Copy className="w-5 h-5 text-neon-yellow" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10">
                  <p className="text-[10px] text-black/60 font-mono truncate">{inviteLink}</p>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-black/80 hover:text-black transition-colors flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    {copiedLink ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Privacidade — modo banco (Itaú/Nubank) */}
          <div className="mt-6 sm:mt-8 flex items-center justify-center">
            <button
              type="button"
              onClick={togglePrivacy}
              aria-label={privacy ? 'Mostrar valores e nomes' : 'Ocultar valores e nomes'}
              aria-pressed={privacy}
              className="inline-flex items-center gap-2 bg-black/30 hover:bg-black/50 border border-black/30 hover:border-black/50 px-3 py-2 rounded-sm transition-colors"
            >
              {privacy ? (
                <EyeOff className="w-4 h-4 text-black" strokeWidth={2.5} />
              ) : (
                <Eye className="w-4 h-4 text-black" strokeWidth={2.5} />
              )}
              <span className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-black">
                {privacy ? 'Mostrar valores' : 'Ocultar valores'}
              </span>
            </button>
          </div>

          {/* Stats strip — 3 métricas principais */}
          <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto px-2">
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {privacy ? '••' : social.friends.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Amigos
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="text-rose-400 tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {privacy ? '••' : social.incoming.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Pedidos
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="text-cyan-400 tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {privacy ? '••' : (loadingReferrals ? '…' : referrals.length)}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Indicações
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── GATE DE ATIVAÇÃO (logo após o hero) ───────────────────── */}
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
            className="w-full bg-amber-400 hover:bg-white text-black py-4 rounded-sm font-display text-sm font-black uppercase tracking-[0.18em] transition-colors"
          >
            Ativar conta por ${ACTIVATION_AMOUNT_USD} (PIX)
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

      {/* FOMO histórico — visível mesmo pra users já ativos (motivador retrospectivo) */}
      {activation?.isActivated && activation.totalLostCommissionsCents > 0 && (
        <div className="bg-rose-500/10 border border-rose-400/30 rounded-sm px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          <p className="text-xs text-rose-200 leading-snug">
            Antes da ativação, você deixou de receber{' '}
            <strong>{privacy ? '••••' : fmtUsd(activation.totalLostCommissionsCents)}</strong>{' '}
            em comissões — agora todas estão sendo capturadas.
          </p>
        </div>
      )}

      {/* ── SEÇÕES PRINCIPAIS ────────────────────────────────────── */}
      <section className="space-y-4">
        {/* Solicitações pendentes */}
        {social.incoming.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="ole-eyebrow !text-rose-400">
                <span>Solicitações</span>
              </div>
            </div>
            {social.incoming.map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.05 }}
                className="group bg-panel border border-white/10 hover:border-rose-500/40 rounded-sm p-5 sm:p-6 transition-all hover:shadow-[0_0_24px_rgba(244,63,94,0.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-rose-500/15 border-2 border-rose-500/40 rounded-sm transition-transform group-hover:scale-110">
                      <UserPlus className="h-7 w-7 text-rose-400" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-black uppercase tracking-wider text-white mb-1">
                        {maskName(req.fromClubName, privacy)}
                      </h3>
                      <p className="text-xs text-gray-400">
                        Quer entrar na tua rede
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ACCEPT_FRIEND_REQUEST', requestId: req.id })}
                      className="bg-neon-green px-4 py-2 rounded-sm font-display text-[10px] font-black uppercase tracking-wider text-black hover:bg-white transition-all hover:scale-[1.02]"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'DECLINE_FRIEND_REQUEST', requestId: req.id })}
                      className="border border-white/20 px-4 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Amigos */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="ole-eyebrow !text-neon-yellow">
                <span>Amigos</span>
              </div>
              <Users className="h-3.5 w-3.5 text-neon-yellow/70" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 bg-neon-yellow px-3 py-1.5 rounded-sm font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-white transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          {social.friends.length === 0 ? (
            <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">Nenhum amigo ainda</p>
              <p className="text-xs text-gray-600">
                Clica em <strong className="text-white">Adicionar</strong> para começar a construir a tua rede.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {social.friends.map((f, idx) => (
                <motion.div
                  key={f.managerId}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + idx * 0.03 }}
                  className="flex items-center justify-between gap-2 bg-panel border border-white/10 rounded-sm p-4 hover:border-neon-yellow/30 transition-colors"
                >
                  <span className="font-display text-sm font-bold text-white truncate">
                    {maskName(f.clubName, privacy)}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_SOCIAL_FRIEND', managerId: f.managerId })}
                    className="shrink-0 text-[10px] font-bold uppercase text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Remover
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Convites enviados */}
        {social.outgoing.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div className="ole-eyebrow !text-white/40">
              <span>Convites enviados</span>
            </div>
            <div className="space-y-2">
              {social.outgoing.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 bg-panel border border-white/10 rounded-sm p-3"
                >
                  <span className="font-display text-sm font-bold text-gray-400 truncate">
                    {o.toClubName}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CANCEL_OUTGOING_FRIEND_REQUEST', requestId: o.id })}
                    className="shrink-0 text-[10px] font-bold uppercase text-gray-500 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Indicações cadastradas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="ole-eyebrow !text-cyan-400">
                <span>Indicações</span>
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400/70" aria-hidden />
            </div>
            {referrals.length > 0 && (
              <span className="bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-sm font-display text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                {referrals.length}
              </span>
            )}
          </div>

          {/* Comissão pendente — destaque com botão Resgatar */}
          {!loadingReferrals && referrals.length > 0 && (
            <div className="bg-gradient-to-r from-neon-yellow/10 to-neon-yellow/5 border border-neon-yellow/30 rounded-sm p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-neon-yellow/70 uppercase tracking-[0.2em] font-display font-bold">
                    Comissão pendente
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    5% sobre todo EXP ganho pelos teus indicados
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-xl font-black text-neon-yellow tabular-nums tracking-tight leading-none">
                    {privacy ? '••••' : `+${totalCommissionPending.toLocaleString('pt-BR')}`}
                    <span className="text-[10px] ml-1 text-neon-yellow/70">EXP</span>
                  </p>
                  {totalCommissionAccumulated > totalCommissionPending && (
                    <p className="text-[9px] text-white/40 mt-1">
                      Total histórico: {totalCommissionAccumulated.toLocaleString('pt-BR')} EXP
                    </p>
                  )}
                </div>
              </div>
              {totalCommissionPending > 0 && (
                <motion.button
                  type="button"
                  onClick={handleClaimAll}
                  disabled={claiming}
                  whileTap={{ scale: 0.97 }}
                  className="mt-3 w-full bg-neon-yellow text-black py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming ? 'Resgatando…' : 'Resgatar tudo'}
                </motion.button>
              )}
              {claimSuccess !== null && claimSuccess > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-[10px] text-emerald-300 font-display uppercase tracking-wider text-center"
                >
                  ✓ +{claimSuccess.toLocaleString('pt-BR')} EXP creditados no saldo
                </motion.p>
              )}
            </div>
          )}

          {loadingReferrals ? (
            <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">A carregar a tua rede…</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
              <Sparkles className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">Nenhuma indicação ainda</p>
              <p className="text-xs text-gray-600 mb-4">
                Partilha o teu link de indicação para começar a construir a tua rede e ganhar comissões.
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 bg-cyan-500 px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-cyan-400 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar link de indicação
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map((ref, idx) => {
                const usdBreakdown = commissionsByReferred.get(ref.id);
                const usdTotalCents = usdBreakdown?.usdCents ?? 0;
                const usdPendingCents = usdBreakdown?.usdPending ?? 0;
                return (
                  <motion.div
                    key={ref.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + idx * 0.05 }}
                    className="bg-panel border border-cyan-500/10 rounded-sm p-4 hover:border-cyan-500/30 transition-colors"
                  >
                    {/* Header: nome + clube + L badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-bold text-white truncate">
                          {maskName(ref.displayName, privacy)}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                          {ref.clubShort && (
                            <>
                              <span className="font-mono text-cyan-300/80">
                                {privacy ? '••••' : ref.clubShort}
                              </span>
                              <span className="text-white/30">·</span>
                            </>
                          )}
                          {ref.clubName && (
                            <>
                              <span className="truncate">{maskName(ref.clubName, privacy)}</span>
                              <span className="text-white/30">·</span>
                            </>
                          )}
                          <span className="whitespace-nowrap">
                            {new Date(ref.joinedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-1 rounded-sm font-display text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300">
                        L{ref.level}
                      </span>
                    </div>

                    {/* Stats: 3 colunas — EXP do indicado / EXP comissão / USDT comissão */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-500 uppercase tracking-[0.18em] mb-1">
                          Já ganhou
                        </p>
                        <p className="font-display text-base font-bold text-white tabular-nums">
                          {maskIfHidden(ref.lifetime.toLocaleString('pt-BR'), privacy)}
                        </p>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">EXP</p>
                      </div>
                      <div className="text-center border-l border-white/5">
                        <p className="text-[9px] text-neon-yellow/70 uppercase tracking-[0.18em] mb-1">
                          {ref.pending > 0 ? 'A resgatar' : 'Recebido'}
                        </p>
                        <p className="font-display text-base font-bold text-neon-yellow tabular-nums">
                          {privacy ? '••••' : `+${(ref.pending > 0 ? ref.pending : ref.total).toLocaleString('pt-BR')}`}
                        </p>
                        <p className="text-[9px] text-neon-yellow/70 uppercase tracking-wider">EXP 5%</p>
                      </div>
                      <div className="text-center border-l border-white/5">
                        <p className="text-[9px] text-emerald-300/80 uppercase tracking-[0.18em] mb-1">
                          {usdPendingCents > 0 ? 'A resgatar' : 'Recebido'}
                        </p>
                        <p className="font-display text-base font-bold text-emerald-300 tabular-nums">
                          {privacy ? '••••' : fmtUsd(usdPendingCents > 0 ? usdPendingCents : usdTotalCents)}
                        </p>
                        <p className="text-[9px] text-emerald-300/80 uppercase tracking-wider">USDT 5%</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════
            PLANO DE CARREIRA — Cash Only · Super-Bônus · HODL · Cards
            ═══════════════════════════════════════════════════════════════ */}

        {/* Eyebrow do bloco Carreira */}
        <div className="ole-eyebrow !text-amber-300 flex items-center gap-2 pt-2">
          <Award className="w-3.5 h-3.5" />
          <span>Plano OLEFOOT · Carreira</span>
        </div>

        {careerToast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-400/40 rounded-sm px-4 py-3 text-emerald-300 text-sm font-display uppercase tracking-wider text-center inline-flex items-center justify-center gap-2 w-full"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{careerToast}</span>
          </motion.div>
        )}

        {/* CAREER PROGRESS — Resumo + bônus pendente */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-400/30 rounded-sm p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-amber-300 uppercase tracking-[0.2em] font-display font-bold mb-1 inline-flex items-center gap-1.5">
                <Trophy className="w-3 h-3" />
                Rank atual
              </p>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = RANK_ICON_MAP[currentRankDef.iconName];
                  return <Icon className={cn('w-7 h-7', currentRankDef.color)} strokeWidth={2} />;
                })()}
                <p className="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                  {currentRankDef.label}
                </p>
              </div>
              <p className="text-xs text-white/60 mt-1">
                <strong className="text-white tabular-nums">{privacy ? '••••' : (career?.lifetimePoints ?? 0).toLocaleString('pt-BR')}</strong> pontos vitalícios
              </p>
            </div>
          </div>

          {nextRankDef && (
            <>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, career?.progressPct ?? 0)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-amber-400 rounded-full"
                />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-white/50">
                Próximo: <strong className="text-amber-300">{nextRankDef.label}</strong> em{' '}
                {privacy ? '••••' : (nextRankDef.thresholdPoints - (career?.lifetimePoints ?? 0)).toLocaleString('pt-BR')} pts ·{' '}
                bônus {privacy ? '••••' : fmtUsd(nextRankDef.bonusCents)}
              </p>
            </>
          )}
          {!nextRankDef && (
            <p className="text-[10px] uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
              <Crown className="w-3 h-3" /> Topo da carreira atingido
            </p>
          )}

          {career && career.pendingBonusCents > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] text-amber-300 uppercase tracking-wider font-display font-bold inline-flex items-center gap-1.5">
                  <Gift className="w-3 h-3" />
                  Bônus liberado
                </p>
                <p className="font-display text-xl font-black text-amber-300 tabular-nums mt-1">
                  {privacy ? '••••' : fmtUsd(career.pendingBonusCents)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClaimCareer}
                disabled={claimingCareer || !activation?.isActivated}
                title={!activation?.isActivated ? 'Requer ativação' : undefined}
                className="shrink-0 bg-amber-400 text-black px-4 py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                {claimingCareer ? 'Resgatando…' : !activation?.isActivated ? (
                  <span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3" /> Ativar</span>
                ) : 'Resgatar'}
              </button>
            </div>
          )}
        </div>

        {/* ESCALADA DE RANKS */}
        <div className="space-y-2">
          <div className="ole-eyebrow !text-amber-300 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Escalada de ranks</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
                  <p className={cn('font-display text-[10px] font-black uppercase tracking-wider', rd.color)}>
                    {rd.label}
                  </p>
                  <p className="text-[9px] text-white/40 mt-1 tabular-nums">
                    {rd.thresholdPoints.toLocaleString('pt-BR')} pts
                  </p>
                  <p className="text-[9px] text-white/60 font-bold tabular-nums">
                    {rd.bonusCents > 0 ? fmtUsd(rd.bonusCents) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* SUPER-BÔNUS DE DEPÓSITO */}
        <div className="space-y-3">
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
                      {privacy ? '••••' : fmtUsd(data.bro)}
                    </p>
                    {data.exp > 0 && (
                      <p className="text-[10px] text-amber-300 mt-1 tabular-nums">
                        {privacy ? '••••' : `+${data.exp.toLocaleString('pt-BR')} EXP`}
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
        </div>

        {/* HODL VAULT */}
        <div className="space-y-3">
          <div className="ole-eyebrow !text-emerald-300 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            <span>HODL Vault</span>
          </div>

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

            {/* Saldo OLEXP disponível pra travar */}
            <div className="mb-4 flex items-center justify-between bg-black/40 border border-white/5 rounded-sm px-3 py-2">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">
                Saldo OLEXP disponível
              </span>
              <span className="font-display text-sm font-black text-emerald-300 tabular-nums">
                {privacy ? '••••' : `${fmtNum(olexpBalance, 2)} OLEXP`}
              </span>
            </div>

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

          {locks.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-panel border border-white/10 rounded-sm p-3 text-center">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">Saldo travado</p>
                  <p className="font-display text-xl font-black text-emerald-300 tabular-nums">
                    {privacy ? '••••' : `${fmtNum(totalLocked, 2)} OLEXP`}
                  </p>
                </div>
                <div className="bg-panel border border-white/10 rounded-sm p-3 text-center">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">Rendimentos pagos</p>
                  <p className="font-display text-xl font-black text-amber-300 tabular-nums">
                    {privacy ? '••••' : `+${fmtNum(totalRewardsPaid, 4)}`}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {locks.map((lock) => {
                  const isExpanded = expandedLockId === lock.id;
                  const rewards = lockRewardsCache[lock.id] ?? [];
                  return (
                    <div
                      key={lock.id}
                      className={cn(
                        'bg-panel border rounded-sm overflow-hidden',
                        lock.status === 'active'
                          ? 'border-emerald-500/30'
                          : lock.status === 'matured'
                            ? 'border-amber-500/30'
                            : 'border-white/10 opacity-60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLockExpand(lock.id)}
                        className="w-full text-left p-4 hover:bg-white/5 transition-colors"
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-sm font-black text-white tabular-nums inline-flex items-center gap-2">
                              {privacy ? '••••' : `${fmtNum(lock.amountLocked, 2)} ${lock.currency}`}
                              <ChevronDown
                                className={cn(
                                  'w-3.5 h-3.5 text-white/40 transition-transform',
                                  isExpanded && 'rotate-180',
                                )}
                              />
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
                              {privacy ? '••••' : `+${fmtNum(lock.totalRewardsPaid, 4)}`}
                            </p>
                          </div>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-white/5 overflow-hidden"
                          >
                            <div className="p-3 bg-black/30">
                              <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] mb-2">
                                Histórico de rewards diários
                              </p>
                              {rewards.length === 0 ? (
                                <p className="text-[11px] text-white/40 italic text-center py-3">
                                  Sem rewards ainda — primeiro tick às 00:05 UTC
                                </p>
                              ) : (
                                <ul className="space-y-1 max-h-48 overflow-y-auto">
                                  {rewards.map((r) => (
                                    <li
                                      key={r.paidForDate}
                                      className="flex items-center justify-between px-2 py-1 hover:bg-white/5 rounded-sm"
                                    >
                                      <span className="text-[10px] text-white/60 font-mono tabular-nums">
                                        {new Date(r.paidForDate).toLocaleDateString('pt-BR')}
                                      </span>
                                      <span className="font-display text-[11px] font-bold text-amber-300 tabular-nums">
                                        {privacy ? '••••' : `+${fmtNum(r.amount, 4)} ${r.currency}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 5.3 — Lottery winners feed */}
          {lotteryDraws.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="ole-eyebrow !text-amber-300 flex items-center gap-2">
                <Ticket className="w-3.5 h-3.5" />
                <span>Sorteios recentes</span>
              </div>
              <ul className="bg-panel border border-amber-500/20 rounded-sm divide-y divide-white/5">
                {lotteryDraws.map((draw) => (
                  <li
                    key={draw.drawDate}
                    className="px-4 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-display font-bold text-white">
                        {maskName(draw.winnerDisplayName ?? 'Manager', privacy)}
                      </p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">
                        {new Date(draw.drawDate).toLocaleDateString('pt-BR')}
                        {draw.winnerClubShort && (
                          <> · <span className="font-mono text-amber-300/70">{privacy ? '••••' : draw.winnerClubShort}</span></>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 px-2 py-1 rounded-sm">
                        Premium Card
                      </p>
                      <p className="text-[9px] text-white/40 mt-1">
                        {privacy ? '••' : draw.eligibleCount} concorrentes
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* PREMIUM CARDS */}
        {cards.length > 0 && (
          <div className="space-y-3">
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
          </div>
        )}

        {/* 5.1 — Career Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="space-y-3">
            <div className="ole-eyebrow !text-amber-300 flex items-center gap-2">
              <Medal className="w-3.5 h-3.5" />
              <span>Top da Carreira</span>
            </div>
            <ul className="bg-panel border border-amber-500/20 rounded-sm divide-y divide-white/5">
              {leaderboard.slice(0, 20).map((entry) => {
                const rankDef = RANK_CATALOG.find((r) => r.rank === entry.currentRank);
                const RankIcon = rankDef ? RANK_ICON_MAP[rankDef.iconName] : Medal;
                return (
                  <li
                    key={`${entry.rankPosition}-${entry.displayName}`}
                    className="px-4 py-2.5 flex items-center gap-3"
                  >
                    <span className="font-display text-xs font-black text-white/40 tabular-nums w-6 text-right">
                      #{entry.rankPosition}
                    </span>
                    <RankIcon className={cn('w-4 h-4 shrink-0', rankDef?.color ?? 'text-white/40')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-display font-bold text-white truncate">
                        {maskName(entry.displayName, privacy)}
                      </p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">
                        {entry.clubShort && (
                          <span className="font-mono text-amber-300/70">
                            {privacy ? '••••' : entry.clubShort}
                          </span>
                        )}
                        {rankDef && (
                          <> · <span className={cn(rankDef.color, 'font-bold')}>{rankDef.label}</span></>
                        )}
                      </p>
                    </div>
                    <p className="font-display text-xs font-black text-amber-300 tabular-nums shrink-0">
                      {privacy ? '••••' : entry.lifetimePoints.toLocaleString('pt-BR')}
                      <span className="text-[9px] text-amber-300/60 ml-1">pts</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Info sobre comissões */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-panel border border-white/10 border-l-4 border-l-cyan-400 rounded-sm p-4 sm:p-5"
        >
          <p className="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-wider text-white mb-3">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Como funcionam as comissões?
          </p>
          <ul className="space-y-2 text-xs text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span><strong className="text-white">5% em BRO</strong> sobre compras elegíveis (OLE Game / NFT) até 3 níveis</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span><strong className="text-white">5% sobre cada depósito</strong> da tua rede (3 níveis) — ver Carreira</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span><strong className="text-white">1% da base GAT em EXP</strong> por dia, por nível (automático)</span>
            </li>
          </ul>
        </motion.div>
      </section>

      {/* ── PIX CHECKOUT MODAL ── */}
      <PixCheckoutModal
        open={pixOpen}
        productKind="activation_pack"
        amountCents={12500}
        title="Ativação Olefoot"
        description="Pack vitalício — Plano de Carreira completo"
        defaultName={club?.name ?? ''}
        onClose={() => setPixOpen(false)}
        onSuccess={handlePixSuccess}
      />

      {/* ── MODAL ADICIONAR AMIGO ── */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto flex max-h-[min(88dvh,calc(100dvh-5rem))] w-full max-w-md flex-col overflow-hidden rounded-sm border border-neon-yellow/40 bg-panel p-5 sm:max-h-[min(90dvh,640px)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">
                    Adicionar amigo
                  </h3>
                  <p className="mt-1 text-[11px] text-gray-500">Busca um clube e envia um convite.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-sm p-2 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome do clube ou cidade..."
                className="mb-3 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 focus:outline-none"
              />
              <ul className="max-h-[min(40dvh,14rem)] flex-1 divide-y divide-white/10 overflow-y-auto rounded-sm border border-white/10">
                {suggestions.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum resultado ou todos já na rede.
                  </li>
                ) : (
                  suggestions.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold text-white">{m.clubName}</p>
                        <p className="text-[10px] text-gray-500">{m.city}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => sendInvite(m.id, m.clubName)}
                        className="shrink-0 bg-neon-yellow px-2.5 py-1 rounded-sm font-display text-[10px] font-bold uppercase text-black hover:bg-white transition-colors"
                      >
                        Convidar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

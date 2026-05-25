import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Trophy,
  Lock,
  UserPlus,
  TrendingUp,
  Network,
  ChevronRight,
  Flag,
  Target,
  ShieldCheck,
  CircleDot,
  Zap,
  Medal,
  Globe2,
  Gem,
  Crown,
  X,
  CheckCircle,
  Sparkles,
  Users,
  Copy,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, formatBroDisplay, formatCompactNumber } from '@/systems/economy';
import { useProgressionStore } from '@/progression/progressionStore';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { COMPETITION_TROPHY_CATALOG } from '@/trophies/competitionCatalog';
import { MEMORABLE_TROPHY_SLOTS } from '@/trophies/memorableCatalog';
import { CAREER_TIERS, computeCareerTier, nextCareerTier, tierProgress01 } from '@/systems/careerTiers';
import { TrophyCard } from '@/components/cards/TrophyCard';
import { CareerTierBadge } from '@/components/CareerTierBadge';
import { SmartShortcut } from '@/components/cards/SmartShortcut';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';

const MISSION_TROPHY_KINDS = new Set(['onboarding', 'achievement', 'special']);

/** Ícones esportivos (chapados) pra cada tier da carreira. */
const TIER_ICONS: Record<number, LucideIcon> = {
  1: CircleDot,   // Fraldinha — ponto inicial
  2: Zap,         // Juvenil — energia
  3: Target,      // Amador — foco
  4: Flag,        // Profissional — bandeira
  5: Medal,       // Campeão — medalha
  6: Globe2,      // Internacional — globo
  7: Gem,         // Raro — gema
  8: Crown,       // Lenda — coroa
};

type DrawerKind = 'career' | 'network' | null;

export function Manager() {
  const club = useGameStore((s) => s.club);
  const finance = useGameStore((s) => s.finance);
  const form = useGameStore((s) => s.form);
  const results = useGameStore((s) => s.results);
  const players = useGameStore((s) => s.players);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const memorableTrophyUnlockedIds = useGameStore((s) => s.memorableTrophyUnlockedIds);
  const userSettings = useGameStore((s) => s.userSettings);
  const social = useGameStore((s) => s.social);

  const ensureResets = useProgressionStore((s) => s.ensureResets);
  const missionRuntime = useProgressionStore((s) => s.missions);

  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const navigate = useNavigate();

  const wallet = useMemo(
    () => normalizeWalletState(finance.wallet ?? undefined),
    [finance.wallet],
  );
  const myReferralCode = wallet.myReferralCode ?? '';
  const inviteLink = myReferralCode ? inviteLinkForCode(myReferralCode) : '';

  useEffect(() => {
    ensureResets();
  }, [ensureResets]);

  const expLifetime = finance.expLifetimeEarned ?? 0;
  const currentTier = useMemo(() => computeCareerTier(expLifetime), [expLifetime]);
  const nextTier = useMemo(() => nextCareerTier(currentTier.id), [currentTier.id]);
  const tierFrac = useMemo(() => tierProgress01(expLifetime), [expLifetime]);

  const managerName = useMemo(() => {
    const mp = userSettings.managerProfile;
    if (!mp) return 'Manager';
    const n = `${mp.firstName ?? ''} ${mp.lastName ?? ''}`.trim();
    return n || 'Manager';
  }, [userSettings.managerProfile]);

  const avatarSrc = userSettings.trainerAvatarDataUrl;
  const favoriteTeam = userSettings.favoriteRealTeam;

  const missionsReady = useMemo(() => {
    let count = 0;
    let expTotal = 0;
    for (const def of MISSION_CATALOG) {
      const st = missionRuntime[def.id];
      if (!st || st.claimed) continue;
      if (st.progress >= def.targetCount) {
        count += 1;
        expTotal += def.rewardExp;
      }
    }
    return { count, expTotal };
  }, [missionRuntime]);

  const competitionTrophies = useMemo(() => {
    const ctx = { leagueSeason, results, form };
    return COMPETITION_TROPHY_CATALOG.map((t) => ({ ...t, earned: t.unlocked(ctx) }));
  }, [leagueSeason, results, form]);

  const missionTrophies = useMemo(() => {
    return MISSION_CATALOG.filter((m) => m.trophy && MISSION_TROPHY_KINDS.has(m.kind)).map((def) => ({
      def,
      trophy: def.trophy!,
      earned: Boolean(missionRuntime[def.id]?.claimed),
    }));
  }, [missionRuntime]);

  const squadSize = Object.keys(players).length;
  const broDisplay = formatBroDisplay(finance.broCents);

  function handleCopyInviteLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }

  /** Smart shortcuts (sugestão C): 2-3 atalhos contextuais. */
  const shortcuts = useMemo(() => {
    const out: Array<{
      key: string;
      icon: typeof Target;
      label: string;
      sub: string;
      to?: string;
      onClick?: () => void;
      tone: 'yellow' | 'fuchsia' | 'cyan';
    }> = [];
    if (missionsReady.count > 0) {
      out.push({
        key: 'missions',
        icon: Target,
        label: `Resgatar ${missionsReady.count} missões${missionsReady.count > 1 ? ' ' : ''}`,
        sub: `+${formatExp(missionsReady.expTotal)} EXP prontos`,
        to: '/missions',
        tone: 'yellow',
      });
    }
    if (social.incoming.length > 0) {
      out.push({
        key: 'requests',
        icon: UserPlus,
        label: `${social.incoming.length} solicitaç${social.incoming.length > 1 ? 'ões' : 'ão'}`,
        sub: 'Aceitar ou recusar',
        onClick: () => setDrawer('network'),
        tone: 'fuchsia',
      });
    }
    if (nextTier && tierFrac >= 0.85) {
      const missing = Math.max(0, nextTier.minExp - expLifetime);
      out.push({
        key: 'nextTier',
        icon: TrendingUp,
        label: `Perto de ${nextTier.name}`,
        sub: `Faltam ${formatExp(missing)} EXP`,
        onClick: () => setDrawer('career'),
        tone: 'cyan',
      });
    }
    return out;
  }, [missionsReady, social.incoming.length, nextTier, tierFrac, expLifetime]);

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden pb-6 md:pb-8 px-3 sm:px-4 lg:px-6">
      {/* ── HERO EDITORIAL — amarelo com watermark cinematográfico ── */}
      <section
        aria-label="Perfil do Manager"
        className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6"
      >
        {/* Watermark gigante do tier — preto sobre amarelo, opacity baixa */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={currentTier.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4 }}
              className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
              style={{
                fontSize: 'clamp(120px, 22vw, 420px)',
                lineHeight: '0.85',
                letterSpacing: '-0.02em',
              }}
            >
              {currentTier.name}
            </motion.span>
          </AnimatePresence>
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

          {/* Headline duo: MANAGER + tier dinâmico */}
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Manager
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={currentTier.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="block italic text-black"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                  marginTop: '0.04em',
                  letterSpacing: '-0.01em',
                }}
              >
                {currentTier.name}
              </motion.span>
            </AnimatePresence>
          </h1>

          {/* Régua decorativa */}
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Avatar + Favorite Team */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="group/avatar relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28 transition-all hover:border-black/80 hover:shadow-[0_0_24px_rgba(0,0,0,0.4)]"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover transition-transform group-hover/avatar:scale-105" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-10 w-10 text-neon-yellow/80" aria-hidden />
                </div>
              )}
              <span className="absolute bottom-1 right-1 bg-black px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-neon-yellow"
                    style={{ borderRadius: 'var(--radius-sm)' }}>
                {currentTier.name}
              </span>
            </div>

            {favoriteTeam ? (
              <div className="inline-flex items-center gap-2 border border-black/20 bg-black/10 px-3 py-1.5"
                   style={{ borderRadius: 'var(--radius-sm)' }}>
                {favoriteTeam.logo ? (
                  <img src={favoriteTeam.logo} alt="" className="h-4 w-4 rounded-full object-contain" />
                ) : (
                  <Flag className="h-3.5 w-3.5 text-black/60" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/70">
                  Coração: <span className="text-black">{favoriteTeam.name}</span>
                </span>
              </div>
            ) : null}
          </div>

          {/* Quote italic — CENTERPIECE editorial */}
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={`tier-${currentTier.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
              style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
            >
              {currentTier.id <= 2 && '"começando a jornada — cada partida é aprendizado."'}
              {currentTier.id === 3 && '"construindo legado — o caminho é longo."'}
              {currentTier.id === 4 && '"profissional de verdade — decisões importam."'}
              {currentTier.id >= 5 && currentTier.id <= 6 && '"elite do futebol — poucos chegam aqui."'}
              {currentTier.id >= 7 && '"lenda viva — história escrita com títulos."'}
            </motion.blockquote>
          </AnimatePresence>

          {/* Link de indicação com botão de copiar */}
          <div className="mt-3 mx-auto max-w-md">
            {inviteLink ? (
              <div className="inline-flex items-center gap-2 bg-black/10 border border-black/20 px-3 py-2 rounded-sm">
                <span
                  className="font-mono text-black/70 truncate max-w-[200px] sm:max-w-xs"
                  style={{
                    fontSize: 'clamp(0.75rem, 1vw, 0.85rem)',
                  }}
                >
                  {inviteLink}
                </span>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="shrink-0 p-1.5 bg-black/80 hover:bg-black rounded-sm transition-colors"
                  aria-label="Copiar link de indicação"
                >
                  {copiedInvite ? (
                    <CheckCircle className="w-4 h-4 text-neon-yellow" />
                  ) : (
                    <Copy className="w-4 h-4 text-neon-yellow" />
                  )}
                </button>
              </div>
            ) : (
              <p
                className="text-black/60"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
                  lineHeight: 1.55,
                }}
              >
                {formatExp(expLifetime)} EXP acumulado · {squadSize} jogadores · {social.friends.length} amigos
              </p>
            )}
          </div>

          {/* Stats strip — 3 métricas principais */}
          <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto px-2">
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-serif-hero text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {formatCompactNumber(finance.ole)}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                EXP
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-serif-hero text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {broDisplay.primary}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                BRO
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-serif-hero text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {squadSize}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Elenco
              </p>
            </div>
          </div>

          {/* CTAs — centrados, primário preto sobre amarelo */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 px-4">
            <button
              type="button"
              onClick={() => setDrawer('career')}
              className="inline-flex items-center justify-center gap-2 bg-black px-5 sm:px-7 py-3 text-neon-yellow font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[11px] sm:text-[12px] hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <TrendingUp className="w-4 h-4" />
              Ver carreira
            </button>
            <button
              type="button"
              onClick={() => navigate('/manager/network')}
              className="inline-flex items-center justify-center gap-2 border border-black/70 bg-transparent px-5 sm:px-7 py-3 text-black font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[11px] sm:text-[12px] hover:bg-black/10 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Network className="w-4 h-4" />
              Network
              {social.incoming.length > 0 ? (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 font-display text-[10px] font-black text-white">
                  {social.incoming.length}
                </span>
              ) : null}
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── SEÇÕES PRINCIPAIS ────────────────────────────────────── */}
      <section className="space-y-4">
        {/* Carreira — Sprint B-2 Legacy Tech */}
        <motion.button
          type="button"
          onClick={() => setDrawer('career')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="group relative isolate w-full overflow-hidden border border-white/[0.05] text-left transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />
          <div className="relative flex flex-col gap-3 p-6 pl-7">
            <span
              className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              Progressão · Tier
            </span>
            <h3 className="font-display text-[24px] font-black uppercase leading-[0.95] tracking-tight text-white transition-colors group-hover:text-neon-yellow">
              Carreira
            </h3>
            <p className="text-[13px] leading-relaxed text-white/55">
              <span className="font-bold text-white/90">{currentTier.name}</span> · {formatExp(expLifetime)} EXP acumulado
              {nextTier ? (
                <> · próximo <span className="text-neon-yellow">{nextTier.name}</span></>
              ) : null}
            </p>
            <span
              className="mt-2 inline-flex w-fit items-center bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all group-hover:bg-white"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Ver carreira
            </span>
          </div>
        </motion.button>

        {/* Network — Sprint B-2 Legacy Tech */}
        <motion.button
          type="button"
          onClick={() => navigate('/manager/network')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="group relative isolate w-full overflow-hidden border border-white/[0.05] text-left transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-fuchsia-400" />
          <div className="relative flex flex-col gap-3 p-6 pl-7">
            <div className="flex items-center justify-between gap-3">
              <span
                className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                Comunidade · Amigos
              </span>
              {social.incoming.length > 0 && (
                <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-rose-500 px-2.5 py-1 font-display text-[10px] font-black tracking-[0.18em] text-white">
                  {social.incoming.length} pedido{social.incoming.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h3 className="font-display text-[24px] font-black uppercase leading-[0.95] tracking-tight text-white transition-colors group-hover:text-neon-yellow">
              Network
            </h3>
            <p className="text-[13px] leading-relaxed text-white/55">
              <span className="font-bold text-white/90">{social.friends.length}</span> amigo{social.friends.length !== 1 ? 's' : ''} ativos · convites e desafios entre managers.
            </p>
            <span
              className="mt-2 inline-flex w-fit items-center bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all group-hover:bg-white"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Abrir network
            </span>
          </div>
        </motion.button>

        {/* SCOUTS — OLEFOOT PYTHON MODE intelligence hub */}
        <motion.button
          type="button"
          onClick={() => navigate('/manager/scouts')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="group relative isolate w-full overflow-hidden border border-white/[0.05] text-left transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />
          <div className="relative flex flex-col gap-3 p-6 pl-7">
            <div className="flex items-center justify-between gap-3">
              <span
                className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                Inteligência · Python Mode
              </span>
              <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-display text-[10px] font-black tracking-[0.18em] text-emerald-400 uppercase">
                Novo
              </span>
            </div>
            <h3 className="font-display text-[24px] font-black uppercase leading-[0.95] tracking-tight text-white transition-colors group-hover:text-neon-yellow">
              Scouts
            </h3>
            <p className="text-[13px] leading-relaxed text-white/55">
              Mapa de consequências, relatório da noite e diagnóstico do clube. Atualizado em tempo real.
            </p>
            <span
              className="mt-2 inline-flex w-fit items-center gap-2 bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all group-hover:bg-white"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <Brain className="w-4 h-4" />
              Abrir scouts
            </span>
          </div>
        </motion.button>

        {/* PRO — Sprint B-2 Legacy Tech */}
        <motion.button
          type="button"
          onClick={() => navigate('/manager/pro')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="group relative isolate w-full overflow-hidden border border-white/[0.05] text-left transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-white/45" />
          <div className="relative flex flex-col gap-3 p-6 pl-7">
            <span
              className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              Carreira PRO
            </span>
            <h3 className="font-display text-[24px] font-black uppercase leading-[0.95] tracking-tight text-white transition-colors group-hover:text-neon-yellow">
              PRO
            </h3>
            <p className="text-[13px] leading-relaxed text-white/55">
              Acompanhamento, vendas e indicadores avançados de performance do clube.
            </p>
            <span
              className="mt-2 inline-flex w-fit items-center bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all group-hover:bg-white"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Abrir PRO
            </span>
          </div>
        </motion.button>
      </section>

      {/* ── TROFÉUS ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="ole-eyebrow !text-neon-yellow" style={{ fontFamily: 'var(--font-ui)' }}>
            <span>Troféus</span>
          </div>
          <Trophy className="h-3.5 w-3.5 text-neon-yellow/70" aria-hidden />
        </div>

        {/* Memoráveis */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-panel border border-white/10 border-l-4 border-l-neon-yellow rounded-sm p-4 sm:p-5 lg:p-6"
        >
          <h3 className="font-display text-xs font-black uppercase tracking-wider text-white mb-2">
            Memoráveis
          </h3>
          <p className="text-[11px] text-gray-400 mb-4">
            Somente <span className="text-white/90 font-bold">campeonatos conquistados</span>: liga, copa e supercopa.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {MEMORABLE_TROPHY_SLOTS.map((slot, i) => {
              const earned = memorableTrophyUnlockedIds.includes(slot.id);
              return (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-2 sm:p-3 rounded-sm border-2 transition-all',
                    earned
                      ? 'bg-neon-yellow/5 border-neon-yellow/40 hover:border-neon-yellow/60 hover:shadow-[0_0_20px_rgba(253,225,0,0.15)]'
                      : 'bg-black/40 border-white/10 opacity-50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-sm transition-transform hover:scale-110',
                      earned
                        ? 'bg-gradient-to-br from-neon-yellow via-amber-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(250,204,21,0.5)]'
                        : 'bg-white/5 text-gray-600',
                    )}
                  >
                    {earned ? (
                      <Trophy className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
                    ) : (
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                  <p className={cn(
                    'text-center text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight',
                    earned ? 'text-neon-yellow' : 'text-gray-500',
                  )}>
                    {slot.name}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Competição */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-panel border border-white/10 rounded-sm p-4 sm:p-5 lg:p-6"
        >
          <h3 className="font-display text-xs font-black uppercase tracking-wider text-white mb-4">
            Competição
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {competitionTrophies.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.03 }}
                className={cn(
                  'flex flex-col items-center gap-2 p-2 sm:p-3 rounded-sm border transition-all',
                  t.earned
                    ? 'bg-cyan-500/5 border-cyan-500/30 hover:border-cyan-500/50'
                    : 'bg-black/40 border-white/10 opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-sm',
                    t.earned
                      ? 'bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-600 text-black'
                      : 'bg-white/5 text-gray-600',
                  )}
                >
                  {t.earned ? (
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                  ) : (
                    <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </div>
                <p className={cn(
                  'text-center text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight',
                  t.earned ? 'text-cyan-300' : 'text-gray-500',
                )}>
                  {t.name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Missões */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-panel border border-white/10 rounded-sm p-4 sm:p-5 lg:p-6"
        >
          <h3 className="font-display text-xs font-black uppercase tracking-wider text-white mb-4">
            Missões
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {missionTrophies.map((t, i) => (
              <motion.div
                key={t.def.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 + i * 0.03 }}
                className={cn(
                  'flex flex-col items-center gap-2 p-2 sm:p-3 rounded-sm border transition-all',
                  t.earned
                    ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
                    : 'bg-black/40 border-white/10 opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-sm',
                    t.earned
                      ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 text-black'
                      : 'bg-white/5 text-gray-600',
                  )}
                >
                  {t.earned ? (
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                  ) : (
                    <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </div>
                <p className={cn(
                  'text-center text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-tight',
                  t.earned ? 'text-emerald-300' : 'text-gray-500',
                )}>
                  {t.trophy.name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── DRAWERS ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawer === 'career' ? (
          <CareerDrawer
            currentTierId={currentTier.id}
            expLifetime={expLifetime}
            onClose={() => setDrawer(null)}
          />
        ) : null}
        {drawer === 'network' ? <NetworkDrawer onClose={() => setDrawer(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function CareerTimelineStrip({
  tiers,
  currentTierId,
  tierFrac,
  onClick,
}: {
  tiers: typeof CAREER_TIERS;
  currentTierId: number;
  tierFrac: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative isolate overflow-hidden',
        'w-full p-6 sm:p-8',
        'border-2 border-neon-yellow/30 bg-gradient-to-br from-neon-yellow/8 via-neon-yellow/3 to-black/60',
        'transition-all duration-300',
        'hover:border-neon-yellow/60 hover:shadow-[0_0_32px_rgba(253,225,0,0.2)]',
        'hover:scale-[1.005]',
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      {/* Diagonal accent decorativo */}
      <div
        className="absolute -right-12 -top-12 h-48 w-48 bg-neon-yellow opacity-[0.06] transition-all duration-500 group-hover:opacity-[0.12] group-hover:scale-110"
        style={{ transform: 'rotate(34deg) skewX(-12deg)' }}
        aria-hidden
      />

      {/* Header: título + progresso */}
      <div className="relative z-10 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 bg-neon-yellow rounded-full" aria-hidden />
          <h3 className="font-display text-sm font-black uppercase tracking-[0.18em] text-neon-yellow">
            Plano de Carreira
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-white/50 tabular-nums">
            {Math.round(tierFrac * 100)}%
          </span>
          <div className="h-2 w-24 bg-black/40 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-neon-yellow to-amber-400 transition-all duration-500"
              style={{ width: `${tierFrac * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline de tiers — ÍCONES GRANDES */}
      <div className="relative z-10 flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
        {tiers.map((t, i) => {
          const reached = t.id <= currentTierId;
          const isCurrent = t.id === currentTierId;
          const Icon = TIER_ICONS[t.id] ?? Medal;

          return (
            <div key={t.id} className="flex shrink-0 items-center">
              {/* Tier node */}
              <div className="flex flex-col items-center gap-2 px-2">
                {/* Ícone GRANDE com glow */}
                <div
                  className={cn(
                    'relative flex items-center justify-center rounded-full',
                    'border-3 transition-all duration-300',
                    'group-hover:scale-105',
                    isCurrent && 'h-16 w-16 sm:h-20 sm:w-20',
                    !isCurrent && 'h-12 w-12 sm:h-14 sm:w-14',
                    isCurrent && 'border-neon-yellow bg-neon-yellow/20 shadow-[0_0_24px_rgba(253,225,0,0.6)] animate-pulse',
                    reached && !isCurrent && 'border-neon-yellow/60 bg-neon-yellow/10 shadow-[0_0_12px_rgba(253,225,0,0.3)]',
                    !reached && 'border-white/20 bg-white/[0.03]',
                  )}
                >
                  <Icon
                    className={cn(
                      'transition-all duration-300',
                      isCurrent && 'h-8 w-8 sm:h-10 sm:w-10',
                      !isCurrent && 'h-5 w-5 sm:h-6 sm:w-6',
                      isCurrent && 'text-neon-yellow drop-shadow-[0_0_8px_rgba(253,225,0,0.8)]',
                      reached && !isCurrent && 'text-neon-yellow/80',
                      !reached && 'text-white/30',
                    )}
                    strokeWidth={isCurrent ? 2.5 : 2.2}
                    aria-hidden
                  />

                  {/* Pulse ring no tier atual */}
                  {isCurrent && (
                    <div className="absolute inset-0 rounded-full border-2 border-neon-yellow animate-ping opacity-75" />
                  )}
                </div>

                {/* Label do tier */}
                <span
                  className={cn(
                    'whitespace-nowrap font-display font-bold uppercase tracking-wider transition-all duration-300',
                    isCurrent && 'text-[10px] sm:text-xs text-neon-yellow',
                    reached && !isCurrent && 'text-[9px] sm:text-[10px] text-white/70',
                    !reached && 'text-[8px] sm:text-[9px] text-white/40',
                  )}
                >
                  {t.name}
                </span>
              </div>

              {/* Conector entre tiers */}
              {i < tiers.length - 1 && (
                <div className="relative h-[3px] w-6 sm:w-8 shrink-0">
                  <div
                    className={cn(
                      'absolute inset-0 transition-all duration-500',
                      reached ? 'bg-gradient-to-r from-neon-yellow to-amber-400' : 'bg-white/10',
                    )}
                  />
                  {reached && (
                    <div className="absolute inset-0 bg-gradient-to-r from-neon-yellow to-amber-400 blur-sm opacity-50" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: CTA */}
      <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
        <p className="text-xs text-white/60">
          Clique para ver detalhes da evolução
        </p>
        <ChevronRight className="h-5 w-5 text-neon-yellow transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function ActionCard({
  icon: Icon,
  title,
  subtitle,
  metric,
  footer,
  onClick,
  tone,
  badge,
  locked,
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle: string;
  metric: ReactNode;
  footer: string;
  onClick: () => void;
  tone: 'yellow' | 'fuchsia' | 'cyan';
  badge?: string;
  locked?: boolean;
}) {
  // Componente removido — agora usa ActionCard de @/components/cards
  return null;
}

/* ── Drawers ──────────────────────────────────────────────────── */

type CompetitionTrophyItem = ReturnType<typeof COMPETITION_TROPHY_CATALOG[number]['unlocked']> extends boolean
  ? typeof COMPETITION_TROPHY_CATALOG[number] & { earned: boolean }
  : never;

type MissionTrophyItem = {
  def: typeof MISSION_CATALOG[number];
  trophy: NonNullable<typeof MISSION_CATALOG[number]['trophy']>;
  earned: boolean;
};

function TrophyRoomSummary({
  competitionTrophies,
  missionTrophies,
}: {
  competitionTrophies: CompetitionTrophyItem[];
  missionTrophies: MissionTrophyItem[];
}) {
  /** Junta tudo e prioriza conquistados; completa com pendentes em aberto até 6. */
  const cards = useMemo(() => {
    const combined: Array<{
      key: string;
      name: string;
      subtitle: string;
      description?: string;
      earned: boolean;
      group: 'comp' | 'miss';
    }> = [];
    for (const c of competitionTrophies) {
      combined.push({
        key: `comp:${c.id}`,
        name: c.name,
        subtitle: 'Competição',
        description: c.description,
        earned: c.earned,
        group: 'comp',
      });
    }
    for (const m of missionTrophies) {
      combined.push({
        key: `miss:${m.def.id}`,
        name: m.trophy.name,
        subtitle: m.def.title,
        description: m.trophy.description ?? m.def.description,
        earned: m.earned,
        group: 'miss',
      });
    }
    combined.sort((a, b) => (a.earned === b.earned ? 0 : a.earned ? -1 : 1));
    return combined.slice(0, 6);
  }, [competitionTrophies, missionTrophies]);

  const earnedCount = cards.filter((c) => c.earned).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="space-y-4"
      aria-labelledby="trophy-room-heading"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="ole-eyebrow !text-neon-yellow" style={{ fontFamily: 'var(--font-ui)' }}>
              <span>Sala de Troféus</span>
            </div>
            <Trophy className="h-3.5 w-3.5 text-neon-yellow/70" aria-hidden />
          </div>
          <p className="text-sm text-gray-500">
            Competições, missões e marcos da trajetória.
          </p>
        </div>
        <span className="shrink-0 bg-neon-yellow/10 border border-neon-yellow/30 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-neon-yellow"
              style={{ borderRadius: 'var(--radius-sm)' }}>
          {earnedCount}/{cards.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c, idx) => (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.28 + idx * 0.04 }}
          >
            <TrophyCard
              name={c.name}
              description={c.description}
              category={c.group === 'comp' ? 'Competição' : 'Missão'}
              earned={c.earned}
              tone={c.group === 'comp' ? 'yellow' : 'cyan'}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function DrawerShell({
  title,
  onClose,
  children,
  accent = 'bg-neon-yellow',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex max-h-[min(90dvh,calc(100dvh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-md border border-white/10 bg-dark-gray shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={cn('h-1.5 w-6 rounded-full', accent)} aria-hidden />
            <h3 className="font-display text-sm font-black uppercase tracking-wider text-white md:text-base">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function CareerDrawer({
  currentTierId,
  expLifetime,
  onClose,
}: {
  currentTierId: number;
  expLifetime: number;
  onClose: () => void;
}) {
  return (
    <DrawerShell title="Plano de Carreira" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-neon-yellow/25 bg-neon-yellow/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">EXP acumulado</p>
          <p className="mt-1 font-display text-3xl font-black text-neon-yellow">{formatExp(expLifetime)}</p>
          <div className="mt-3">
            <CareerTierBadge expLifetimeEarned={expLifetime} showProgress />
          </div>
        </div>

        <div>
          <p className="mb-4 font-display text-[10px] font-bold uppercase tracking-widest text-white/45">
            Evolução ao longo dos tiers
          </p>
          <ol className="space-y-3">
            {CAREER_TIERS.map((t) => {
              const reached = t.id <= currentTierId;
              const isCurrent = t.id === currentTierId;
              const Icon = TIER_ICONS[t.id] ?? Medal;
              return (
                <li
                  key={t.id}
                  className={cn(
                    'relative isolate overflow-hidden',
                    'flex items-center gap-4 rounded-lg border-2 p-4',
                    'transition-all duration-300',
                    isCurrent && 'border-neon-yellow/60 bg-gradient-to-r from-neon-yellow/15 to-neon-yellow/5 shadow-[0_0_20px_rgba(253,225,0,0.2)]',
                    reached && !isCurrent && 'border-neon-yellow/30 bg-neon-yellow/[0.06]',
                    !reached && 'border-white/10 bg-black/30 opacity-60',
                  )}
                >
                  {/* Diagonal accent no tier atual */}
                  {isCurrent && (
                    <div
                      className="absolute -right-6 -top-6 h-24 w-24 bg-neon-yellow opacity-[0.08]"
                      style={{ transform: 'rotate(34deg) skewX(-12deg)' }}
                      aria-hidden
                    />
                  )}

                  {/* Ícone GRANDE com glow */}
                  <div
                    className={cn(
                      'relative z-10 flex shrink-0 items-center justify-center rounded-full',
                      'border-3 transition-all duration-300',
                      isCurrent && 'h-16 w-16 border-neon-yellow bg-neon-yellow/20 shadow-[0_0_20px_rgba(253,225,0,0.6)]',
                      reached && !isCurrent && 'h-14 w-14 border-neon-yellow/50 bg-neon-yellow/10 shadow-[0_0_12px_rgba(253,225,0,0.3)]',
                      !reached && 'h-12 w-12 border-white/20 bg-white/[0.03]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'transition-all duration-300',
                        isCurrent && 'h-8 w-8 text-neon-yellow drop-shadow-[0_0_6px_rgba(253,225,0,0.8)]',
                        reached && !isCurrent && 'h-7 w-7 text-neon-yellow/80',
                        !reached && 'h-6 w-6 text-white/40',
                      )}
                      strokeWidth={isCurrent ? 2.5 : 2.2}
                      aria-hidden
                    />

                    {/* Pulse ring no tier atual */}
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full border-2 border-neon-yellow animate-ping opacity-75" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="relative z-10 min-w-0 flex-1">
                    <p
                      className={cn(
                        'font-display font-black uppercase tracking-wide',
                        isCurrent && 'text-base text-neon-yellow',
                        !isCurrent && 'text-sm text-white',
                      )}
                    >
                      {t.name}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-neon-yellow px-2 py-0.5 font-mono text-[9px] font-black text-black">
                          <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
                          AGORA
                        </span>
                      )}
                    </p>
                    <p className={cn(
                      'mt-1 text-[11px]',
                      isCurrent ? 'text-white/70' : 'text-white/50',
                    )}>
                      {t.minExp === 0 ? 'Nível inicial' : `A partir de ${formatExp(t.minExp)} EXP`}
                    </p>
                  </div>

                  {/* Check icon */}
                  {reached && (
                    <CheckCircle
                      className={cn(
                        'relative z-10 h-5 w-5 shrink-0',
                        isCurrent ? 'text-neon-yellow' : 'text-neon-green',
                      )}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60">
          <p className="flex items-center gap-1.5 font-display font-bold uppercase tracking-wider text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-neon-yellow" /> Como ganho EXP?
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Completa missões diárias, semanais e especiais</li>
            <li>Vence partidas oficiais da liga</li>
            <li>Evolui estruturas do clube e treina o plantel</li>
          </ul>
        </div>
      </div>
    </DrawerShell>
  );
}

function NetworkDrawer({ onClose }: { onClose: () => void }) {
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const social = useGameStore((s) => s.social);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');

  const blockedManagerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of social.friends) ids.add(f.managerId);
    for (const o of social.outgoing) ids.add(o.toManagerId);
    for (const i of social.incoming) ids.add(i.fromManagerId);
    return ids;
  }, [social]);

  const suggestions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    // DISCOVERABLE_MANAGERS removido temporariamente para MVP
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

  return (
    <DrawerShell title="Network" onClose={onClose} accent="bg-fuchsia-500">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] text-white/60">Teu clube: <span className="font-bold text-white">{club.name}</span></p>
            <p className="text-[10px] text-white/40">Amigos, pedidos e convites.</p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-fuchsia-500 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-400"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>

        {social.incoming.length > 0 ? (
          <section>
            <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/90">
              Solicitações
            </h4>
            <ul className="space-y-2">
              {social.incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-fuchsia-500/25 bg-black/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-white">{req.fromClubName}</p>
                    <p className="text-[10px] text-gray-500">Quer entrar na sua rede</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ACCEPT_FRIEND_REQUEST', requestId: req.id })}
                      className="rounded bg-neon-green px-2 py-1 font-display text-[10px] font-black uppercase tracking-wider text-black hover:bg-white"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'DECLINE_FRIEND_REQUEST', requestId: req.id })}
                      className="rounded border border-white/20 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:bg-white/10"
                    >
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-white/60">
            <Users className="h-3.5 w-3.5" />
            Amigos ({social.friends.length})
          </h4>
          {social.friends.length === 0 ? (
            <p className="rounded border border-dashed border-white/10 bg-black/20 px-3 py-3 text-sm text-gray-500">
              Nenhum amigo ainda — clica em <strong className="text-white">Adicionar</strong>.
            </p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {social.friends.map((f) => (
                <li
                  key={f.managerId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                >
                  <span className="truncate font-display text-sm font-bold text-white">{f.clubName}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_SOCIAL_FRIEND', managerId: f.managerId })}
                    className="shrink-0 text-[10px] font-bold uppercase text-gray-500 hover:text-red-400"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {social.outgoing.length > 0 ? (
          <section>
            <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">
              Convites enviados
            </h4>
            <ul className="space-y-1.5">
              {social.outgoing.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <span className="truncate font-display text-sm font-bold text-gray-300">{o.toClubName}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CANCEL_OUTGOING_FRIEND_REQUEST', requestId: o.id })}
                    className="shrink-0 text-[10px] font-bold uppercase text-gray-500 hover:text-white"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-[10px] text-gray-600">
          Indicações pelo teu código aparecem aqui em breve (próxima fase).
        </p>
      </div>

      <AnimatePresence>
        {addOpen ? (
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
              className="my-auto flex max-h-[min(88dvh,calc(100dvh-5rem))] w-full max-w-md flex-col overflow-hidden rounded-xl border border-fuchsia-500/40 bg-panel p-5 sm:max-h-[min(90dvh,640px)]"
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
                  className="rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome do clube ou cidade..."
                className="mb-3 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-fuchsia-500/60 focus:outline-none"
              />
              <ul className="max-h-[min(40dvh,14rem)] flex-1 divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
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
                        className="shrink-0 bg-fuchsia-600 px-2.5 py-1 font-display text-[10px] font-bold uppercase text-white hover:bg-fuchsia-500"
                      >
                        Convidar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DrawerShell>
  );
}


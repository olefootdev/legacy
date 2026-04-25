import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Trophy,
  Activity,
  Lock,
  UserPlus,
  Users,
  X,
  TrendingUp,
  Network,
  CheckCircle,
  Sparkles,
  ChevronRight,
  Flag,
  Wallet,
  Target,
  ShieldCheck,
  CircleDot,
  Zap,
  Medal,
  Globe2,
  Gem,
  Crown,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { DISCOVERABLE_MANAGERS } from '@/social/catalog';
import { formatExp, formatBroDisplay } from '@/systems/economy';
import { useProgressionStore } from '@/progression/progressionStore';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { COMPETITION_TROPHY_CATALOG } from '@/trophies/competitionCatalog';
import { MEMORABLE_TROPHY_SLOTS } from '@/trophies/memorableCatalog';
import { CAREER_TIERS, computeCareerTier, nextCareerTier, tierProgress01 } from '@/systems/careerTiers';
import { CareerTierBadge } from '@/components/CareerTierBadge';

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
  const navigate = useNavigate();

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
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 pb-12">
      {/* ── HERO ────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-md border border-neon-yellow/20 bg-gradient-to-br from-[#141109] via-black/80 to-black/90"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(234,255,0,0.18), transparent 55%)',
          }}
        />
        <div className="relative z-10 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-md border-2 border-neon-yellow/60 bg-black/60 sm:mx-0 sm:h-28 sm:w-28">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-10 w-10 text-neon-yellow/80" aria-hidden />
                </div>
              )}
              <span className="absolute bottom-1 right-1 rounded bg-neon-yellow px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-black">
                Manager
              </span>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-white/50">
                {club.name} · {club.city}
              </p>
              <h1 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                {managerName}
              </h1>
              {favoriteTeam ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                  {favoriteTeam.logo ? (
                    <img src={favoriteTeam.logo} alt="" className="h-4 w-4 rounded-full object-contain" />
                  ) : (
                    <Flag className="h-3.5 w-3.5 text-white/60" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    Coração: <span className="text-white">{favoriteTeam.name}</span>
                  </span>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
                <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-center sm:text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">EXP</p>
                  <p className="font-display text-sm font-black text-neon-yellow">{formatExp(finance.ole)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-center sm:text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">BRO</p>
                  <p className="font-display text-sm font-black text-emerald-300">{broDisplay.primary}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-center sm:text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Elenco</p>
                  <p className="font-display text-sm font-black text-white">{squadSize}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── TIMELINE DE CARREIRA (sugestão A) ───────────────────── */}
      <CareerTimelineStrip
        tiers={CAREER_TIERS}
        currentTierId={currentTier.id}
        tierFrac={tierFrac}
        onClick={() => setDrawer('career')}
      />

      {/* ── SMART SHORTCUTS (sugestão C) ────────────────────────── */}
      {shortcuts.length > 0 ? (
        <div className="space-y-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-white/45">Atalhos smart</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shortcuts.map((s) => {
              const Icon = s.icon;
              const toneClass =
                s.tone === 'yellow'
                  ? 'border-neon-yellow/35 bg-neon-yellow/5 text-neon-yellow'
                  : s.tone === 'fuchsia'
                  ? 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-200'
                  : 'border-cyan-500/35 bg-cyan-500/10 text-cyan-200';
              const inner = (
                <>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-display text-xs font-black uppercase tracking-wider leading-tight">
                      {s.label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/60">{s.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                </>
              );
              const classNames = cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 transition hover:brightness-110',
                toneClass,
              );
              return s.to ? (
                <Link key={s.key} to={s.to} className={classNames}>
                  {inner}
                </Link>
              ) : (
                <button key={s.key} type="button" onClick={s.onClick} className={classNames}>
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── 3 CARDS DE AÇÃO ─────────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-3">
        <ActionCard
          icon={TIER_ICONS[currentTier.id] ?? TrendingUp}
          title="Carreira"
          subtitle={currentTier.name}
          metric={`${formatExp(expLifetime)} EXP`}
          footer={nextTier ? `Próximo: ${nextTier.name}` : 'Tier máximo alcançado'}
          onClick={() => setDrawer('career')}
          tone="yellow"
        />
        <ActionCard
          icon={Network}
          title="Network"
          subtitle={`${social.friends.length} amigo${social.friends.length !== 1 ? 's' : ''}`}
          metric={`${social.incoming.length} pendente${social.incoming.length !== 1 ? 's' : ''}`}
          footer={
            social.incoming.length > 0
              ? 'Solicitações pra aprovar'
              : social.outgoing.length > 0
              ? `${social.outgoing.length} convite${social.outgoing.length > 1 ? 's' : ''} enviado${social.outgoing.length > 1 ? 's' : ''}`
              : 'Adicionar amigos'
          }
          onClick={() => setDrawer('network')}
          badge={social.incoming.length > 0 ? String(social.incoming.length) : undefined}
          tone="fuchsia"
        />
        <ActionCard
          icon={ShieldCheck}
          title="PRO"
          subtitle="Acompanhamento de cards"
          metric="R$ 0,00"
          footer="Vendas e saldo dos teus cards"
          onClick={() => navigate('/manager/pro')}
          tone="cyan"
        />
      </div>

      {/* ── MEMORÁVEIS (seção separada) ─────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className={cn(
          'relative overflow-hidden rounded-xl border-2 border-neon-yellow bg-gradient-to-b from-[#1a1508] via-black/80 to-black/90',
          'p-5 md:p-6',
          'shadow-[0_0_28px_rgba(234,255,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]',
        )}
        aria-labelledby="memorables-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234,255,0,0.5), transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative z-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="memorables-heading"
                className="inline-flex -skew-x-6 bg-neon-yellow px-4 py-1.5 font-display text-xs font-black uppercase tracking-[0.25em] text-black"
              >
                <span className="skew-x-6">Memoráveis</span>
              </h2>
            </div>
            <p className="max-w-md text-[11px] leading-relaxed text-amber-200/70 md:text-xs">
              Somente <span className="text-amber-100/90">campeonatos conquistados</span>: liga, copa e supercopa.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {MEMORABLE_TROPHY_SLOTS.map((slot, i) => {
              const earned = memorableTrophyUnlockedIds.includes(slot.id);
              return (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  className={cn(
                    'flex min-h-[132px] flex-col items-center justify-between rounded-lg border p-3 text-center sm:min-h-[148px] sm:p-4',
                    earned
                      ? 'border-neon-yellow/80 bg-neon-yellow/10 shadow-[0_0_18px_rgba(234,255,0,0.2)]'
                      : 'border-white/15 bg-black/40',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-14 w-14 -skew-x-6 items-center justify-center rounded-full border-2 sm:h-16 sm:w-16',
                      earned
                        ? 'border-neon-yellow bg-gradient-to-br from-neon-yellow to-amber-500 text-black shadow-[0_0_22px_rgba(250,204,21,0.45)]'
                        : 'border-white/20 bg-white/5 text-gray-600',
                    )}
                  >
                    {earned ? (
                      <Trophy className="h-7 w-7 skew-x-6 sm:h-8 sm:w-8" strokeWidth={2.2} />
                    ) : (
                      <Lock className="h-6 w-6 skew-x-6 sm:h-7 sm:w-7" />
                    )}
                  </div>
                  <div className="mt-2 w-full space-y-0.5">
                    <p className="font-display text-[10px] font-bold uppercase leading-tight tracking-wide text-white sm:text-xs">
                      {slot.name}
                    </p>
                    <p className="text-[9px] leading-snug text-gray-500 line-clamp-2 sm:text-[10px]">{slot.blurb}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* ── SALA DE TROFÉUS (6 cards resumidos) ─────────────────── */}
      <TrophyRoomSummary competitionTrophies={competitionTrophies} missionTrophies={missionTrophies} />

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
      className="group block w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:border-neon-yellow/30 hover:bg-white/[0.04]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/45">
          Plano de carreira
        </span>
        <span className="font-mono text-[10px] text-white/40">
          {Math.round(tierFrac * 100)}% do próximo
        </span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
        {tiers.map((t, i) => {
          const reached = t.id <= currentTierId;
          const isCurrent = t.id === currentTierId;
          const Icon = TIER_ICONS[t.id] ?? Medal;
          return (
            <div key={t.id} className="flex shrink-0 items-center">
              <div className="flex flex-col items-center gap-1 px-1">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition',
                    isCurrent && 'border-neon-yellow bg-neon-yellow/20 shadow-[0_0_12px_rgba(234,255,0,0.35)]',
                    reached && !isCurrent && 'border-neon-yellow/60 bg-neon-yellow/5',
                    !reached && 'border-white/15 bg-white/[0.02]',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      isCurrent && 'text-neon-yellow',
                      reached && !isCurrent && 'text-neon-yellow/70',
                      !reached && 'text-white/30',
                    )}
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </div>
                <span
                  className={cn(
                    'whitespace-nowrap font-display text-[8px] font-bold uppercase tracking-wider',
                    isCurrent ? 'text-neon-yellow' : reached ? 'text-white/70' : 'text-white/30',
                  )}
                >
                  {t.name}
                </span>
              </div>
              {i < tiers.length - 1 ? (
                <div className={cn('h-[2px] w-4 shrink-0', reached ? 'bg-neon-yellow/60' : 'bg-white/10')} />
              ) : null}
            </div>
          );
        })}
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
  const toneClass =
    tone === 'yellow'
      ? 'border-neon-yellow/25 hover:border-neon-yellow/50 bg-gradient-to-br from-neon-yellow/5 to-black/40'
      : tone === 'fuchsia'
      ? 'border-fuchsia-500/25 hover:border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-500/5 to-black/40'
      : 'border-cyan-500/25 hover:border-cyan-500/50 bg-gradient-to-br from-cyan-500/5 to-black/40';
  const iconClass =
    tone === 'yellow' ? 'text-neon-yellow' : tone === 'fuchsia' ? 'text-fuchsia-300' : 'text-cyan-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition',
        toneClass,
      )}
    >
      {badge ? (
        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 font-display text-[10px] font-black text-white">
          {badge}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass)} aria-hidden />
        <h3 className="font-display text-[10px] font-black uppercase tracking-widest text-white/60">{title}</h3>
        {locked ? <Lock className="ml-auto h-3 w-3 text-white/40" aria-hidden /> : null}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="font-display text-lg font-black leading-tight text-white">{metric}</div>
      </div>
      <p className="text-[11px] text-white/50">{subtitle}</p>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-[10px] text-white/45">{footer}</span>
        <ChevronRight className="h-3.5 w-3.5 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
      </div>
    </button>
  );
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
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
      aria-labelledby="trophy-room-heading"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            id="trophy-room-heading"
            className="flex items-center gap-2 font-display text-xl font-black uppercase tracking-wider text-white md:text-2xl"
          >
            <Trophy className="h-6 w-6 shrink-0 text-neon-yellow" />
            Sala de Troféus
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Competições, missões e marcos da sua trajetória.
          </p>
        </div>
        <span className="shrink-0 rounded bg-neon-yellow/10 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
          {earnedCount}/{cards.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.key}
            className={cn(
              'relative flex min-h-[140px] flex-col gap-2 overflow-hidden rounded-lg border p-3',
              c.earned
                ? 'border-neon-yellow/40 bg-gradient-to-br from-neon-yellow/10 to-black/40'
                : 'border-white/10 bg-panel opacity-80',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 -skew-x-6 shrink-0 items-center justify-center rounded-lg',
                  c.earned ? 'bg-neon-yellow text-black' : 'bg-white/5 text-gray-600',
                )}
              >
                {c.earned ? (
                  <Trophy className="h-5 w-5 skew-x-6" strokeWidth={2.2} />
                ) : (
                  <Lock className="h-4 w-4 skew-x-6" />
                )}
              </div>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-display text-[8px] font-bold uppercase tracking-wider',
                  c.group === 'comp'
                    ? c.earned
                      ? 'bg-neon-yellow/20 text-neon-yellow'
                      : 'bg-white/5 text-gray-500'
                    : c.earned
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'bg-white/5 text-gray-500',
                )}
              >
                {c.group === 'comp' ? 'Competição' : 'Missão'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] font-bold uppercase leading-tight tracking-wide text-white">
                {c.name}
              </p>
              {c.description ? (
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-500">{c.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
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
          <p className="mb-3 font-display text-[10px] font-bold uppercase tracking-widest text-white/45">
            Evolução ao longo dos tiers
          </p>
          <ol className="space-y-2">
            {CAREER_TIERS.map((t) => {
              const reached = t.id <= currentTierId;
              const isCurrent = t.id === currentTierId;
              const Icon = TIER_ICONS[t.id] ?? Medal;
              return (
                <li
                  key={t.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3',
                    isCurrent && 'border-neon-yellow/50 bg-neon-yellow/10',
                    reached && !isCurrent && 'border-neon-yellow/20 bg-neon-yellow/[0.04]',
                    !reached && 'border-white/10 bg-black/30 opacity-70',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2',
                      isCurrent && 'border-neon-yellow bg-neon-yellow/20',
                      reached && !isCurrent && 'border-neon-yellow/40 bg-neon-yellow/10',
                      !reached && 'border-white/15 bg-white/[0.02]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        isCurrent && 'text-neon-yellow',
                        reached && !isCurrent && 'text-neon-yellow/80',
                        !reached && 'text-white/40',
                      )}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'font-display text-sm font-black uppercase tracking-wide',
                        isCurrent ? 'text-neon-yellow' : 'text-white',
                      )}
                    >
                      {t.name}
                      {isCurrent ? (
                        <span className="ml-2 rounded bg-neon-yellow px-1.5 py-0.5 font-mono text-[9px] text-black">
                          AGORA
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-white/50">
                      {t.minExp === 0 ? 'Nível inicial' : `A partir de ${formatExp(t.minExp)} EXP`}
                    </p>
                  </div>
                  {reached ? <CheckCircle className="h-4 w-4 shrink-0 text-neon-green" aria-hidden /> : null}
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


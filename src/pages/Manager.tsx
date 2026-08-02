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
import { useGameStore } from '@/game/store';
import { formatExp, formatBroDisplay, formatCompactNumber } from '@/systems/economy';
import { useProgressionStore } from '@/progression/progressionStore';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { COMPETITION_TROPHY_CATALOG } from '@/trophies/competitionCatalog';
import { MEMORABLE_TROPHY_SLOTS } from '@/trophies/memorableCatalog';
import { useManagerCrowns } from '@/hooks/useManagerCrowns';
import { CAREER_TIERS, computeCareerTier, nextCareerTier, tierProgress01 } from '@/systems/careerTiers';
import { TrophyCard } from '@/components/cards/TrophyCard';
import { CareerTierBadge } from '@/components/CareerTierBadge';
import { SmartShortcut } from '@/components/cards/SmartShortcut';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';
import { useFriendships } from '@/social/useFriendships';

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
  const { crowns: dailyCrowns } = useManagerCrowns();
  const userSettings = useGameStore((s) => s.userSettings);
  const social = useFriendships().data;

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
        {/* ── HERO no layer final ──────────────────────────────────────────
            Saíram: o tier em marca-d'água gigante atrás do título, o nome do
            tier em serifa itálica do tamanho da manchete, régua decorativa e a
            frase entre aspas. Ficou quem é o manager, em que degrau está, e o
            que ele tem no bolso (logo abaixo). */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 px-4 sm:px-6 lg:px-8"
          style={{ paddingBlock: 'clamp(26px, 5vw, 46px)' }}
        >
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            {club.name} · {club.city}
          </span>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1
              className="font-impact uppercase"
              style={{
                color: 'var(--color-deep-black)',
                fontSize: 'clamp(42px, 11vw, 88px)',
                lineHeight: 0.84,
                letterSpacing: '-0.01em',
              }}
            >
              Manager
            </h1>
            {/* O tier é o degrau da carreira — chip preto, como um distintivo. */}
            <span
              className="inline-flex items-center font-impact uppercase"
              style={{
                background: 'var(--color-deep-black)',
                color: 'var(--color-neon-yellow)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: 'clamp(15px, 3.6vw, 22px)',
                lineHeight: 1,
              }}
            >
              {currentTier.name}
            </span>
          </div>

          {/* Stats strip — 3 métricas principais */}
          <div className="mt-6 grid max-w-lg grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-impact text-neon-yellow tabular-nums leading-none truncate"
                style={{ fontSize: 'clamp(20px, 4.4vw, 36px)' }}
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
                className="font-impact text-neon-yellow tabular-nums leading-none truncate"
                style={{ fontSize: 'clamp(20px, 4.4vw, 36px)' }}
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
                className="font-impact text-neon-yellow tabular-nums leading-none truncate"
                style={{ fontSize: 'clamp(20px, 4.4vw, 36px)' }}
              >
                {squadSize}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Elenco
              </p>
            </div>
          </div>

        </motion.div>
      </section>

      {/* ── DESTINOS DO MANAGER — grade compacta, escaneável ─────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden className="h-px w-8 bg-neon-yellow/55" />
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Sua central
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              key: 'career',
              title: 'Carreira',
              icon: TrendingUp,
              accent: 'var(--color-neon-yellow)',
              stat: currentTier.name,
              onClick: () => setDrawer('career'),
            },
            {
              key: 'network',
              title: 'Network',
              icon: Network,
              accent: '#e879f9',
              stat: `${social.friends.length} amigo${social.friends.length !== 1 ? 's' : ''}`,
              badge: social.incoming.length > 0 ? String(social.incoming.length) : null,
              onClick: () => navigate('/manager/network'),
            },
            {
              key: 'scouts',
              title: 'Scouts',
              icon: Brain,
              accent: 'var(--color-neon-yellow)',
              stat: 'Relatório da noite',
              tag: 'Novo',
              onClick: () => navigate('/manager/scouts'),
            },
            {
              key: 'pro',
              title: 'PRO',
              icon: Gem,
              accent: 'rgba(255,255,255,0.45)',
              stat: 'Vendas e indicadores',
              onClick: () => navigate('/manager/pro'),
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.key}
                type="button"
                onClick={item.onClick}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.04 }}
                className="group relative isolate overflow-hidden border border-white/[0.06] p-4 pl-[18px] text-left transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
                style={{ borderRadius: 'var(--radius-card)', background: 'var(--color-panel-elevated)', boxShadow: 'var(--shadow-card)' }}
              >
                <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ background: item.accent }} />
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-5 w-5 text-neon-yellow" strokeWidth={2.2} aria-hidden />
                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 font-display text-[10px] font-black text-white">
                        {item.badge}
                      </span>
                    )}
                    {item.tag && (
                      <span className="rounded-[var(--radius-pill)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/15 px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-[var(--color-success)]">
                        {item.tag}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-white/30 transition-colors group-hover:text-neon-yellow" />
                  </div>
                </div>
                <h3 className="mt-3 font-display text-[18px] font-black uppercase leading-none tracking-tight text-white transition-colors group-hover:text-neon-yellow">
                  {item.title}
                </h3>
                <p className="mt-1.5 truncate text-[11px] leading-snug text-white/50">{item.stat}</p>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* ── TROFÉUS ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="ole-eyebrow-poster !text-neon-yellow" style={{ fontFamily: 'var(--font-ui)' }}>
            <span>Troféus</span>
          </div>
          <Trophy className="h-3.5 w-3.5 text-neon-yellow/70" aria-hidden />
        </div>

        {/* Memoráveis */}
        <TrophyGroup
          title="Memoráveis"
          count={memorableTrophyUnlockedIds.length}
          total={MEMORABLE_TROPHY_SLOTS.length}
          defaultOpen
        >
          <p className="text-[11px] text-white/50 mb-4">
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
                        ? 'bg-gradient-to-br from-neon-yellow via-neon-yellow to-neon-yellow text-black shadow-[0_0_20px_rgba(250,204,21,0.5)]'
                        : 'bg-white/5 text-white/30',
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
                    earned ? 'text-neon-yellow' : 'text-white/45',
                  )}>
                    {slot.name}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </TrophyGroup>

        {/* Coroas do Dia (Liga Global · mata-mata diário) */}
        <TrophyGroup
          title="Coroas do Dia"
          icon={<Crown className="h-3.5 w-3.5 text-neon-yellow" />}
          count={dailyCrowns.length}
          defaultOpen={dailyCrowns.length > 0}
        >
          <p className="text-[11px] text-white/50 mb-4">
            Cada vitória no <span className="text-white/90 font-bold">mata-mata diário</span> da Liga Global vira uma Coroa eterna.
          </p>
          {dailyCrowns.length === 0 ? (
            <div className="bg-black/30 border border-white/5 rounded-sm py-6 px-4 text-center">
              <Lock className="h-5 w-5 text-white/30 mx-auto mb-2" />
              <p className="text-[11px] text-white/45 uppercase tracking-wider font-display">
                Nenhuma coroa ainda
              </p>
              <p className="text-[10px] text-white/30 mt-1">
                Vença o mata-mata das 19h pra ganhar a sua primeira.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {dailyCrowns.map((c, i) => {
                const [y, m, d] = c.dailyDate.split('-');
                const displayDate = `${d}/${m}/${y.slice(2)}`;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.32 + Math.min(i * 0.04, 0.4) }}
                    className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-sm border-2 bg-neon-yellow/5 border-neon-yellow/40 hover:border-neon-yellow/60 hover:shadow-[0_0_20px_rgba(253,225,0,0.18)] transition-all"
                  >
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-sm bg-gradient-to-br from-neon-yellow via-neon-yellow to-neon-yellow text-black shadow-[0_0_20px_rgba(250,204,21,0.5)]">
                      <Crown className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
                    </div>
                    <div className="text-center">
                      <p className="font-display text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neon-yellow leading-none">
                        Campeão
                      </p>
                      <p className="font-mono text-[10px] sm:text-[11px] text-white/90 mt-1">
                        {displayDate}
                      </p>
                      <p className="font-mono text-[8px] text-white/40 mt-0.5">
                        bracket {c.bracketSize}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TrophyGroup>

        {/* Competição */}
        <TrophyGroup
          title="Competição"
          accentClass="border-l-neon-yellow"
          countClass="text-neon-yellow"
          count={competitionTrophies.filter((t) => t.earned).length}
          total={competitionTrophies.length}
        >
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
                    ? 'bg-neon-yellow/5 border-neon-yellow/30 hover:border-neon-yellow/50'
                    : 'bg-black/40 border-white/10 opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-sm',
                    t.earned
                      ? 'bg-gradient-to-br from-neon-yellow via-neon-yellow to-neon-yellow text-black'
                      : 'bg-white/5 text-white/30',
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
                  t.earned ? 'text-neon-yellow' : 'text-white/45',
                )}>
                  {t.name}
                </p>
              </motion.div>
            ))}
          </div>
        </TrophyGroup>

        {/* Missões */}
        <TrophyGroup
          title="Missões"
          accentClass="border-l-neon-yellow"
          countClass="text-neon-yellow"
          count={missionTrophies.filter((t) => t.earned).length}
          total={missionTrophies.length}
        >
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
                    ? 'bg-neon-yellow/5 border-neon-yellow/30 hover:border-neon-yellow/50'
                    : 'bg-black/40 border-white/10 opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-sm',
                    t.earned
                      ? 'bg-gradient-to-br from-[var(--color-success)] via-[var(--color-success)] to-[var(--color-success)] text-black'
                      : 'bg-white/5 text-white/30',
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
                  t.earned ? 'text-neon-yellow' : 'text-white/45',
                )}>
                  {t.trophy.name}
                </p>
              </motion.div>
            ))}
          </div>
        </TrophyGroup>
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

/** Grupo de troféus colapsável — mostra a contagem no relance, abre a galeria sob demanda. */
function TrophyGroup({
  title,
  icon,
  count,
  total,
  accentClass = 'border-l-neon-yellow',
  countClass = 'text-neon-yellow',
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count: number;
  total?: number;
  accentClass?: string;
  countClass?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('overflow-hidden rounded-sm border border-white/10 border-l-4 bg-panel', accentClass)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
      >
        <h3 className="flex items-center gap-2 font-display text-xs font-black uppercase tracking-wider text-white">
          {icon}
          {title}
        </h3>
        <div className="flex items-center gap-2.5">
          <span className={cn('font-mono text-[10px]', countClass)}>
            {total != null ? `${count} de ${total}` : count > 0 ? `${count}` : '—'}
          </span>
          <ChevronRight className={cn('h-4 w-4 text-white/40 transition-transform', open && 'rotate-90')} strokeWidth={2.5} aria-hidden />
        </div>
      </button>
      {open && <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>}
    </div>
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
            className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
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
  const club = useGameStore((s) => s.club);
  const social = useFriendships();
  return (
    <DrawerShell title="Network" onClose={onClose} accent="bg-neon-yellow">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] text-white/60">Teu clube: <span className="font-bold text-white">{club.name}</span></p>
          <p className="text-[10px] text-white/40">Quem entra pelo seu link de indicação já vira amigo.</p>
        </div>

        {social.data.incoming.length > 0 ? (
          <section>
            <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-neon-yellow/85">
              Solicitações
            </h4>
            <ul className="space-y-2">
              {social.data.incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-neon-yellow/25 bg-black/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-white">{req.clubName}</p>
                    <p className="text-[10px] text-white/45">Quer entrar na sua rede</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => void social.accept(req.id)}
                      className="rounded bg-neon-green px-2 py-1 font-display text-[10px] font-black uppercase tracking-wider text-black hover:bg-white"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => void social.decline(req.id)}
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
            Amigos ({social.data.friends.length})
          </h4>
          {social.data.friends.length === 0 ? (
            <p className="rounded border border-dashed border-white/10 bg-black/20 px-3 py-3 text-sm text-white/45">
              Nenhum amigo ainda. Quem entrar pelo seu link de indicação vira amigo automaticamente.
            </p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {social.data.friends.map((f) => (
                <li
                  key={f.managerId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                >
                  <span className="truncate font-display text-sm font-bold text-white">{f.clubName}</span>
                  <button
                    type="button"
                    onClick={() => void social.remove(f.id)}
                    className="shrink-0 text-[10px] font-bold uppercase text-white/45 hover:text-[var(--color-danger)]"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {social.data.outgoing.length > 0 ? (
          <section>
            <h4 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">
              Convites enviados
            </h4>
            <ul className="space-y-1.5">
              {social.data.outgoing.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <span className="truncate font-display text-sm font-bold text-gray-300">{o.clubName}</span>
                  <button
                    type="button"
                    onClick={() => void social.remove(o.id)}
                    className="shrink-0 text-[10px] font-bold uppercase text-white/45 hover:text-white"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-[10px] text-white/30">
          O teu link de indicação e o placar da rede ficam na Home.
        </p>
      </div>

    </DrawerShell>
  );
}


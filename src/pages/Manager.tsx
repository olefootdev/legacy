import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Lock,
  TrendingUp,
  Network,
  ChevronRight,
  Flag,
  Target,
  CircleDot,
  Zap,
  Medal,
  Globe2,
  Gem,
  Crown,
  X,
  CheckCircle,
  Sparkles,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { useProgressionStore } from '@/progression/progressionStore';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { COMPETITION_TROPHY_CATALOG } from '@/trophies/competitionCatalog';
import { MEMORABLE_TROPHY_SLOTS } from '@/trophies/memorableCatalog';
import { useManagerCrowns } from '@/hooks/useManagerCrowns';
import { CAREER_TIERS, computeCareerTier, nextCareerTier, tierProgress01 } from '@/systems/careerTiers';
import { CareerTierBadge } from '@/components/CareerTierBadge';
import { useFriendships } from '@/social/useFriendships';
import { Hashtag, SecaoVolt, UmaLinha } from '@/components/ui';

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * Manager — VOLT2 (2026-09-19).
 *
 * Mesma gramática da Home: quem é o manager (foto + nome em Anton), o degrau
 * da carreira com a barra até o próximo, três números que NÃO são saldo
 * (saldo mora só na Carteira), UMA mesa de decisão com a consequência dentro
 * do botão, a central em 2×2 e os troféus. Nome, foto e atalhos já eram
 * calculados aqui e não apareciam — agora aparecem.
 */
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
  const [avatarOk, setAvatarOk] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    ensureResets();
  }, [ensureResets]);

  const expLifetime = finance.expLifetimeEarned ?? 0;
  const currentTier = useMemo(() => computeCareerTier(expLifetime), [expLifetime]);
  const nextTier = useMemo(() => nextCareerTier(currentTier.id), [currentTier.id]);
  const tierFrac = useMemo(() => tierProgress01(expLifetime), [expLifetime]);
  const missingToNext = nextTier ? Math.max(0, nextTier.minExp - expLifetime) : 0;
  const TierIcon = TIER_ICONS[currentTier.id] ?? Medal;

  const managerName = useMemo(() => {
    const mp = userSettings.managerProfile;
    if (!mp) return 'Manager';
    const n = `${mp.firstName ?? ''} ${mp.lastName ?? ''}`.trim();
    return n || 'Manager';
  }, [userSettings.managerProfile]);

  const avatarSrc = userSettings.trainerAvatarDataUrl;

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
  const trophiesEarned =
    memorableTrophyUnlockedIds.length +
    dailyCrowns.length +
    competitionTrophies.filter((t) => t.earned).length +
    missionTrophies.filter((t) => t.earned).length;

  /** Mesa do manager: só o que pede ação agora, com a consequência no botão. */
  const mesa = useMemo(() => {
    const out: Array<{
      key: string;
      text: string;
      tag: string;
      cta: string;
      primary: boolean;
      onClick: () => void;
    }> = [];
    if (missionsReady.count > 0) {
      out.push({
        key: 'missions',
        text: `${missionsReady.count} miss${missionsReady.count > 1 ? 'ões' : 'ão'}`,
        tag: '#prontas',
        cta: `Resgatar +${formatExp(missionsReady.expTotal)} EXP`,
        primary: true,
        onClick: () => navigate('/manager/missoes'),
      });
    }
    if (social.incoming.length > 0) {
      out.push({
        key: 'requests',
        text: `${social.incoming.length} solicitaç${social.incoming.length > 1 ? 'ões' : 'ão'}`,
        tag: '#network',
        cta: 'Responder',
        primary: false,
        onClick: () => setDrawer('network'),
      });
    }
    if (nextTier && tierFrac >= 0.85) {
      out.push({
        key: 'nextTier',
        text: `Perto de ${nextTier.name}`,
        tag: `#carreira · faltam ${formatExp(missingToNext)} EXP`,
        cta: 'Ver plano',
        primary: false,
        onClick: () => setDrawer('career'),
      });
    }
    return out;
  }, [missionsReady, social.incoming.length, nextTier, tierFrac, missingToNext, navigate]);

  const tilePanel =
    'relative flex min-w-0 flex-col justify-between border border-white/10 bg-panel p-4 text-left text-white transition-colors hover:border-white/30';
  const tileTitle = 'block min-w-0 truncate font-impact text-[clamp(20px,6.6vw,26px)] uppercase leading-[1.25]';

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-7 overflow-x-hidden px-3 pb-6 sm:px-4">
      {/* ── 1. QUEM É O MANAGER ─────────────────────────────────────────── */}
      <section aria-label="Perfil do manager" className="flex flex-col gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden border border-white/16 bg-card">
            {avatarSrc && avatarOk ? (
              <img
                src={avatarSrc}
                alt=""
                onError={() => setAvatarOk(false)}
                className="absolute inset-0 object-cover"
                // Inline: `img { height: auto }` fora de camada vence o h-full do Tailwind.
                style={{ width: '100%', height: '100%', maxWidth: 'none' }}
              />
            ) : (
              <span className="font-impact text-[30px] leading-none text-neon-yellow">{initialsOf(managerName)}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Hashtag>#manager</Hashtag>
            <h1 className="block min-w-0 truncate font-impact uppercase leading-[1.2] text-white" style={{ fontSize: 'clamp(30px, 9vw, 52px)' }}>
              {managerName}
            </h1>
            <UmaLinha className="text-[13px] text-cimento">
              {[club.name, club.city].filter(Boolean).join(' · ')}
            </UmaLinha>
          </div>
        </div>

        {/* O degrau da carreira — toca e abre o plano */}
        <button
          type="button"
          onClick={() => setDrawer('career')}
          className="block w-full border border-white/10 bg-panel p-4 text-left transition-colors hover:border-white/30"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-neon-yellow text-black">
                <TierIcon className="h-6 w-6" strokeWidth={2.4} aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[10.5px] font-medium tracking-[0.2em] text-cimento">CARREIRA</span>
                <UmaLinha className="font-impact text-[26px] uppercase leading-[1.25] text-white">{currentTier.name}</UmaLinha>
              </div>
            </div>
            <span className="ole-num flex shrink-0 items-center gap-1 text-[12px] uppercase text-neon-yellow">
              Plano
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2.6} />
            </span>
          </div>
          {nextTier ? (
            <div className="mt-3.5 flex flex-col gap-2">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <UmaLinha className="text-[13.5px] font-semibold text-white">
                  −{formatExp(missingToNext)} EXP pro {nextTier.name}
                </UmaLinha>
                <span className="shrink-0 font-mono text-[11px] text-cimento">{Math.round(tierFrac * 100)}%</span>
              </div>
              <div className="h-1.5 bg-card-hi" aria-hidden>
                <span className="block h-1.5 bg-neon-yellow" style={{ width: `${Math.max(2, Math.min(100, tierFrac * 100))}%` }} />
              </div>
            </div>
          ) : (
            <UmaLinha className="mt-3.5 text-[13.5px] font-semibold text-alta">Topo da carreira</UmaLinha>
          )}
        </button>

        {/* Três números — nenhum é saldo (saldo é da Carteira) */}
        <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-panel">
          {[
            { label: 'ELENCO', value: squadSize },
            { label: 'TROFÉUS', value: trophiesEarned },
            { label: social.friends.length === 1 ? 'AMIGO' : 'AMIGOS', value: social.friends.length },
          ].map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col items-center gap-1.5 px-2 py-3.5">
              <span className="ole-num block leading-none text-white" style={{ fontSize: 'clamp(22px, 6.4vw, 30px)' }}>
                {s.value}
              </span>
              <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-cimento">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. MESA DO MANAGER — só aparece quando há o que fazer ───────── */}
      {mesa.length > 0 && (
        <section aria-label="Mesa do manager" className="flex flex-col gap-3">
          <SecaoVolt label="Mesa do manager" />
          <ul className="border border-white/10 bg-panel">
            {mesa.map((m) => (
              // Sem espaço (320px), o botão desce pra baixo do texto em vez de espremê-lo.
              <li key={m.key} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
                <div className="flex min-w-[7.5rem] grow basis-0 flex-col gap-0.5">
                  <UmaLinha className="text-[15px] font-bold text-white">{m.text}</UmaLinha>
                  <Hashtag>{m.tag}</Hashtag>
                </div>
                <button
                  type="button"
                  onClick={m.onClick}
                  className={cn(
                    'ole-num inline-flex h-10 shrink-0 items-center whitespace-nowrap px-3 text-[12px] uppercase transition-colors',
                    m.primary
                      ? 'bg-neon-yellow text-black hover:bg-white [--corte:10px] [clip-path:var(--clip-corte)]'
                      : 'border border-white/30 text-white hover:border-white',
                  )}
                >
                  {m.cta}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 3. SUA CENTRAL — mosaico 2×2 ─────────────────────────────────── */}
      <section aria-label="Sua central" className="flex flex-col gap-3">
        <SecaoVolt label="Sua central" />
        <div className="grid auto-rows-[152px] grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => setDrawer('career')}
            className="flex min-w-0 flex-col justify-between bg-neon-yellow p-4 text-left text-black transition-colors hover:bg-white"
          >
            <TrendingUp aria-hidden className="h-[28px] w-[28px]" strokeWidth={2.2} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>Carreira</span>
              <span className="block min-w-0 truncate font-mono text-[11.5px] font-semibold text-[#1A1700]">
                #{currentTier.name.toLowerCase().replace(/\s+/g, '')}
              </span>
            </span>
          </button>

          <button type="button" onClick={() => navigate('/manager/network')} className={tilePanel}>
            <span className="flex items-start justify-between gap-2">
              <Network aria-hidden className="h-[28px] w-[28px] text-neon-yellow" strokeWidth={2.2} />
              {social.incoming.length > 0 && (
                <span className="ole-num flex h-6 min-w-6 items-center justify-center bg-neon-yellow px-1.5 text-[12px] text-black">
                  {social.incoming.length}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>Network</span>
              <Hashtag>{`${social.friends.length} amigo${social.friends.length !== 1 ? 's' : ''}`}</Hashtag>
            </span>
          </button>

          <button type="button" onClick={() => navigate('/manager/scouts')} className={tilePanel}>
            <Brain aria-hidden className="h-[28px] w-[28px] text-neon-yellow" strokeWidth={2.2} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>Scouts</span>
              <Hashtag>#relatório</Hashtag>
            </span>
          </button>

          <button type="button" onClick={() => navigate('/manager/pro')} className={tilePanel}>
            <Gem aria-hidden className="h-[28px] w-[28px] text-neon-yellow" strokeWidth={2.2} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>PRO</span>
              <Hashtag>#vendas</Hashtag>
            </span>
          </button>
        </div>
      </section>

      {/* ── 4. TROFÉUS ─────────────────────────────────────────────────── */}
      <section aria-label="Troféus" className="flex flex-col gap-3">
        <SecaoVolt label="Troféus">
          <Hashtag>{`${trophiesEarned} conquistado${trophiesEarned !== 1 ? 's' : ''}`}</Hashtag>
        </SecaoVolt>

        <TrophyGroup
          title="Memoráveis"
          count={memorableTrophyUnlockedIds.length}
          total={MEMORABLE_TROPHY_SLOTS.length}
          defaultOpen
        >
          <Hashtag className="mb-3">#liga #copa #supercopa</Hashtag>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {MEMORABLE_TROPHY_SLOTS.map((slot) => (
              <TrophySlot key={slot.id} name={slot.name} earned={memorableTrophyUnlockedIds.includes(slot.id)} />
            ))}
          </div>
        </TrophyGroup>

        <TrophyGroup
          title="Coroas do Dia"
          count={dailyCrowns.length}
          defaultOpen={dailyCrowns.length > 0}
        >
          <Hashtag className="mb-3">#ligaglobal #matamata</Hashtag>
          {dailyCrowns.length === 0 ? (
            <div className="flex min-w-0 items-center gap-3 border border-dashed border-white/10 px-4 py-4">
              <Lock aria-hidden className="h-5 w-5 shrink-0 text-poeira" />
              <UmaLinha className="text-[13px] text-cimento">Vença o mata-mata das 19h</UmaLinha>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {dailyCrowns.map((c) => {
                const [y, m, d] = c.dailyDate.split('-');
                return (
                  <div key={c.id} className="flex min-w-0 items-center gap-3 border border-neon-yellow/40 bg-card p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-neon-yellow text-black">
                      <Crown aria-hidden className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="ole-num text-[14px] leading-none text-white">{`${d}/${m}/${y.slice(2)}`}</span>
                      <span className="block truncate font-mono text-[10.5px] text-cimento">#chave{c.bracketSize}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TrophyGroup>

        <TrophyGroup
          title="Competição"
          count={competitionTrophies.filter((t) => t.earned).length}
          total={competitionTrophies.length}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {competitionTrophies.map((t) => (
              <TrophySlot key={t.id} name={t.name} earned={t.earned} />
            ))}
          </div>
        </TrophyGroup>

        <TrophyGroup
          title="Missões"
          count={missionTrophies.filter((t) => t.earned).length}
          total={missionTrophies.length}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {missionTrophies.map((t) => (
              <TrophySlot key={t.def.id} name={t.trophy.name} earned={t.earned} />
            ))}
          </div>
        </TrophyGroup>
      </section>

      {/* ── GAVETAS ────────────────────────────────────────────────────── */}
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

/** Um troféu da galeria: conquistado = placa volt; bloqueado = cadeado apagado. */
function TrophySlot({ name, earned }: { name: string; earned: boolean }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 border p-3',
        earned ? 'border-neon-yellow/40 bg-card' : 'border-white/10 bg-panel opacity-55',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center',
          earned ? 'bg-neon-yellow text-black' : 'bg-white/5 text-poeira',
        )}
      >
        {earned ? <Trophy aria-hidden className="h-5 w-5" strokeWidth={2.4} /> : <Lock aria-hidden className="h-4 w-4" />}
      </span>
      <span
        title={name}
        // Nome de troféu é conteúdo, não rótulo: até 2 linhas pra não virar "Campeão da…".
        className={cn(
          'line-clamp-2 block w-full min-w-0 text-center text-[11px] font-semibold leading-[1.25]',
          earned ? 'text-neon-yellow' : 'text-cimento',
        )}
      >
        {name}
      </span>
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
  accentClass = '',
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
    <div className={cn('overflow-hidden border border-white/10 bg-panel', accentClass)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
      >
        {/* leading 1.3: com truncate, leading curto corta o til (MISSÕES). */}
        <h3 className="flex min-w-0 items-center gap-2 font-impact text-[18px] uppercase leading-[1.3] text-white">
          {icon}
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={cn('ole-num text-[13px]', count > 0 ? countClass : 'text-cimento')}>
            {total != null ? `${count}/${total}` : count > 0 ? `${count}` : '—'}
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
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex max-h-[min(90dvh,calc(100dvh-3rem))] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-panel"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-nav px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={cn('h-0.5 w-[18px] shrink-0', accent)} aria-hidden />
            <h3 className="truncate font-impact text-[17px] uppercase leading-[1.1] text-white md:text-lg">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-cimento transition-colors hover:bg-white/10 hover:text-white"
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
        <div className="border border-white/10 bg-card p-4">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cimento">EXP acumulado</p>
          <p className="ole-num mt-1 truncate leading-none text-white" style={{ fontSize: 'clamp(22px, 7vw, 30px)' }}>{formatExp(expLifetime)}</p>
          <div className="mt-3">
            <CareerTierBadge expLifetimeEarned={expLifetime} showProgress />
          </div>
        </div>

        <div>
          <SecaoVolt label="Tiers" tone="neutro" className="mb-4" />
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
                    'flex items-center gap-4 border-2 p-4',
                    'transition-colors',
                    isCurrent && 'border-neon-yellow bg-card',
                    reached && !isCurrent && 'border-white/16 bg-panel',
                    !reached && 'border-white/10 bg-black/30 opacity-60',
                  )}
                >
                  {/* Ícone — chapado, sem brilho */}
                  <div
                    className={cn(
                      'relative z-10 flex shrink-0 items-center justify-center rounded-full',
                      'border-2',
                      isCurrent && 'h-16 w-16 border-neon-yellow bg-neon-yellow',
                      reached && !isCurrent && 'h-14 w-14 border-white/30 bg-card-hi',
                      !reached && 'h-12 w-12 border-white/20 bg-white/[0.03]',
                    )}
                  >
                    <Icon
                      className={cn(
                        isCurrent && 'h-8 w-8 text-black',
                        reached && !isCurrent && 'h-7 w-7 text-white',
                        !reached && 'h-6 w-6 text-white/40',
                      )}
                      strokeWidth={isCurrent ? 2.5 : 2.2}
                      aria-hidden
                    />

                  </div>

                  {/* Conteúdo */}
                  <div className="relative z-10 min-w-0 flex-1">
                    <p
                      className={cn(
                        'font-impact uppercase leading-[1.1]',
                        isCurrent && 'text-lg text-white',
                        !isCurrent && 'text-base text-white',
                      )}
                    >
                      {t.name}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center bg-neon-yellow px-2 py-0.5 align-middle font-mono text-[9.5px] font-medium text-black">
                          AGORA
                        </span>
                      )}
                    </p>
                    <p className={cn(
                      'mt-1 text-[11px]',
                      isCurrent ? 'text-giz' : 'text-cimento',
                    )}>
                      {t.minExp === 0 ? 'Nível inicial' : `A partir de ${formatExp(t.minExp)} EXP`}
                    </p>
                  </div>

                  {/* Check icon */}
                  {reached && (
                    <CheckCircle
                      className={cn(
                        'relative z-10 h-5 w-5 shrink-0',
                        isCurrent ? 'text-neon-yellow' : 'text-alta',
                      )}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="border border-white/10 bg-card p-3 text-xs text-giz">
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cimento">
            <Sparkles className="h-3.5 w-3.5 text-cimento" /> Como ganho EXP?
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Complete missões diárias, semanais e especiais</li>
            <li>Vença partidas oficiais da liga</li>
            <li>Evolua estruturas do clube e treine o plantel</li>
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
          <Hashtag>{`#network · ${club.name}`}</Hashtag>
        </div>

        {social.data.incoming.length > 0 ? (
          <section>
            <SecaoVolt label="Solicitações" className="mb-2" />
            <ul className="space-y-2">
              {social.data.incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-2 border border-white/16 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-white">{req.clubName}</p>
                    <Hashtag>#solicitação</Hashtag>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => void social.accept(req.id)}
                      className="ole-num bg-neon-yellow px-2.5 py-1.5 text-[11px] uppercase text-black hover:bg-white"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => void social.decline(req.id)}
                      className="ole-num border border-white/30 px-2.5 py-1.5 text-[11px] uppercase text-white hover:border-white"
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
          <SecaoVolt label={`Amigos · ${social.data.friends.length}`} tone="neutro" className="mb-2" />
          {social.data.friends.length === 0 ? (
            <p className="border border-dashed border-white/10 px-3 py-3 text-[13px] text-cimento">
              Quem entra pelo seu link vira amigo.
            </p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {social.data.friends.map((f) => (
                <li
                  key={f.managerId}
                  className="flex min-w-0 items-center justify-between gap-2 border border-white/10 bg-card px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-[14px] font-semibold text-white">{f.clubName}</span>
                  <button
                    type="button"
                    onClick={() => void social.remove(f.id)}
                    className="ole-num shrink-0 text-[11px] uppercase text-cimento hover:text-baixa"
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
            <SecaoVolt label="Convites enviados" tone="neutro" className="mb-2" />
            <ul className="space-y-1.5">
              {social.data.outgoing.map((o) => (
                <li key={o.id} className="flex min-w-0 items-center justify-between gap-2 border border-white/10 bg-panel px-3 py-2.5">
                  <span className="min-w-0 truncate text-[14px] font-semibold text-giz">{o.clubName}</span>
                  <button
                    type="button"
                    onClick={() => void social.remove(o.id)}
                    className="ole-num shrink-0 text-[11px] uppercase text-cimento hover:text-white"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Hashtag className="text-poeira">Seu link de convite fica na Home</Hashtag>
      </div>

    </DrawerShell>
  );
}


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
import { L } from '@/i18n/L';
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
import { BarraSegmentos, BotaoRua, Hashtag, MarcaRua, SecaoRua, UmaLinha } from '@/components/ui';

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
        text: L(
          `${missionsReady.count} miss${missionsReady.count > 1 ? 'ões' : 'ão'}`,
          `${missionsReady.count} mission${missionsReady.count > 1 ? 's' : ''}`,
        ),
        tag: L('#prontas', '#ready'),
        cta: L(`Resgatar +${formatExp(missionsReady.expTotal)} EXP`, `Claim +${formatExp(missionsReady.expTotal)} EXP`),
        primary: true,
        onClick: () => navigate('/manager/missoes'),
      });
    }
    if (social.incoming.length > 0) {
      out.push({
        key: 'requests',
        text: L(
          `${social.incoming.length} solicitaç${social.incoming.length > 1 ? 'ões' : 'ão'}`,
          `${social.incoming.length} request${social.incoming.length > 1 ? 's' : ''}`,
        ),
        tag: '#network',
        cta: L('Responder', 'Respond'),
        primary: false,
        onClick: () => setDrawer('network'),
      });
    }
    if (nextTier && tierFrac >= 0.85) {
      out.push({
        key: 'nextTier',
        text: L(`Perto de ${nextTier.name}`, `Close to ${nextTier.name}`),
        tag: L(`#carreira · faltam ${formatExp(missingToNext)} EXP`, `#career · ${formatExp(missingToNext)} EXP to go`),
        cta: L('Ver plano', 'View plan'),
        primary: false,
        onClick: () => setDrawer('career'),
      });
    }
    return out;
  }, [missionsReady, social.incoming.length, nextTier, tierFrac, missingToNext, navigate]);

  const tilePanel =
    'relative flex min-w-0 flex-col justify-between border-2 border-linha bg-concreto p-4 text-left text-papel transition-colors hover:border-papel';
  const tileTitle = 'block min-w-0 truncate font-impact text-[clamp(22px,6.8vw,28px)] uppercase leading-[1.2]';
  const temFoto = Boolean(avatarSrc && avatarOk);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 overflow-x-hidden px-3 pb-6 sm:px-4">
      {/* ── 1. CARTEIRINHA DE SÓCIO — quem é o manager (DS 2027, peça 3d) ── */}
      <section aria-label={L('Perfil do manager', 'Manager profile')} className="flex flex-col gap-4">
        <div className="flex min-h-[230px] min-w-0 overflow-hidden rounded-[18px]">
          <div className="rua-grao flex min-w-0 grow flex-col justify-between gap-4 bg-concreto p-4 sm:p-6">
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[16px] self-start bg-papel sm:h-[20px]" />

            <div className="flex min-w-0 items-start gap-3.5">
              {/* Foto 3×4 — sem foto, o quadro tracejado com as iniciais (degrau CHÃO). */}
              <div
                className={cn(
                  'relative flex aspect-[3/4] w-[68px] shrink-0 items-center justify-center overflow-hidden sm:w-[88px]',
                  temFoto ? 'bg-asfalto-27' : 'border-2 border-dashed border-fio',
                )}
              >
                {temFoto ? (
                  <img
                    src={avatarSrc!}
                    alt=""
                    onError={() => setAvatarOk(false)}
                    className="absolute inset-0 object-cover"
                    // Inline: `img { height: auto }` fora de camada vence o h-full do Tailwind.
                    style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                  />
                ) : (
                  <span className="font-impact text-[26px] leading-none text-mudo">{initialsOf(managerName)}</span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-ouro-27">
                  {L('Manager', 'Manager')} · {currentTier.name}
                </span>
                <h1
                  className="block min-w-0 truncate font-voz leading-[0.95] text-papel"
                  style={{ fontSize: 'clamp(28px, 8.4vw, 44px)' }}
                >
                  {managerName}
                </h1>
                <UmaLinha className="font-prova text-[12px] uppercase tracking-[0.1em] text-suave">
                  {[club.name, club.city].filter(Boolean).join(' · ')}
                </UmaLinha>
              </div>
            </div>

            {/* EXP de carreira acumulado: número real, em spray. */}
            <div className="flex min-w-0 items-end justify-between gap-3">
              <span className="block min-w-0 truncate font-spray font-black leading-none text-rua" style={{ fontSize: 'clamp(30px, 9vw, 44px)' }}>
                {formatExp(expLifetime)}
                <span className="ml-1.5 font-prova text-[12px] font-bold tracking-[0.14em] text-mudo">EXP</span>
              </span>
            </div>
          </div>

          {/* Canhoto de ouro com o 9 de respeito. */}
          <div className="flex w-[26%] max-w-[140px] shrink-0 flex-col items-center justify-center gap-2 bg-ouro-27 px-2.5">
            <MarcaRua tipo="nove" className="w-full max-w-[96px] bg-asfalto-27" />
          </div>
        </div>

        {/* O degrau da carreira — toca e abre o plano */}
        <button
          type="button"
          onClick={() => setDrawer('career')}
          className="flex w-full flex-col gap-3.5 border-l-[5px] border-rua bg-concreto px-[18px] py-4 text-left transition-colors hover:bg-linha"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-rua text-asfalto-27">
                <TierIcon className="h-6 w-6" strokeWidth={2.4} aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Carreira', 'Career')}</span>
                <UmaLinha className="font-impact text-[26px] uppercase leading-[1.2] text-papel">{currentTier.name}</UmaLinha>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 font-impact text-[16px] uppercase text-rua">
              {L('Plano', 'Plan')}
              <span aria-hidden>→</span>
            </span>
          </div>
          {nextTier ? (
            <div className="flex flex-col gap-2">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <UmaLinha className="font-voz text-[21px] leading-none text-papel">
                  {L(`Faltam ${formatExp(missingToNext)} EXP pro ${nextTier.name}.`, `${formatExp(missingToNext)} EXP to ${nextTier.name}.`)}
                </UmaLinha>
                <span className="shrink-0 font-prova text-[12px] font-bold text-ouro-27">{Math.round(tierFrac * 100)}%</span>
              </div>
              <BarraSegmentos valor={tierFrac} max={1} />
            </div>
          ) : (
            <UmaLinha className="font-voz text-[22px] leading-none text-ouro-27">{L('Topo da carreira.', 'Top of the career.')}</UmaLinha>
          )}
        </button>

        {/* Três números — nenhum é saldo (saldo é da Carteira) */}
        <div className="grid grid-cols-3 divide-x-2 divide-linha border-y-2 border-linha">
          {[
            { key: 'squad', label: L('Elenco', 'Squad'), value: squadSize },
            { key: 'trophies', label: L('Troféus', 'Trophies'), value: trophiesEarned },
            { key: 'friends', label: social.friends.length === 1 ? L('Amigo', 'Friend') : L('Amigos', 'Friends'), value: social.friends.length },
          ].map((s) => (
            <div key={s.key} className="flex min-w-0 flex-col items-center gap-1.5 px-2 py-3.5">
              <span className="block font-spray font-black leading-none text-papel" style={{ fontSize: 'clamp(28px, 8vw, 38px)' }}>
                {s.value}
              </span>
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. MESA DO MANAGER — só aparece quando há o que fazer ───────── */}
      {mesa.length > 0 && (
        <section aria-label={L('Mesa do manager', 'Manager desk')} className="flex flex-col gap-3">
          <SecaoRua label={L('Mesa do manager', 'Manager desk')} aside={mesa.length} />
          <ul className="flex flex-col">
            {mesa.map((m) => (
              // Sem espaço (320px), o botão desce pra baixo do texto em vez de espremê-lo.
              <li key={m.key} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-linha py-3.5 last:border-b-0">
                <span
                  aria-hidden
                  className={cn('h-7 w-7 shrink-0', m.primary ? 'bg-rua' : 'border-2 border-rua')}
                />
                <div className="flex min-w-[7.5rem] grow basis-0 flex-col gap-1">
                  <UmaLinha className="font-voz text-[23px] leading-none text-papel">{m.text}</UmaLinha>
                  <UmaLinha className="font-prova text-[12px] text-mudo">{m.tag}</UmaLinha>
                </div>
                <button
                  type="button"
                  onClick={m.onClick}
                  className={cn(
                    'inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-3.5 font-impact text-[17px] uppercase leading-none transition-[transform,box-shadow,background-color,color]',
                    m.primary
                      ? 'bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)]'
                      : 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27',
                  )}
                >
                  {m.cta} <span aria-hidden className="ml-1.5">→</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 3. SUA CENTRAL — mosaico 2×2 ─────────────────────────────────── */}
      <section aria-label={L('Sua central', 'Your hub')} className="flex flex-col gap-3">
        <SecaoRua label={L('Sua central', 'Your hub')} />
        <div className="grid auto-rows-[152px] grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => setDrawer('career')}
            className="rua-alambrado flex min-w-0 flex-col justify-between bg-rua p-4 text-left text-asfalto-27 [--alambrado:rgba(13,13,12,.22)] transition-transform hover:-rotate-1"
          >
            <TrendingUp aria-hidden className="h-[28px] w-[28px]" strokeWidth={2.2} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>{L('Carreira', 'Career')}</span>
              <span className="block min-w-0 truncate font-prova text-[12px] font-bold">
                #{currentTier.name.toLowerCase().replace(/\s+/g, '')}
              </span>
            </span>
          </button>

          <button type="button" onClick={() => navigate('/manager/amigos')} className={tilePanel}>
            <span className="flex items-start justify-between gap-2">
              <Network aria-hidden className="h-[28px] w-[28px] text-mudo" strokeWidth={2.2} />
              {social.incoming.length > 0 && (
                <span className="flex h-7 min-w-7 items-center justify-center bg-rua px-1.5 font-impact text-[15px] text-asfalto-27">
                  {social.incoming.length}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>{L('Amigos', 'Friends')}</span>
              <span className="block min-w-0 truncate font-prova text-[12px] text-mudo">
                {L(`${social.friends.length} amigo${social.friends.length !== 1 ? 's' : ''}`, `${social.friends.length} friend${social.friends.length !== 1 ? 's' : ''}`)}
              </span>
            </span>
          </button>

          <button type="button" onClick={() => navigate('/manager/scouts')} className={tilePanel}>
            <Brain aria-hidden className="h-[28px] w-[28px] text-mudo" strokeWidth={2.2} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>Scouts</span>
              <span className="block min-w-0 truncate font-prova text-[12px] text-mudo">{L('#relatório', '#report')}</span>
            </span>
          </button>

          <button type="button" onClick={() => navigate('/manager/pro')} className={tilePanel}>
            <Gem aria-hidden className="h-[28px] w-[28px] text-ouro-27" strokeWidth={2.2} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={tileTitle}>PRO</span>
              <span className="block min-w-0 truncate font-prova text-[12px] text-mudo">{L('#vendas', '#sales')}</span>
            </span>
          </button>
        </div>
      </section>

      {/* ── 4. TROFÉUS ─────────────────────────────────────────────────── */}
      <section aria-label={L('Troféus', 'Trophies')} className="flex flex-col gap-3">
        <SecaoRua
          label={L('Troféus', 'Trophies')}
          aside={L(`${trophiesEarned} conquistado${trophiesEarned !== 1 ? 's' : ''}`, `${trophiesEarned} won`)}
        />

        <TrophyGroup
          title={L('Memoráveis', 'Memorable')}
          count={memorableTrophyUnlockedIds.length}
          total={MEMORABLE_TROPHY_SLOTS.length}
          defaultOpen
        >
          <Hashtag className="mb-3">{L('#liga #copa #supercopa', '#league #cup #supercup')}</Hashtag>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {MEMORABLE_TROPHY_SLOTS.map((slot) => (
              <TrophySlot key={slot.id} name={slot.name} earned={memorableTrophyUnlockedIds.includes(slot.id)} />
            ))}
          </div>
        </TrophyGroup>

        <TrophyGroup
          title={L('Coroas do Dia', 'Daily Crowns')}
          count={dailyCrowns.length}
          defaultOpen={dailyCrowns.length > 0}
        >
          <Hashtag className="mb-3">{L('#ligaglobal #matamata', '#globalleague #knockout')}</Hashtag>
          {dailyCrowns.length === 0 ? (
            // Vazio com saída: tracejado + frase na voz + o caminho.
            <div className="flex min-w-0 flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-4">
              <span className="font-voz text-[22px] leading-[1.05] text-papel">
                {L('Coroa se ganha no mata-mata das 19h.', 'Crowns are won in the 7pm knockout.')}
              </span>
              <BotaoRua variante="contorno" to="/liga-global/hoje" className="min-h-[44px] px-4 text-[17px]">
                {L('Ver a chave', 'See the bracket')} <span aria-hidden>→</span>
              </BotaoRua>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {dailyCrowns.map((c) => {
                const [y, m, d] = c.dailyDate.split('-');
                return (
                  <div key={c.id} className="flex min-w-0 items-center gap-3 border-[3px] border-ouro-27 bg-asfalto-27 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-ouro-27 text-asfalto-27">
                      <Crown aria-hidden className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-spray text-[18px] font-black leading-none text-papel">{L(`${d}/${m}/${y.slice(2)}`, `${m}/${d}/${y.slice(2)}`)}</span>
                      <span className="block truncate font-prova text-[11px] text-mudo">{L('#chave', '#bracket')}{c.bracketSize}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TrophyGroup>

        <TrophyGroup
          title={L('Competição', 'Competition')}
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
          title={L('Missões', 'Missions')}
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

/**
 * Um troféu da galeria na escada do DS: conquistado = RESPEITO (asfalto + fio
 * de ouro); bloqueado = CHÃO (tracejado, cadeado apagado).
 */
function TrophySlot({ name, earned }: { name: string; earned: boolean }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 p-3',
        earned ? 'border-[3px] border-ouro-27 bg-asfalto-27' : 'border-2 border-dashed border-linha',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center',
          earned ? 'bg-ouro-27 text-asfalto-27' : 'text-fio',
        )}
      >
        {earned ? <Trophy aria-hidden className="h-5 w-5" strokeWidth={2.4} /> : <Lock aria-hidden className="h-4 w-4" />}
      </span>
      <span
        title={name}
        // Nome de troféu é conteúdo, não rótulo: até 2 linhas pra não virar "Campeão da…".
        className={cn(
          'line-clamp-2 block w-full min-w-0 text-center text-[11.5px] font-semibold leading-[1.25]',
          earned ? 'text-papel' : 'text-mudo',
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
  countClass = 'text-ouro-27',
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
    <div className={cn('overflow-hidden bg-concreto', accentClass)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-linha sm:px-5"
      >
        {/* leading 1.3: com truncate, leading curto corta o til (MISSÕES). */}
        <h3 className="flex min-w-0 items-center gap-2 font-impact text-[20px] uppercase leading-[1.3] text-papel">
          {icon}
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={cn('font-spray text-[18px] font-black', count > 0 ? countClass : 'text-mudo')}>
            {total != null ? `${count}/${total}` : count > 0 ? `${count}` : '—'}
          </span>
          <ChevronRight className={cn('h-4 w-4 text-mudo transition-transform', open && 'rotate-90')} strokeWidth={2.5} aria-hidden />
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
  accent = 'bg-rua',
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
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-asfalto-27/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex max-h-[min(90dvh,calc(100dvh-3rem))] w-full max-w-lg flex-col overflow-hidden border-t-[5px] border-rua bg-concreto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-linha px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={cn('h-1 w-[18px] shrink-0', accent)} aria-hidden />
            <h3 className="truncate font-impact text-[24px] uppercase leading-[1.1] text-papel">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-mudo transition-colors hover:bg-linha hover:text-papel"
            aria-label={L('Fechar', 'Close')}
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
    <DrawerShell title={L('Plano de Carreira', 'Career Plan')} onClose={onClose}>
      <div className="space-y-4">
        <div className="border-[3px] border-ouro-27 bg-asfalto-27 p-4">
          <p className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('EXP acumulado', 'Lifetime EXP')}</p>
          <p className="mt-1 truncate font-spray font-black leading-none text-papel" style={{ fontSize: 'clamp(30px, 9vw, 40px)' }}>{formatExp(expLifetime)}</p>
          <div className="mt-3">
            <CareerTierBadge expLifetimeEarned={expLifetime} showProgress />
          </div>
        </div>

        <div>
          <SecaoRua label="Tiers" className="mb-3" />
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
                    'flex items-center gap-4 p-4',
                    'transition-colors',
                    isCurrent && 'border-2 border-rua bg-asfalto-27',
                    reached && !isCurrent && 'border-2 border-linha bg-asfalto-27',
                    !reached && 'border-2 border-dashed border-linha',
                  )}
                >
                  {/* Ícone — chapado, sem brilho */}
                  <div
                    className={cn(
                      'relative z-10 flex shrink-0 items-center justify-center rounded-full',
                      'border-2',
                      isCurrent && 'h-16 w-16 border-rua bg-rua',
                      reached && !isCurrent && 'h-14 w-14 border-linha bg-concreto',
                      !reached && 'h-12 w-12 border-dashed border-fio',
                    )}
                  >
                    <Icon
                      className={cn(
                        isCurrent && 'h-8 w-8 text-asfalto-27',
                        reached && !isCurrent && 'h-7 w-7 text-papel',
                        !reached && 'h-6 w-6 text-fio',
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
                        isCurrent && 'text-[22px] text-papel',
                        !isCurrent && 'text-[18px]',
                        !isCurrent && (reached ? 'text-papel' : 'text-mudo'),
                      )}
                    >
                      {t.name}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center bg-rua px-2 py-0.5 align-middle font-prova text-[10.5px] font-bold text-asfalto-27">
                          {L('AGORA', 'NOW')}
                        </span>
                      )}
                    </p>
                    <p className={cn(
                      'mt-1 font-prova text-[11.5px]',
                      isCurrent ? 'text-suave' : 'text-mudo',
                    )}>
                      {t.minExp === 0 ? L('Nível inicial', 'Starting level') : L(`A partir de ${formatExp(t.minExp)} EXP`, `From ${formatExp(t.minExp)} EXP`)}
                    </p>
                  </div>

                  {/* Check icon */}
                  {reached && (
                    <CheckCircle
                      className={cn(
                        'relative z-10 h-5 w-5 shrink-0',
                        isCurrent ? 'text-rua' : 'text-suave',
                      )}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="-rotate-1 bg-cal p-4 text-[13px] text-asfalto-27">
          <p className="flex items-center gap-1.5 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {L('Como ganho EXP?', 'How do I earn EXP?')}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{L('Complete missões diárias, semanais e especiais', 'Complete daily, weekly and special missions')}</li>
            <li>{L('Vença partidas oficiais da liga', 'Win official league matches')}</li>
            <li>{L('Evolua estruturas do clube e treine o plantel', 'Upgrade club facilities and train the squad')}</li>
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
    <DrawerShell title="Network" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <Hashtag>{`#network · ${club.name}`}</Hashtag>
        </div>

        {social.data.incoming.length > 0 ? (
          <section>
            <SecaoRua label={L('Solicitações', 'Requests')} className="mb-2" />
            <ul className="space-y-2">
              {social.data.incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-2 border-l-[5px] border-rua bg-asfalto-27 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-voz text-[21px] leading-none text-papel">{req.clubName}</p>
                    <Hashtag>{L('#solicitação', '#request')}</Hashtag>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => void social.accept(req.id)}
                      className="min-h-[40px] bg-rua px-3 font-impact text-[15px] uppercase text-asfalto-27 hover:bg-papel"
                    >
                      {L('Aceitar', 'Accept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void social.decline(req.id)}
                      className="min-h-[40px] border-2 border-papel px-3 font-impact text-[15px] uppercase text-papel hover:bg-papel hover:text-asfalto-27"
                    >
                      {L('Recusar', 'Decline')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <SecaoRua label={L('Amigos', 'Friends')} aside={social.data.friends.length} className="mb-2" />
          {social.data.friends.length === 0 ? (
            <p className="border-2 border-dashed border-fio px-4 py-4 font-voz text-[21px] leading-[1.1] text-papel">
              {L('Quem entra pelo seu link vira amigo.', 'Anyone who joins via your link becomes a friend.')}
            </p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {social.data.friends.map((f) => (
                <li
                  key={f.managerId}
                  className="flex min-w-0 items-center justify-between gap-2 border-b border-linha px-1 py-2.5"
                >
                  <span className="min-w-0 truncate font-voz text-[21px] leading-none text-papel">{f.clubName}</span>
                  <button
                    type="button"
                    onClick={() => void social.remove(f.id)}
                    className="min-h-[36px] shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo hover:text-baixa"
                  >
                    {L('Remover', 'Remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {social.data.outgoing.length > 0 ? (
          <section>
            <SecaoRua label={L('Convites enviados', 'Invites sent')} className="mb-2" />
            <ul className="space-y-1.5">
              {social.data.outgoing.map((o) => (
                <li key={o.id} className="flex min-w-0 items-center justify-between gap-2 border-2 border-dashed border-linha px-3 py-2.5">
                  <span className="min-w-0 truncate font-voz text-[20px] leading-none text-suave">{o.clubName}</span>
                  <button
                    type="button"
                    onClick={() => void social.remove(o.id)}
                    className="min-h-[36px] shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo hover:text-papel"
                  >
                    {L('Cancelar', 'Cancel')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Hashtag className="text-mudo">{L('Seu link de convite fica na Home', 'Your invite link is on the Home screen')}</Hashtag>
      </div>

    </DrawerShell>
  );
}


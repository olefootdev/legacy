import { motion, AnimatePresence } from 'motion/react';
import { Trophy, TrendingUp, Shield, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useMemo, useState } from 'react';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';
import type { AdminLeagueConfig, KnockoutRound, LeagueScope, LeagueStandingRow } from '@/match/adminLeagues';
import { BackButton } from '@/components/BackButton';
import {
  goalDiff,
  isLeagueVisibleInPlayerApp,
  LEAGUE_FORMAT_LABELS,
  LEAGUE_SCOPE_LABELS,
  positionOfClub,
  rowMatchingClub,
  sortStandings,
  standingsRowsForDisplay,
} from '@/match/adminLeagues';
import type { LeagueSeasonState } from '@/match/leagueSeason';

function formatDatePt(iso: string): string {
  if (!iso) return '—';
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  const [y, m, d] = p;
  return `${d}/${m}/${y}`;
}

function displayStandingsForLeague(
  league: AdminLeagueConfig,
  clubName: string,
  clubShort: string,
  leagueSeason: LeagueSeasonState,
  globalForm: import('@/entities/types').FormLetter[],
): {
  sorted: ReturnType<typeof sortStandings>;
  userPosition: number;
  userForm: import('@/entities/types').FormLetter[];
} {
  const sorted = standingsRowsForDisplay(league, clubName, clubShort, leagueSeason);
  const userPosition = positionOfClub(sorted, clubName, clubShort);
  const userForm = league.syncStatsFromSeason ? globalForm.slice(0, 5) : league.form;
  return { sorted, userPosition, userForm };
}

function KnockoutBracketSection({ rounds }: { rounds: KnockoutRound[] | undefined }) {
  if (!rounds?.length) {
    return (
      <p className="max-w-full break-words text-pretty text-sm leading-snug text-white/40">
        Chaves ainda não definidas. No painel <span className="text-neon-yellow">/admin</span>, escolhe o tamanho do
        bracket e usa <strong className="text-white/60">Sortear chaves</strong>.
      </p>
    );
  }
  return (
    <div className="ole-scroll-x flex w-full max-w-full min-w-0 gap-4 pb-2 md:gap-6">
      {rounds.map((round) => (
        <div key={round.name} className="min-w-[200px] shrink-0 space-y-2 md:min-w-[220px] md:space-y-2.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 md:text-xs">{round.name}</h4>
          {round.pairs.map((p, i) => (
            <div
              key={i}
              className="border border-white/10 bg-black/50 px-3 py-2 text-xs text-white/85 md:px-4 md:py-2.5 md:text-sm"
            >
              <div className="font-medium">{p.homeName}</div>
              <div className="py-0.5 text-center text-[10px] text-white/30">vs</div>
              <div className="font-medium">{p.awayName}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StandingsBlock({
  sorted,
  clubName,
  clubShort,
}: {
  sorted: ReturnType<typeof sortStandings>;
  clubName: string;
  clubShort: string;
}) {
  const supporterCrestUrl = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));

  return (
    <div className="ole-scroll-x w-full max-w-full min-w-0 rounded border border-white/10 overflow-hidden lg:rounded-lg">
      <table className="ole-table">
        <thead>
          <tr>
            <th style={{ width: '2.5rem' }} className="text-center px-1 sm:px-2">#</th>
            <th className="px-2 sm:px-3">Equipe</th>
            <th style={{ width: '2.5rem' }} className="text-center px-1 sm:px-2">J</th>
            <th style={{ width: '3rem' }} className="text-center px-1 sm:px-2">PTS</th>
            <th style={{ width: '3rem' }} className="text-center px-1 sm:px-2">SG</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const isOle =
              row.name === clubShort ||
              row.name === clubName ||
              row.name.toUpperCase().includes(clubShort.toUpperCase());
            const sg = goalDiff(row);
            const sgLabel = sg >= 0 ? `+${sg}` : String(sg);
            const rank = idx + 1;
            return (
              <tr key={row.teamId} data-is-user={isOle ? 'true' : undefined}>
                <td className="text-center px-1 sm:px-2">
                  <span className="ole-table__pos" data-rank={rank <= 3 ? rank : undefined}>
                    {rank <= 3 ? <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <span className="font-serif-hero text-xs sm:text-sm tabular-nums">{rank}</span>}
                  </span>
                </td>
                <td className="px-2 sm:px-3">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 md:gap-3">
                    {isOle && supporterCrestUrl ? (
                      <img
                        src={supporterCrestUrl}
                        alt=""
                        className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:h-6 sm:w-6 md:h-7 md:w-7"
                      />
                    ) : (
                      <Shield
                        className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 md:h-5 md:w-5', isOle ? 'text-neon-yellow' : 'text-gray-600')}
                      />
                    )}
                    <span
                      className={cn(
                        'min-w-0 truncate font-display text-xs font-bold tracking-wide sm:text-sm md:text-base',
                        isOle ? 'text-neon-yellow' : 'text-white',
                      )}
                    >
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="text-center px-1 sm:px-2">
                  <span
                    className={cn(
                      'font-serif-hero text-xs font-bold tabular-nums sm:text-sm md:text-base',
                      isOle ? 'text-neon-yellow' : 'text-white',
                    )}
                  >
                    {row.played}
                  </span>
                </td>
                <td className="text-center px-1 sm:px-2">
                  <span
                    className={cn(
                      'font-serif-hero text-xs font-bold tabular-nums sm:text-sm md:text-base',
                      isOle ? 'text-neon-yellow' : 'text-white',
                    )}
                  >
                    {row.points}
                  </span>
                </td>
                <td className="text-center px-1 sm:px-2">
                  <span className="font-serif-hero text-xs tabular-nums text-gray-500 sm:text-sm md:text-base">
                    {sgLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PLAYER_SCOPE_TABS: { id: Exclude<LeagueScope, 'world'>; label: string }[] = [
  { id: 'national', label: 'Nacionais' },
  { id: 'state', label: 'Estaduais' },
];

const TAB_META: Record<Exclude<LeagueScope, 'world'>, { num: string; eyebrow: string; subtitle: string; quote: string }> = {
  national: { num: '01', eyebrow: 'Competições · Nacional', subtitle: 'pelo país.', quote: '“pontos corridos, mata-mata e híbridos do território nacional.”' },
  state:    { num: '02', eyebrow: 'Competições · Estadual', subtitle: 'pelo estado.', quote: '“rivalidades regionais — onde tudo começa.”' },
};

/** Seed de uma liga exemplo (Brasileirão simulado) — 8 times, pontos corridos. */
function seedExampleLeague(): AdminLeagueConfig {
  const teams: { name: string; played: number; points: number; gf: number; ga: number }[] = [
    { name: 'Flamengo',       played: 4, points: 12, gf: 11, ga: 3 },
    { name: 'Palmeiras',      played: 4, points: 10, gf: 9,  ga: 4 },
    { name: 'Corinthians',    played: 4, points: 7,  gf: 6,  ga: 5 },
    { name: 'São Paulo',      played: 4, points: 6,  gf: 5,  ga: 5 },
    { name: 'Internacional',  played: 4, points: 6,  gf: 7,  ga: 7 },
    { name: 'Grêmio',         played: 4, points: 4,  gf: 5,  ga: 8 },
    { name: 'Atlético-MG',    played: 4, points: 3,  gf: 3,  ga: 7 },
    { name: 'Cruzeiro',       played: 4, points: 1,  gf: 2,  ga: 9 },
  ];
  const standings: LeagueStandingRow[] = teams.map((t, i) => ({
    teamId: `seed-${i}`,
    name: t.name,
    played: t.played,
    points: t.points,
    goalsFor: t.gf,
    goalsAgainst: t.ga,
  }));
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(today.getFullYear(), today.getMonth() + 6, 30).toISOString().slice(0, 10);
  return {
    id: `seed-brasileirao-${Date.now()}`,
    name: 'Brasileirão Olefoot',
    division: 'Série A',
    scope: 'national',
    syncStatsFromSeason: true,
    form: ['W', 'W', 'D', 'L', 'W'],
    standings,
    format: 'round_robin',
    startDate: start,
    endDate: end,
    prizeSummary: 'Champion: 200.000 EXP + troféu nacional',
  };
}

export function Leagues() {
  const club = useGameStore((s) => s.club);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const form = useGameStore((s) => s.form);
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const adminPrimaryLeagueId = useGameStore((s) => s.adminPrimaryLeagueId);
  const dispatch = useGameDispatch();

  const playerLeagues = useMemo(() => adminLeagues.filter(isLeagueVisibleInPlayerApp), [adminLeagues]);

  const [scopeTab, setScopeTab] = useState<Exclude<LeagueScope, 'world'>>('national');
  const tabMeta = TAB_META[scopeTab];

  const handleSeedExample = () => {
    const league = seedExampleLeague();
    dispatch({ type: 'ADMIN_UPSERT_LEAGUE', league });
  };

  const orderedLeagues = useMemo(() => {
    const inTab = playerLeagues.filter((l) => l.scope === scopeTab);
    const primary = inTab.find((l) => l.id === adminPrimaryLeagueId);
    const rest = inTab.filter((l) => l.id !== adminPrimaryLeagueId);
    return primary ? [primary, ...rest] : inTab;
  }, [playerLeagues, adminPrimaryLeagueId, scopeTab]);

  const isEmpty = adminLeagues.length === 0;
  const onlyWorld = !isEmpty && playerLeagues.length === 0;
  const noOnTab = !isEmpty && !onlyWorld && orderedLeagues.length === 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 sm:space-y-10 lg:max-w-5xl xl:max-w-6xl">
      {/* ── HERO BVB — amarelo + watermark + Agency caps + Moret italic ── */}
      <section
        aria-label="Ligas"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm"
      >
        {/* Watermark gigante do número da aba */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={tabMeta.num}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4 }}
              className="font-display font-black tabular-nums whitespace-nowrap text-black/[0.05]"
              style={{
                fontSize: 'clamp(180px, 32vw, 460px)',
                lineHeight: '0.85',
                letterSpacing: '-0.05em',
              }}
            >
              {tabMeta.num}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Composição editorial */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 text-center"
        >
          <div className="ole-eyebrow !text-black mb-5 sm:mb-6" style={{ fontFamily: 'var(--font-ui)' }}>
            <span className="!text-black">{tabMeta.eyebrow}</span>
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
              Ligas
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={tabMeta.subtitle}
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
                {tabMeta.subtitle}
              </motion.span>
            </AnimatePresence>
          </h1>
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={`q-${scopeTab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
              style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
            >
              {tabMeta.quote}
            </motion.blockquote>
          </AnimatePresence>
          <p
            className="mt-3 text-black/60 mx-auto max-w-md"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(0.85rem, 1vw, 0.95rem)', lineHeight: 1.55 }}
          >
            {playerLeagues.length} {playerLeagues.length === 1 ? 'competição visível' : 'competições visíveis'} no save
          </p>

          {/* Tabs + CTA "Criar liga exemplo" */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3">
            {PLAYER_SCOPE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setScopeTab(t.id)}
                className={cn(
                  'inline-flex items-center px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[12px] transition-all rounded-sm',
                  scopeTab === t.id
                    ? 'bg-black text-neon-yellow shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
                    : 'border border-black/65 bg-transparent text-black hover:bg-black/10',
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t.label}
              </button>
            ))}
            {isEmpty ? (
              <button
                type="button"
                onClick={handleSeedExample}
                className="inline-flex items-center gap-2 bg-black px-5 py-2.5 text-neon-yellow font-bold uppercase tracking-[0.2em] text-[12px] rounded-sm shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98] transition-all"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Plus className="w-4 h-4" />
                Criar liga exemplo
              </button>
            ) : null}
          </div>
        </motion.div>
      </section>

      <div className="px-3 sm:px-4 lg:px-8">
        <BackButton to="/competicao" label="Competição" />
      </div>

      {/* ── Estado vazio (sem ligas no save) ── */}
      {isEmpty ? (
        <section className="bg-panel border border-white/10 rounded-sm p-6 text-center">
          <p className="text-sm text-gray-400 leading-relaxed">
            Nenhuma competição configurada ainda. Clique em{' '}
            <span className="text-neon-yellow font-bold">Criar liga exemplo</span> acima pra ver o
            <strong className="text-white"> Brasileirão Olefoot</strong> em ação, ou crie suas próprias em{' '}
            <code className="text-neon-yellow">/admin</code>.
          </p>
        </section>
      ) : null}

      {/* ── Só ligas mundiais (não visíveis aqui) ── */}
      {onlyWorld ? (
        <section className="bg-panel border border-white/10 rounded-sm p-6 text-center">
          <p className="text-sm text-gray-400 leading-relaxed">
            Só existem competições <strong className="text-white/80">mundiais</strong> no save — em{' '}
            <code className="text-neon-yellow">/admin</code> cria também ligas estaduais ou nacionais para as veres aqui.
          </p>
        </section>
      ) : null}

      {/* ── Slider horizontal — destaque das ligas da aba ── */}
      {!isEmpty && !onlyWorld && orderedLeagues.length > 0 ? (
        <section className="space-y-4">
          <StoreSectionHeadline
            title="Em destaque"
            subtitle="Carrossel rápido — abre a competição no card."
            rightLabel={orderedLeagues.length > 3 ? `${orderedLeagues.length} ligas` : undefined}
          />
          <div className="hide-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1">
            {orderedLeagues.map((lg) => {
              const isPrimary = lg.id === adminPrimaryLeagueId;
              const champion = sortStandings(lg.standings)[0];
              return (
                <a
                  key={`slide-${lg.id}`}
                  href={`#league-${lg.id}`}
                  className={cn(
                    'shrink-0 snap-start w-[260px] sm:w-[300px] bg-card border border-white/8 rounded-sm border-l-4 p-4 transition-transform duration-150 hover:-translate-y-0.5',
                    isPrimary ? 'border-l-neon-yellow' : 'border-l-white/15',
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display font-bold uppercase tracking-[0.18em] text-[10px] text-neon-yellow">
                      {LEAGUE_SCOPE_LABELS[lg.scope]}
                    </span>
                    {isPrimary ? (
                      <span className="bg-neon-yellow text-black px-2 py-0.5 font-display font-black uppercase text-[8px] tracking-widest rounded-sm">
                        Principal
                      </span>
                    ) : null}
                  </div>
                  <h3 className="ole-headline text-white text-[20px] sm:text-[22px] leading-tight uppercase mb-1 truncate">
                    {lg.name}
                  </h3>
                  <p className="text-text-soft text-[11px] uppercase tracking-[0.15em] mb-4">
                    {LEAGUE_FORMAT_LABELS[lg.format]} · {lg.division}
                  </p>
                  {champion ? (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/8">
                      <Trophy className="w-3.5 h-3.5 text-neon-yellow shrink-0" />
                      <span className="font-display font-bold uppercase text-[10px] tracking-[0.15em] text-white/65 truncate">
                        Líder · {champion.name}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/40 ml-auto shrink-0" />
                    </div>
                  ) : null}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="space-y-8 sm:space-y-10 lg:space-y-12">
        {noOnTab ? (
          <section className="bg-panel border border-white/10 rounded-sm p-6 text-center">
            <p className="text-sm text-gray-400">
              Nenhuma competição <span className="text-white/80">{LEAGUE_SCOPE_LABELS[scopeTab].toLowerCase()}</span> neste
              momento. Troca de separador ou configura no <code className="text-neon-yellow">/admin</code>.
            </p>
          </section>
        ) : null}
        {orderedLeagues.map((lg, i) => {
          const isPrimary = lg.id === adminPrimaryLeagueId;
          const { sorted, userPosition, userForm } = displayStandingsForLeague(
            lg,
            club.name,
            club.shortName,
            leagueSeason,
            form,
          );
          const showTable = lg.format === 'round_robin' || lg.format === 'hybrid';
          const showBracket = lg.format === 'knockout' || lg.format === 'hybrid';
          const dateLine =
            lg.startDate || lg.endDate
              ? `${formatDatePt(lg.startDate)} — ${formatDatePt(lg.endDate)}`
              : null;

          return (
            <motion.section
              key={lg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'w-full min-w-0 max-w-full space-y-4 border border-white/10 bg-[#111] p-3 sm:space-y-5 sm:p-5 md:p-6 lg:rounded-lg',
                isPrimary && 'ring-1 ring-neon-yellow/30',
              )}
            >
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-6 sm:gap-y-4 md:gap-x-8 lg:gap-x-10">
                <div className="flex min-w-0 items-start gap-2 sm:gap-3 md:gap-4">
                  <Trophy
                    className={cn(
                      'mt-0.5 h-5 w-5 shrink-0 sm:h-6 sm:w-6 md:h-7 md:w-7',
                      isPrimary ? 'text-neon-yellow' : 'text-neon-yellow/70',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:gap-x-3">
                      <h3 className="min-w-0 max-w-full break-words font-display text-base font-bold uppercase tracking-wider text-white sm:break-normal sm:text-lg md:text-xl lg:text-2xl">
                        {lg.name}
                      </h3>
                      {isPrimary ? (
                        <span className="shrink-0 rounded bg-neon-yellow/20 px-2 py-0.5 text-[8px] font-bold uppercase leading-tight text-neon-yellow sm:text-[9px] md:px-2.5 md:py-1 md:text-[10px]">
                          Principal
                        </span>
                      ) : null}
                      <span className="max-w-full min-w-0 rounded border border-white/15 px-2 py-0.5 text-[8px] font-bold uppercase leading-tight text-gray-400 sm:text-[9px] md:px-2.5 md:py-1 md:text-[10px]">
                        {LEAGUE_FORMAT_LABELS[lg.format]}
                      </span>
                      <span className="max-w-full min-w-0 rounded border border-neon-green/25 bg-neon-green/10 px-2 py-0.5 text-[8px] font-bold uppercase leading-tight text-neon-green/90 sm:text-[9px] md:px-2.5 md:py-1 md:text-[10px]">
                        {LEAGUE_SCOPE_LABELS[lg.scope]}
                      </span>
                    </div>
                    <p className="mt-0.5 max-w-full break-words text-[10px] font-bold uppercase tracking-wider text-gray-500 md:text-xs">
                      {lg.division}
                    </p>
                    {dateLine ? (
                      <p className="mt-1 max-w-full break-words text-xs leading-snug text-gray-400 md:text-sm">
                        <span className="text-gray-500">Período: </span>
                        {dateLine}
                      </p>
                    ) : null}
                    {lg.format === 'hybrid' && lg.hybridQualificationEndDate ? (
                      <p className="mt-0.5 max-w-full break-words text-xs leading-snug text-gray-500 md:text-sm">
                        Fim qualificação: {formatDatePt(lg.hybridQualificationEndDate)}
                      </p>
                    ) : null}
                    {(lg.format === 'knockout' || lg.format === 'hybrid') && lg.knockoutStartDate ? (
                      <p className="mt-0.5 max-w-full break-words text-xs leading-snug text-gray-500 md:text-sm">
                        Mata-mata: {formatDatePt(lg.knockoutStartDate)}
                        {lg.knockoutBracketSize ? ` · bracket ${lg.knockoutBracketSize}` : null}
                      </p>
                    ) : null}
                    {lg.prizeSummary ? (
                      <p className="mt-2 max-w-full break-words text-pretty text-sm leading-snug text-gray-400 md:text-base md:leading-relaxed lg:max-w-2xl">
                        <span className="font-semibold text-gray-500">Prémios: </span>
                        {lg.prizeSummary}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:w-auto sm:max-w-md sm:justify-self-stretch sm:gap-2.5 md:max-w-lg md:gap-3 lg:max-w-xl">
                  <div className="min-w-0 border border-white/5 bg-black/40 px-2 py-2.5 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-500 sm:text-[10px] md:text-xs">
                      Posição
                    </div>
                    <div className="truncate font-serif-hero text-xl font-black tabular-nums text-neon-yellow sm:text-2xl md:text-3xl">
                      {userPosition}º
                    </div>
                  </div>
                  <div className="min-w-0 border border-white/5 bg-black/40 px-2 py-2.5 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-500 sm:text-[10px] md:text-xs">
                      Pontos
                    </div>
                    <div className="truncate font-serif-hero text-xl font-black tabular-nums text-white sm:text-2xl md:text-3xl">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.points ?? '—'}
                    </div>
                  </div>
                  <div className="min-w-0 border border-white/5 bg-black/40 px-2 py-2.5 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-500 sm:text-[10px] md:text-xs">
                      Jogos
                    </div>
                    <div className="truncate font-serif-hero text-xl font-black tabular-nums text-white sm:text-2xl md:text-3xl">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.played ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                <span className="mr-0.5 shrink-0 text-[9px] font-bold uppercase tracking-wider text-gray-500 sm:mr-1">
                  Forma
                </span>
                {userForm.map((f, j) => (
                  <span
                    key={j}
                    className={cn(
                      'flex h-5 w-5 items-center justify-center text-[9px] font-display font-black',
                      f === 'W' ? 'bg-neon-green text-black' : f === 'D' ? 'bg-gray-600 text-white' : 'bg-red-600 text-white',
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>

              {showTable ? (
                <div className="min-w-0 max-w-full">
                  <h4 className="mb-2 flex min-w-0 max-w-full flex-wrap items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-white sm:mb-3 sm:text-sm md:text-base md:tracking-wide">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-neon-yellow sm:h-4 sm:w-4 md:h-5 md:w-5" />
                    <span className="min-w-0 break-words leading-snug">
                      {lg.format === 'hybrid' ? 'Fase de qualificação (tabela)' : 'Classificação'}
                    </span>
                  </h4>
                  <StandingsBlock sorted={sorted} clubName={club.name} clubShort={club.shortName} />
                </div>
              ) : null}

              {showBracket ? (
                <div className="min-w-0 max-w-full">
                  <h4 className="mb-2 max-w-full break-words font-display text-xs font-bold uppercase tracking-wider text-white sm:mb-3 sm:text-sm md:text-base">
                    {lg.format === 'hybrid' ? 'Mata-mata' : 'Chaves'}
                  </h4>
                  <KnockoutBracketSection rounds={lg.knockoutRounds} />
                </div>
              ) : null}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

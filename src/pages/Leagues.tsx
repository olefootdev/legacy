import { motion, AnimatePresence } from 'motion/react';
import { Trophy, TrendingUp, Shield, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { useMemo, useState } from 'react';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';
import type { AdminLeagueConfig, KnockoutRound, LeagueScope } from '@/match/adminLeagues';
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

export function Leagues() {
  const club = useGameStore((s) => s.club);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const form = useGameStore((s) => s.form);
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const adminPrimaryLeagueId = useGameStore((s) => s.adminPrimaryLeagueId);
  /** Sprint B-4: Liga Global MVP (OLEFOOT LIGA) — sempre visível mesmo sem 32 times. */
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);

  /** Sprint B-4: filtra a liga-exemplo Brasileirão (já persistida em saves antigos). */
  const playerLeagues = useMemo(
    () =>
      adminLeagues
        .filter(isLeagueVisibleInPlayerApp)
        .filter((l) => !l.id.startsWith('seed-brasileirao-')),
    [adminLeagues],
  );

  const [scopeTab, setScopeTab] = useState<Exclude<LeagueScope, 'world'>>('national');
  const tabMeta = TAB_META[scopeTab];

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
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 pb-8 lg:max-w-5xl xl:max-w-6xl">
      <BackButton to="/competicao" label="Competição" />

      {/* ── Header — Sprint B-4 Legacy Tech (padrão Ranking) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-white/10 bg-dark-gray overflow-hidden"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <div className="bg-black/40 p-6 md:p-8 border-b border-[var(--color-divider-yellow)]">
          <div
            className="font-display font-bold uppercase text-neon-yellow/80 mb-3"
            style={{ fontSize: '10px', letterSpacing: '0.28em' }}
          >
            OLE Football · Competições
          </div>
          <h1 className="leading-[0.92]">
            <span
              className="block font-bold uppercase text-white"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 5.5vw, 3.5rem)',
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
                className="block italic text-neon-yellow mt-1"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                {tabMeta.subtitle}
              </motion.span>
            </AnimatePresence>
          </h1>
          <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-5" />
          <p
            className="text-white/55 max-w-md mt-4"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.5 }}
          >
            {tabMeta.quote.replace(/“|”/g, '')}
          </p>
        </div>

        {/* Tabs — pílulas (sem ícones) */}
        <div className="p-4 border-b border-white/10 flex flex-wrap gap-2">
          {PLAYER_SCOPE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setScopeTab(t.id)}
              className={cn(
                'inline-flex items-center rounded-[var(--radius-pill)] px-5 py-2 font-display text-[11px] font-black uppercase tracking-[0.22em] transition-all',
                scopeTab === t.id
                  ? 'bg-neon-yellow text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)]'
                  : 'border border-white/15 bg-white/[0.03] text-white/65 hover:border-neon-yellow/40 hover:text-white',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── OLEFOOT LIGA (Liga Global MVP) — sempre visível ── */}
      <OlefootLigaSection
        teams={globalLeagueMVP?.teams ?? []}
        status={globalLeagueMVP?.status ?? 'waiting_teams'}
        minTeamsRequired={globalLeagueMVP?.minTeamsRequired ?? 32}
      />

      {/* ── Estado vazio (sem ligas extras no save) ── */}
      {isEmpty ? (
        <section
          className="border border-white/10 bg-panel p-6 text-center"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <p className="text-sm text-gray-400 leading-relaxed">
            Sem ligas regionais ou nacionais configuradas no save. A
            <strong className="text-white"> OLEFOOT LIGA</strong> acima fica sempre disponível, e novas
            competições podem ser criadas em <code className="text-neon-yellow">/admin</code>.
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

/**
 * Sprint B-4: bloco da OLEFOOT LIGA (Liga Global MVP) sempre visível em /competicao/ligas.
 * Exibe times cadastrados ordenados por overall, mesmo antes de atingir 32 times.
 *
 * Status:
 *  - waiting_teams: aguardando 32 cadastros (mostra contador + lista parcial)
 *  - playoffs: playoffs em curso (link pra bracket)
 *  - league_active: liga oficial em curso (mostra divisão 1)
 *  - season_ended: temporada encerrada
 */
type OlefootLigaSectionProps = {
  teams: import('@/match/globalLeagueMVP').GlobalTeam[];
  status: import('@/match/globalLeagueMVP').GlobalLeagueStatus;
  minTeamsRequired: number;
};

function OlefootLigaSection({ teams, status, minTeamsRequired }: OlefootLigaSectionProps) {
  const teamsCount = teams.length;
  const remaining = Math.max(0, minTeamsRequired - teamsCount);
  const progress = Math.min(100, (teamsCount / minTeamsRequired) * 100);

  // Ordena por overall desc para vitrine antes do início
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.overall - a.overall),
    [teams],
  );

  const statusBadge =
    status === 'waiting_teams'
      ? { label: 'Aguardando cadastros', tone: 'text-neon-yellow border-neon-yellow/40 bg-neon-yellow/10' }
      : status === 'playoffs'
        ? { label: 'Playoffs em curso', tone: 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10' }
        : status === 'league_active'
          ? { label: 'Liga em curso', tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' }
          : { label: 'Temporada encerrada', tone: 'text-white/65 border-white/15 bg-white/[0.03]' };

  const targetRoute =
    status === 'waiting_teams'
      ? '/liga-global/registro'
      : status === 'playoffs'
        ? '/liga-global/playoffs'
        : '/match/olefoot-liga';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative isolate overflow-hidden border border-[var(--color-divider-yellow-strong)]"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-panel-elevated)',
        boxShadow: 'var(--shadow-card-hover)',
      }}
    >
      {/* Trilho lateral amarelo neon */}
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />

      {/* Header */}
      <div className="border-b border-[var(--color-divider-yellow)] p-6 md:p-7 pl-7 md:pl-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="font-display font-bold uppercase text-neon-yellow/85 mb-2"
              style={{ fontSize: '10px', letterSpacing: '0.28em' }}
            >
              Liga Global · Temporada 2026
            </div>
            <h2 className="leading-[0.95]">
              <span
                className="block font-bold uppercase text-white"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
                  letterSpacing: '0.005em',
                }}
              >
                OLEFOOT LIGA
              </span>
              <span
                className="block italic text-neon-yellow mt-0.5"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(1.25rem, 3.5vw, 2rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                {status === 'waiting_teams'
                  ? `${teamsCount}/${minTeamsRequired} times`
                  : status === 'playoffs'
                    ? 'playoffs'
                    : status === 'league_active'
                      ? 'em disputa'
                      : 'encerrada'}
              </span>
            </h2>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-[var(--radius-pill)] border px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.22em]',
              statusBadge.tone,
            )}
          >
            {statusBadge.label}
          </span>
        </div>

        <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-5" />

        {/* Progress (só na fase de cadastro) */}
        {status === 'waiting_teams' ? (
          <div className="mt-5 max-w-md">
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-neon-yellow shadow-[0_0_12px_rgba(253,225,0,0.4)]"
              />
            </div>
            <p className="mt-2 text-[12px] text-white/55">
              {remaining > 0
                ? `Faltam ${remaining} time${remaining === 1 ? '' : 's'} para iniciar os playoffs.`
                : 'Quórum atingido — playoffs prestes a começar.'}
            </p>
          </div>
        ) : null}

        <Link
          to={targetRoute}
          className="mt-6 inline-flex items-center bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {status === 'waiting_teams'
            ? 'Entrar na Liga'
            : status === 'playoffs'
              ? 'Ver Playoffs'
              : status === 'league_active'
                ? 'Ver Tabela'
                : 'Ver Resultado'}
        </Link>
      </div>

      {/* Lista de times cadastrados */}
      <div className="p-6 md:p-7 pl-7 md:pl-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3
            className="font-display text-[12px] font-black uppercase tracking-[0.24em] text-white/85"
          >
            Times cadastrados
          </h3>
          <span
            className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/40"
          >
            {teamsCount} {teamsCount === 1 ? 'manager' : 'managers'}
          </span>
        </div>

        {teamsCount === 0 ? (
          <p className="text-[13px] leading-relaxed text-white/45">
            Ninguém cadastrado ainda. Sê o primeiro a entrar na competição mundial — assim que tiveres
            elenco e tática prontos, abre <span className="text-neon-yellow">Entrar na Liga</span>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
            {sortedTeams.map((team, index) => (
              <div
                key={team.id}
                className="flex items-center justify-between border border-white/[0.05] bg-[var(--color-panel-soft)] px-3 py-2.5"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="shrink-0 font-display text-[11px] font-black tabular-nums text-white/40"
                    style={{ width: '1.75rem' }}
                  >
                    #{index + 1}
                  </span>
                  <span className="truncate font-display text-[13px] font-bold uppercase tracking-wide text-white">
                    {team.clubName}
                  </span>
                </div>
                <span
                  className="shrink-0 italic tabular-nums leading-none text-neon-yellow"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {team.overall}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

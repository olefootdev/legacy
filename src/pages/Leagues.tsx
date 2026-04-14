import { motion } from 'motion/react';
import { Trophy, TrendingUp, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { useMemo } from 'react';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import type { AdminLeagueConfig, KnockoutRound } from '@/match/adminLeagues';
import {
  goalDiff,
  LEAGUE_FORMAT_LABELS,
  positionOfClub,
  rowMatchingClub,
  sortStandings,
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
  let standings = league.standings.map((r) => ({ ...r }));
  if (league.syncStatsFromSeason) {
    const row = rowMatchingClub(standings, clubName, clubShort);
    if (row) {
      row.played = leagueSeason.played;
      row.points = leagueSeason.points;
      row.goalsFor = leagueSeason.goalsFor;
      row.goalsAgainst = leagueSeason.goalsAgainst;
    }
  }
  const sorted = sortStandings(standings);
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
    <div className="ole-scroll-x w-full max-w-full min-w-0 rounded border border-white/10 bg-[#111] lg:rounded-lg">
      <div className="grid w-full min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem] gap-x-1.5 gap-y-0 border-b border-white/10 px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500 sm:grid-cols-[2rem_minmax(0,1fr)_2.5rem_2.5rem_2.5rem] sm:gap-x-2 sm:px-4 sm:text-[10px] md:grid-cols-[2.25rem_minmax(0,1fr)_2.75rem_2.75rem_3rem] md:gap-x-3 md:px-5 md:py-2.5 md:text-xs lg:grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem_3.5rem] lg:gap-x-4 lg:px-6">
        <span>#</span>
        <span className="min-w-0">Equipe</span>
        <span className="text-center">J</span>
        <span className="text-center">PTS</span>
        <span className="text-center">SG</span>
      </div>
      {sorted.map((row, idx) => {
        const isOle =
          row.name === clubShort ||
          row.name === clubName ||
          row.name.toUpperCase().includes(clubShort.toUpperCase());
        const sg = goalDiff(row);
        const sgLabel = sg >= 0 ? `+${sg}` : String(sg);
        return (
          <div
            key={row.teamId}
            className={cn(
              'grid w-full min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem] items-center gap-x-1.5 gap-y-0 border-b border-white/5 px-2 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_2.5rem_2.5rem_2.5rem] sm:gap-x-2 sm:px-4 sm:py-3 md:grid-cols-[2.25rem_minmax(0,1fr)_2.75rem_2.75rem_3rem] md:gap-x-3 md:px-5 md:py-3.5 lg:grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem_3.5rem] lg:gap-x-4 lg:px-6 last:border-b-0',
              isOle && 'bg-neon-yellow/5',
            )}
          >
            <span
              className={cn(
                'shrink-0 font-display text-xs font-bold tabular-nums sm:text-sm md:text-base',
                isOle ? 'text-neon-yellow' : 'text-gray-500',
              )}
            >
              {idx + 1}
            </span>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 md:gap-3">
              {isOle && supporterCrestUrl ? (
                <img
                  src={supporterCrestUrl}
                  alt=""
                  className="h-7 w-7 min-h-7 min-w-7 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] md:h-8 md:w-8 md:min-h-8 md:min-w-8"
                />
              ) : (
                <Shield
                  className={cn('h-4 w-4 shrink-0 md:h-5 md:w-5', isOle ? 'text-neon-yellow' : 'text-gray-600')}
                />
              )}
              <span
                className={cn(
                  'min-w-0 truncate font-display text-sm font-bold tracking-wider md:text-base',
                  isOle ? 'text-white' : 'text-gray-400',
                )}
              >
                {row.name}
              </span>
            </div>
            <span
              className={cn(
                'shrink-0 text-center font-display text-xs font-bold tabular-nums sm:text-sm md:text-base',
                isOle ? 'text-neon-yellow' : 'text-white',
              )}
            >
              {row.played}
            </span>
            <span
              className={cn(
                'shrink-0 text-center font-display text-xs font-bold tabular-nums sm:text-sm md:text-base',
                isOle ? 'text-neon-yellow' : 'text-white',
              )}
            >
              {row.points}
            </span>
            <span className="shrink-0 text-center font-display text-xs tabular-nums text-gray-500 sm:text-sm md:text-base">
              {sgLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Leagues() {
  const club = useGameStore((s) => s.club);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const form = useGameStore((s) => s.form);
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const adminPrimaryLeagueId = useGameStore((s) => s.adminPrimaryLeagueId);

  const orderedLeagues = useMemo(() => {
    const primary = adminLeagues.find((l) => l.id === adminPrimaryLeagueId);
    const rest = adminLeagues.filter((l) => l.id !== adminPrimaryLeagueId);
    return primary ? [primary, ...rest] : [...adminLeagues];
  }, [adminLeagues, adminPrimaryLeagueId]);

  if (adminLeagues.length === 0) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 lg:max-w-5xl xl:max-w-6xl">
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-white/10 px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.32} />
          <div className="relative z-10 min-w-0 max-w-full md:max-w-3xl">
            <h2 className="break-words font-display text-2xl font-black uppercase tracking-wider sm:text-3xl md:text-4xl">
              Ligas
            </h2>
            <p className="mt-2 max-w-full break-words text-pretty text-sm leading-snug text-gray-500 md:text-base md:leading-relaxed">
              Nenhuma competição configurada. Use o painel em <code className="text-neon-yellow">/admin</code> para criar
              ligas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 sm:space-y-10 lg:max-w-5xl xl:max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative min-w-0 overflow-hidden rounded-xl border border-white/10 px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6"
      >
        <GameBannerBackdrop slot="leagues_header" imageOpacity={0.32} />
        <div className="relative z-10 min-w-0 max-w-full md:max-w-3xl">
          <h2 className="break-words font-display text-2xl font-black uppercase tracking-wider sm:text-3xl md:text-4xl">
            Ligas
          </h2>
          <p className="mt-1 max-w-full break-words text-pretty text-sm font-medium leading-snug text-gray-500 md:mt-2 md:text-base md:leading-relaxed">
            Competições, calendário e formato — tabela, mata-mata ou híbrido.
          </p>
        </div>
      </motion.div>

      <div className="space-y-8 sm:space-y-10 lg:space-y-12">
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

                <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 sm:w-auto sm:max-w-md sm:justify-self-stretch sm:gap-2 md:max-w-lg md:gap-3 lg:max-w-xl">
                  <div className="min-w-0 border border-white/5 bg-black/40 px-1.5 py-2 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-500 sm:text-[10px] md:text-xs">
                      Posição
                    </div>
                    <div className="truncate font-display text-lg font-black tabular-nums text-neon-yellow sm:text-xl md:text-2xl">
                      {userPosition}º
                    </div>
                  </div>
                  <div className="min-w-0 border border-white/5 bg-black/40 px-1.5 py-2 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-500 sm:text-[10px] md:text-xs">
                      Pontos
                    </div>
                    <div className="truncate font-display text-lg font-black tabular-nums text-white sm:text-xl md:text-2xl">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.points ?? '—'}
                    </div>
                  </div>
                  <div className="min-w-0 border border-white/5 bg-black/40 px-1.5 py-2 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-500 sm:text-[10px] md:text-xs">
                      Jogos
                    </div>
                    <div className="truncate font-display text-lg font-black tabular-nums text-white sm:text-xl md:text-2xl">
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

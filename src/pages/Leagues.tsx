import { motion } from 'motion/react';
import { Trophy, TrendingUp, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { useMemo } from 'react';
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
      <p className="text-sm text-white/40">
        Chaves ainda não definidas. No painel <span className="text-neon-yellow">/admin</span>, escolhe o tamanho do
        bracket e usa <strong className="text-white/60">Sortear chaves</strong>.
      </p>
    );
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <div key={round.name} className="min-w-[200px] shrink-0 space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{round.name}</h4>
          {round.pairs.map((p, i) => (
            <div
              key={i}
              className="border border-white/10 bg-black/50 px-3 py-2 text-xs text-white/85"
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
  return (
    <div className="overflow-hidden border border-white/10 bg-[#111]">
      <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem] gap-2 border-b border-white/10 px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
        <span>#</span>
        <span>Equipe</span>
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
              'grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem] gap-2 border-b border-white/5 px-4 py-3 items-center',
              isOle && 'bg-neon-yellow/5',
            )}
          >
            <span className={cn('font-display text-sm font-bold', isOle ? 'text-neon-yellow' : 'text-gray-500')}>
              {idx + 1}
            </span>
            <div className="flex items-center gap-2">
              <Shield className={cn('h-4 w-4', isOle ? 'text-neon-yellow' : 'text-gray-600')} />
              <span
                className={cn('font-display text-sm font-bold tracking-wider', isOle ? 'text-white' : 'text-gray-400')}
              >
                {row.name}
              </span>
            </div>
            <span className={cn('text-center font-display text-sm font-bold', isOle ? 'text-neon-yellow' : 'text-white')}>
              {row.played}
            </span>
            <span className={cn('text-center font-display text-sm font-bold', isOle ? 'text-neon-yellow' : 'text-white')}>
              {row.points}
            </span>
            <span className="text-center text-sm text-gray-500">{sgLabel}</span>
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
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-white/10 px-4 py-5">
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.32} />
          <div className="relative z-10">
            <h2 className="font-display text-3xl font-black uppercase tracking-wider">Ligas</h2>
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma competição configurada. Use o painel em <code className="text-neon-yellow">/admin</code> para criar
              ligas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-white/10 px-4 py-5"
      >
        <GameBannerBackdrop slot="leagues_header" imageOpacity={0.32} />
        <div className="relative z-10">
          <h2 className="font-display text-3xl font-black uppercase tracking-wider">Ligas</h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Competições, calendário e formato — tabela, mata-mata ou híbrido.
          </p>
        </div>
      </motion.div>

      <div className="space-y-10">
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
                'space-y-5 border border-white/10 bg-[#111] p-5',
                isPrimary && 'ring-1 ring-neon-yellow/30',
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <Trophy className={cn('h-6 w-6 shrink-0', isPrimary ? 'text-neon-yellow' : 'text-neon-yellow/70')} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">{lg.name}</h3>
                      {isPrimary ? (
                        <span className="rounded bg-neon-yellow/20 px-2 py-0.5 text-[9px] font-bold uppercase text-neon-yellow">
                          Principal
                        </span>
                      ) : null}
                      <span className="rounded border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase text-gray-400">
                        {LEAGUE_FORMAT_LABELS[lg.format]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">{lg.division}</p>
                    {dateLine ? (
                      <p className="mt-1 text-xs text-gray-400">
                        <span className="text-gray-500">Período: </span>
                        {dateLine}
                      </p>
                    ) : null}
                    {lg.format === 'hybrid' && lg.hybridQualificationEndDate ? (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Fim qualificação: {formatDatePt(lg.hybridQualificationEndDate)}
                      </p>
                    ) : null}
                    {(lg.format === 'knockout' || lg.format === 'hybrid') && lg.knockoutStartDate ? (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Mata-mata: {formatDatePt(lg.knockoutStartDate)}
                        {lg.knockoutBracketSize ? ` · bracket ${lg.knockoutBracketSize}` : null}
                      </p>
                    ) : null}
                    {lg.prizeSummary ? (
                      <p className="mt-2 max-w-prose text-sm text-gray-400">
                        <span className="font-semibold text-gray-500">Prémios: </span>
                        {lg.prizeSummary}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                  <div className="border border-white/5 bg-black/40 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Posição</div>
                    <div className="font-display text-xl font-black text-neon-yellow">{userPosition}º</div>
                  </div>
                  <div className="border border-white/5 bg-black/40 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pontos</div>
                    <div className="font-display text-xl font-black text-white">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.points ?? '—'}
                    </div>
                  </div>
                  <div className="border border-white/5 bg-black/40 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Jogos</div>
                    <div className="font-display text-xl font-black text-white">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.played ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">Forma</span>
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
                <div>
                  <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-white">
                    <TrendingUp className="h-4 w-4 text-neon-yellow" />
                    {lg.format === 'hybrid' ? 'Fase de qualificação (tabela)' : 'Classificação'}
                  </h4>
                  <StandingsBlock sorted={sorted} clubName={club.name} clubShort={club.shortName} />
                </div>
              ) : null}

              {showBracket ? (
                <div>
                  <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-white">
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

import { motion, AnimatePresence } from 'motion/react';
import { Trophy, TrendingUp, Shield, ChevronRight, Globe, Layers, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { useMemo, useState } from 'react';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';
import type { AdminLeagueConfig, KnockoutRound, LeagueScope } from '@/match/adminLeagues';
import { BackButton } from '@/components/BackButton';
import { CinematicHero } from '@/components/CinematicHero';
import { LocalLeagueSection } from '@/components/leagues/LocalLeagueSection';
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';
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
      <p className="max-w-full truncate text-sm text-cimento">{L('Chaves ainda não definidas.', 'Brackets not set yet.')}</p>
    );
  }
  return (
    <div className="ole-scroll-x flex w-full max-w-full min-w-0 gap-4 pb-2 md:gap-6">
      {rounds.map((round) => (
        <div key={round.name} className="min-w-[200px] shrink-0 space-y-2 md:min-w-[220px] md:space-y-2.5">
          <h4 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-cimento md:text-xs">{round.name}</h4>
          {round.pairs.map((p, i) => (
            <div
              key={i}
              className="border border-white/10 bg-panel px-3 py-2 text-xs text-giz md:px-4 md:py-2.5 md:text-sm"
            >
              <div className="truncate font-medium">{p.homeName}</div>
              <div className="py-0.5 text-center font-mono text-[10px] text-poeira">vs</div>
              <div className="truncate font-medium">{p.awayName}</div>
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
            <th className="px-2 sm:px-3">{L('Equipe', 'Team')}</th>
            <th style={{ width: '2.5rem' }} className="text-center px-1 sm:px-2">{L('J', 'P')}</th>
            <th style={{ width: '3rem' }} className="text-center px-1 sm:px-2">PTS</th>
            <th style={{ width: '3rem' }} className="text-center px-1 sm:px-2">{L('SG', 'GD')}</th>
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
              <tr
                key={row.teamId}
                data-is-user={isOle ? 'true' : undefined}
                className={isOle ? '!bg-neon-yellow text-black' : undefined}
              >
                <td className="text-center px-1 sm:px-2">
                  <span className={cn('ole-num text-xs sm:text-sm', isOle ? 'text-black' : 'text-cimento')}>{rank}</span>
                </td>
                <td className="px-2 sm:px-3">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 md:gap-3">
                    {isOle && supporterCrestUrl ? (
                      <img
                        src={supporterCrestUrl}
                        alt=""
                        className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6 md:h-7 md:w-7"
                      />
                    ) : (
                      <Shield
                        className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 md:h-5 md:w-5', isOle ? 'text-black' : 'text-poeira')}
                      />
                    )}
                    <span
                      className={cn(
                        'min-w-0 truncate text-xs sm:text-sm md:text-base',
                        isOle ? 'font-bold text-black' : 'text-giz',
                      )}
                    >
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="text-center px-1 sm:px-2">
                  <span className={cn('ole-num text-xs sm:text-sm md:text-base', isOle ? 'text-black' : 'text-white')}>
                    {row.played}
                  </span>
                </td>
                <td className="text-center px-1 sm:px-2">
                  <span className={cn('ole-num text-xs sm:text-sm md:text-base', isOle ? 'text-black' : 'text-white')}>
                    {row.points}
                  </span>
                </td>
                <td className="text-center px-1 sm:px-2">
                  <span className={cn('ole-num text-xs sm:text-sm md:text-base', isOle ? 'text-black/70' : 'text-cimento')}>
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
  { id: 'national', label: L('Nacionais', 'National') },
  { id: 'state', label: L('Estaduais', 'State') },
];

const TAB_META: Record<Exclude<LeagueScope, 'world'>, { num: string; eyebrow: string; subtitle: string; quote: string }> = {
  national: { num: '01', eyebrow: L('Competições · Nacional', 'Competitions · National'), subtitle: L('pelo país.', 'across the country.'), quote: L('“pontos corridos, mata-mata e híbridos do território nacional.”', '“round-robin, knockout and hybrid across the nation.”') },
  state:    { num: '02', eyebrow: L('Competições · Estadual', 'Competitions · State'), subtitle: L('pelo estado.', 'across the state.'), quote: L('“rivalidades regionais — onde tudo começa.”', '“regional rivalries — where it all begins.”') },
};

// Sprint 7 — As 3 ligas que o usuário quer em destaque no topo de /competicao/ligas.
type PrimaryLeagueTab = 'global' | 'classic' | 'fast';

const PRIMARY_LEAGUE_TABS: {
  id: PrimaryLeagueTab;
  label: string;
  icon: typeof Globe;
  subtitle: string;
  quote: string;
  heroImage: string;
  heroPos: string;
  heroCaption: string;
}[] = [
  {
    id: 'global',
    label: L('Liga Global', 'Global League'),
    icon: Globe,
    subtitle: L('pelo mundo.', 'around the world.'),
    quote: L('A liga autoritativa — managers reais em divisões com promoção e rebaixamento.', 'The authoritative league — real managers in divisions with promotion and relegation.'),
    heroImage: '/login-hero.png',
    heroPos: 'center 18%',
    heroCaption: L('Managers reais · promoção e rebaixamento', 'Real managers · promotion and relegation'),
  },
  {
    id: 'classic',
    label: L('Liga Classic', 'Classic League'),
    icon: Layers,
    subtitle: L('no campo 2D.', 'on the 2D pitch.'),
    quote: L('Cada partida CLASSIC soma pontos — ranking eterno de managers táticos.', 'Every CLASSIC match adds points — the all-time ranking of tactical managers.'),
    heroImage: '/hero-legacy-high.png',
    heroPos: 'center 12%',
    heroCaption: L('Pontos corridos · ranking eterno', 'Round-robin · all-time ranking'),
  },
  {
    id: 'fast',
    label: L('Fast Liga', 'Fast League'),
    icon: Zap,
    subtitle: L('partida rápida.', 'quick match.'),
    quote: L('Cada partida RÁPIDA soma pontos — quem joga mais, sobe mais rápido.', 'Every QUICK match adds points — play more, climb faster.'),
    heroImage: '/hero-legacy-full.png',
    heroPos: 'center 22%',
    heroCaption: L('Partida rápida · sobe quem joga mais', 'Quick match · the more you play, the higher you climb'),
  },
];

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

  // Sprint 7 — tab principal entre as 3 ligas que o jogo prioriza pra launch.
  const [primaryTab, setPrimaryTab] = useState<PrimaryLeagueTab>('global');
  const primaryMeta = PRIMARY_LEAGUE_TABS.find((t) => t.id === primaryTab)!;

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
      <BackButton to="/competicao" label={L('Competição', 'Competition')} />

      {/* ── Hero cinematográfico — muda com a tab primária selecionada ── */}
      <CinematicHero
        image={primaryMeta.heroImage}
        objectPosition={primaryMeta.heroPos}
        badgeLabel={L('Competição', 'Competition')}
        BadgeIcon={Trophy}
        eyebrow={L('OLE Football · Competições', 'OLE Football · Competitions')}
        title={primaryMeta.label}
        caption={primaryMeta.heroCaption}
      />

      {/* Tabs PRIMÁRIAS — LIGA GLOBAL / LIGA CLASSIC / FAST LIGA */}
      <div className="flex flex-wrap gap-2">
        {PRIMARY_LEAGUE_TABS.map((t) => {
          const TabIcon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPrimaryTab(t.id)}
              className={cn(
                'ole-num inline-flex h-10 items-center gap-2 whitespace-nowrap px-4 text-[12px] uppercase transition-colors',
                primaryTab === t.id
                  ? 'bg-neon-yellow text-black'
                  : 'border border-white/16 text-cimento hover:border-white/30 hover:text-white',
              )}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo da tab primária selecionada ── */}
      {primaryTab === 'global' && (
        <OlefootLigaSection
          teams={globalLeagueMVP?.teams ?? []}
          status={globalLeagueMVP?.status ?? 'waiting_teams'}
          minTeamsRequired={globalLeagueMVP?.minTeamsRequired ?? 32}
        />
      )}
      {primaryTab === 'classic' && <LocalLeagueSection league="classic" />}
      {primaryTab === 'fast'    && <LocalLeagueSection league="fast" />}

      {/* ── Ligas locais (Nacionais / Estaduais) — seção secundária ── */}
      <section className="border border-white/10 bg-panel overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="bg-deep-black px-5 py-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="truncate font-impact uppercase leading-[1.1] text-[20px] text-white">
                {L('Ligas regionais', 'Regional leagues')}
              </h2>
              <Hashtag className="mt-1">{scopeTab === 'national' ? L('#nacional', '#national') : L('#estadual', '#state')}</Hashtag>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLAYER_SCOPE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setScopeTab(t.id)}
                  className={cn(
                    'ole-num inline-flex h-9 items-center whitespace-nowrap px-3 text-[11px] uppercase transition-colors',
                    scopeTab === t.id
                      ? 'bg-giz text-black'
                      : 'border border-white/16 text-cimento hover:border-white/30 hover:text-white',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      {/* ── Estado vazio (sem ligas extras no save) ── */}
      {isEmpty ? (
        <section
          className="border border-white/10 bg-panel p-6 text-center"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <p className="truncate text-sm text-cimento">{L('Nenhuma liga regional no momento.', 'No regional leagues right now.')}</p>
        </section>
      ) : null}

      {/* ── Só ligas mundiais (não visíveis aqui) ── */}
      {onlyWorld ? (
        <section className="bg-panel border border-white/10 rounded-sm p-6 text-center">
          <p className="truncate text-sm text-cimento">{L('Nenhuma liga regional no momento.', 'No regional leagues right now.')}</p>
        </section>
      ) : null}

      {/* ── Slider horizontal — destaque das ligas da aba ── */}
      {!isEmpty && !onlyWorld && orderedLeagues.length > 0 ? (
        <section className="space-y-4">
          <StoreSectionHeadline
            title={L('Em destaque', 'Featured')}
            rightLabel={orderedLeagues.length > 3 ? L(`${orderedLeagues.length} ligas`, `${orderedLeagues.length} leagues`) : undefined}
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
                    'shrink-0 snap-start w-[260px] sm:w-[300px] bg-card border border-white/10 border-l-4 p-4 transition-colors hover:bg-card-hi',
                    isPrimary ? 'border-l-neon-yellow' : 'border-l-white/16',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Hashtag className="text-neon-yellow">#{LEAGUE_SCOPE_LABELS[lg.scope].toLowerCase()}</Hashtag>
                    {isPrimary ? (
                      <span className="shrink-0 bg-neon-yellow text-black px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]">
                        {L('Principal', 'Main')}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-impact text-white text-[20px] sm:text-[22px] leading-[1.1] uppercase mb-1 truncate">
                    {lg.name}
                  </h3>
                  <p className="truncate font-mono text-cimento text-[11px] mb-4">
                    {LEAGUE_FORMAT_LABELS[lg.format]} · {lg.division}
                  </p>
                  {champion ? (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                      <Trophy className="w-3.5 h-3.5 text-neon-yellow shrink-0" />
                      <span className="text-[13px] text-giz truncate">
                        {L('Líder', 'Leader')} · {champion.name}
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
            <p className="truncate text-sm text-cimento">
              {L(`Nenhuma competição ${LEAGUE_SCOPE_LABELS[scopeTab].toLowerCase()} no momento.`, `No ${LEAGUE_SCOPE_LABELS[scopeTab].toLowerCase()} competitions right now.`)}
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
                'w-full min-w-0 max-w-full space-y-4 border border-white/10 bg-panel p-3 sm:space-y-5 sm:p-5 md:p-6',
                isPrimary && 'border-neon-yellow/40',
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
                      <h3 className="min-w-0 max-w-full truncate font-impact text-lg uppercase leading-[1.1] text-white md:text-xl lg:text-2xl">
                        {lg.name}
                      </h3>
                      {isPrimary ? (
                        <span className="shrink-0 bg-neon-yellow px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black">
                          {L('Principal', 'Main')}
                        </span>
                      ) : null}
                      <span className="max-w-full min-w-0 truncate border border-white/16 px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cimento">
                        {LEAGUE_FORMAT_LABELS[lg.format]}
                      </span>
                      <span className="max-w-full min-w-0 truncate border border-white/16 px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cimento">
                        {LEAGUE_SCOPE_LABELS[lg.scope]}
                      </span>
                    </div>
                    <p className="mt-1 max-w-full truncate font-mono text-[11px] uppercase tracking-[0.12em] text-cimento">
                      {lg.division}
                    </p>
                    {dateLine ? (
                      <p className="mt-1 max-w-full truncate font-mono text-[11.5px] text-cimento">
                        <span className="text-poeira">{L('Período: ', 'Period: ')}</span>
                        {dateLine}
                      </p>
                    ) : null}
                    {lg.format === 'hybrid' && lg.hybridQualificationEndDate ? (
                      <p className="mt-0.5 max-w-full truncate font-mono text-[11.5px] text-cimento">
                        {L('Fim qualificação', 'Qualifying ends')}: {formatDatePt(lg.hybridQualificationEndDate)}
                      </p>
                    ) : null}
                    {(lg.format === 'knockout' || lg.format === 'hybrid') && lg.knockoutStartDate ? (
                      <p className="mt-0.5 max-w-full truncate font-mono text-[11.5px] text-cimento">
                        {L('Mata-mata', 'Knockout')}: {formatDatePt(lg.knockoutStartDate)}
                        {lg.knockoutBracketSize ? L(` · chave de ${lg.knockoutBracketSize}`, ` · bracket of ${lg.knockoutBracketSize}`) : null}
                      </p>
                    ) : null}
                    {lg.prizeSummary ? (
                      <p className="mt-2 max-w-full break-words text-sm leading-snug text-giz lg:max-w-2xl">
                        <span className="font-mono text-[11.5px] text-cimento">{L('Prêmios: ', 'Prizes: ')}</span>
                        {lg.prizeSummary}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:w-auto sm:max-w-md sm:justify-self-stretch sm:gap-2.5 md:max-w-lg md:gap-3 lg:max-w-xl">
                  <div className="min-w-0 bg-neon-yellow px-2 py-2.5 text-center text-black sm:p-3 md:px-4 md:py-4">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-black/70 sm:text-[10px]">
                      {L('Posição', 'Position')}
                    </div>
                    <div className="ole-num truncate text-xl sm:text-2xl md:text-3xl">
                      {userPosition}{L('º', '')}
                    </div>
                  </div>
                  <div className="min-w-0 border border-white/10 bg-deep-black px-2 py-2.5 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-cimento sm:text-[10px]">
                      {L('Pontos', 'Points')}
                    </div>
                    <div className="ole-num truncate text-xl text-white sm:text-2xl md:text-3xl">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.points ?? '—'}
                    </div>
                  </div>
                  <div className="min-w-0 border border-white/10 bg-deep-black px-2 py-2.5 text-center sm:p-3 md:px-4 md:py-4">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-cimento sm:text-[10px]">
                      {L('Jogos', 'Played')}
                    </div>
                    <div className="ole-num truncate text-xl text-white sm:text-2xl md:text-3xl">
                      {rowMatchingClub(sorted, club.name, club.shortName)?.played ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                <span className="mr-0.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-cimento sm:mr-1">
                  {L('Forma', 'Form')}
                </span>
                {userForm.map((f, j) => (
                  <span
                    key={j}
                    className={cn(
                      'ole-num flex h-5 w-5 items-center justify-center text-[9px]',
                      f === 'W' ? 'bg-alta text-black' : f === 'D' ? 'bg-card-hi text-white' : 'bg-baixa text-white',
                    )}
                  >
                    {f === 'W' ? L('V', 'W') : f === 'D' ? L('E', 'D') : L('D', 'L')}
                  </span>
                ))}
              </div>

              {showTable ? (
                <div className="min-w-0 max-w-full">
                  <h4 className="mb-2 flex min-w-0 max-w-full items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz sm:mb-3">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-neon-yellow sm:h-4 sm:w-4" />
                    <span className="min-w-0 truncate">
                      {lg.format === 'hybrid' ? L('Fase de qualificação (tabela)', 'Qualifying stage (table)') : L('Classificação', 'Standings')}
                    </span>
                  </h4>
                  <StandingsBlock sorted={sorted} clubName={club.name} clubShort={club.shortName} />
                </div>
              ) : null}

              {showBracket ? (
                <div className="min-w-0 max-w-full">
                  <h4 className="mb-2 max-w-full truncate font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz sm:mb-3">
                    {lg.format === 'hybrid' ? L('Mata-mata', 'Knockout') : L('Chaves', 'Brackets')}
                  </h4>
                  <KnockoutBracketSection rounds={lg.knockoutRounds} />
                </div>
              ) : null}
            </motion.section>
          );
        })}
      </div>
      </section>
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
      ? { label: L('Aguardando cadastros', 'Awaiting sign-ups'), tone: 'text-neon-yellow border-neon-yellow/40' }
      : status === 'playoffs'
        ? { label: L('Playoffs em curso', 'Playoffs in progress'), tone: 'text-giz border-white/30' }
        : status === 'active'
          ? { label: L('Liga em curso', 'League in progress'), tone: 'text-alta border-alta/40' }
          : { label: L('Temporada encerrada', 'Season ended'), tone: 'text-cimento border-white/16' };

  const targetRoute =
    status === 'waiting_teams'
      ? '/liga-global/registro'
      : status === 'playoffs'
        ? '/liga-global/playoffs'
        : '/match/global';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative isolate overflow-hidden border border-white/10 bg-card"
    >
      {/* Trilho lateral amarelo neon */}
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />

      {/* Header */}
      <div className="border-b border-white/10 p-6 md:p-7 pl-7 md:pl-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Hashtag className="mb-2 text-neon-yellow">{L('#ligaglobal · temporada 2026', '#globalleague · season 2026')}</Hashtag>
            <h2 className="leading-[1.1]">
              <span
                className="block font-impact uppercase text-white"
                style={{
                  fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
                  letterSpacing: '0.005em',
                }}
              >
                {L('LIGA GLOBAL', 'GLOBAL LEAGUE')}
              </span>
              <span
                className="ole-num block uppercase text-neon-yellow mt-0.5"
                style={{
                  fontSize: 'clamp(1.1rem, 3.2vw, 1.75rem)',
                }}
              >
                {status === 'waiting_teams'
                  ? L(`${teamsCount}/${minTeamsRequired} times`, `${teamsCount}/${minTeamsRequired} teams`)
                  : status === 'playoffs'
                    ? 'playoffs'
                    : status === 'active'
                      ? L('em disputa', 'in play')
                      : L('encerrada', 'ended')}
              </span>
            </h2>
          </div>
          <span
            className={cn(
              'inline-flex items-center border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]',
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
            <div className="h-1.5 overflow-hidden bg-card-hi">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-neon-yellow"
              />
            </div>
            <p className="mt-2 truncate text-[12.5px] text-cimento">
              {remaining > 0
                ? L(`Faltam ${remaining} time${remaining === 1 ? '' : 's'} para iniciar os playoffs.`, `${remaining} more team${remaining === 1 ? '' : 's'} needed to start the playoffs.`)
                : L('Quórum atingido — playoffs prestes a começar.', 'Quorum reached — playoffs about to start.')}
            </p>
          </div>
        ) : null}

        <Link
          to={targetRoute}
          className="ole-num mt-6 inline-flex h-[50px] items-center whitespace-nowrap bg-neon-yellow px-5 text-[13px] uppercase text-black transition-colors hover:bg-white [--corte:12px] [clip-path:var(--clip-corte)]"
        >
          {status === 'waiting_teams'
            ? L('Entrar na Liga', 'Join the League')
            : status === 'playoffs'
              ? L('Ver Playoffs', 'View Playoffs')
              : status === 'active'
                ? L('Ver Tabela', 'View Table')
                : L('Ver Resultado', 'View Result')}
        </Link>
      </div>

      {/* Lista de times cadastrados */}
      <div className="p-6 md:p-7 pl-7 md:pl-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            {L('Times cadastrados', 'Registered teams')}
          </h3>
          <span className="shrink-0 font-mono text-[11px] text-cimento">
            {teamsCount} {teamsCount === 1 ? 'manager' : 'managers'}
          </span>
        </div>

        {teamsCount === 0 ? (
          <p className="truncate text-[13px] text-cimento">{L('Ninguém cadastrado ainda.', 'No one registered yet.')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
            {sortedTeams.map((team, index) => (
              <div
                key={team.id}
                className="flex h-11 items-center justify-between gap-3 border border-white/[0.06] bg-panel px-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="ole-num w-7 shrink-0 text-[13px] text-cimento">
                    {index + 1}
                  </span>
                  <span className="truncate text-[14px] text-giz">
                    {team.clubName}
                  </span>
                </div>
                <span className="ole-num shrink-0 text-[17px] leading-none text-neon-yellow">
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

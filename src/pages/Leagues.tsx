import { motion } from 'motion/react';
import { Shield, Globe, Layers, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { useMemo, useState } from 'react';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import type { AdminLeagueConfig, KnockoutRound, LeagueScope } from '@/match/adminLeagues';
import { BackButton } from '@/components/BackButton';
import { LocalLeagueSection } from '@/components/leagues/LocalLeagueSection';
import { BarraSegmentos, BotaoRua, FitaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { AbasRua, CabecalhoRua, FormaRua, LinhaRua, VazioRua } from '@/components/leagues/RuaTabela';
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
      <p className="max-w-full truncate font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">
        {L('Chaves ainda não definidas.', 'Brackets not set yet.')}
      </p>
    );
  }
  return (
    <div className="ole-scroll-x flex w-full max-w-full min-w-0 gap-4 pb-2 md:gap-6">
      {rounds.map((round) => (
        <div key={round.name} className="min-w-[200px] shrink-0 space-y-2 md:min-w-[220px] md:space-y-2.5">
          <h4 className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {round.name}</h4>
          {round.pairs.map((p, i) => (
            <div key={i} className="flex flex-col bg-concreto px-3 py-2.5 md:px-4">
              <span className="truncate font-impact text-[17px] uppercase leading-none text-papel">{p.homeName}</span>
              <span aria-hidden className="py-0.5 font-voz text-[18px] leading-none text-mudo">x</span>
              <span className="truncate font-impact text-[17px] uppercase leading-none text-papel">{p.awayName}</span>
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
    <div className="flex w-full min-w-0 flex-col gap-1.5" role="table" aria-label={L('Classificação', 'Standings')}>
      {sorted.map((row, idx) => {
        const isOle =
          row.name === clubShort ||
          row.name === clubName ||
          row.name.toUpperCase().includes(clubShort.toUpperCase());
        const sg = goalDiff(row);
        const sgLabel = sg >= 0 ? `+${sg}` : String(sg);
        const rank = idx + 1;
        return (
          <LinhaRua
            key={row.teamId}
            pos={rank}
            tom={isOle ? 'eu' : rank === 1 ? 'lider' : 'normal'}
            nome={row.name}
            sub={`${L('J', 'P')} ${row.played} · ${L('SG', 'GD')} ${sgLabel}`}
            valor={row.points}
            avatar={
              isOle && supporterCrestUrl ? (
                <img src={supporterCrestUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
              ) : (
                <Shield aria-hidden className={cn('h-4 w-4 shrink-0', isOle ? 'text-asfalto-27' : rank === 1 ? 'text-ouro-27' : 'text-fio')} />
              )
            }
          />
        );
      })}
    </div>
  );
}

const PLAYER_SCOPE_TABS: { id: Exclude<LeagueScope, 'world'>; label: string }[] = [
  { id: 'national', label: L('Nacionais', 'National') },
  { id: 'state', label: L('Estaduais', 'State') },
];

// Sprint 7 — As 3 ligas que o usuário quer em destaque no topo de /competicao/ligas.
type PrimaryLeagueTab = 'global' | 'classic' | 'fast';

const PRIMARY_LEAGUE_TABS: {
  id: PrimaryLeagueTab;
  label: string;
  icon: typeof Globe;
  subtitle: string;
  quote: string;
  heroCaption: string;
}[] = [
  {
    id: 'global',
    label: L('Liga Global', 'Global League'),
    icon: Globe,
    subtitle: L('Managers de verdade. Sobe quem merece.', 'Real managers. Only the worthy go up.'),
    quote: L('A liga autoritativa — managers reais em divisões com promoção e rebaixamento.', 'The authoritative league — real managers in divisions with promotion and relegation.'),
    heroCaption: L('Managers reais · promoção e rebaixamento', 'Real managers · promotion and relegation'),
  },
  {
    id: 'classic',
    label: L('Liga Classic', 'Classic League'),
    icon: Layers,
    subtitle: L('Tática no campo 2D. Ranking eterno.', 'Tactics on the 2D pitch. All-time ranking.'),
    quote: L('Cada partida CLASSIC soma pontos — ranking eterno de managers táticos.', 'Every CLASSIC match adds points — the all-time ranking of tactical managers.'),
    heroCaption: L('Pontos corridos · ranking eterno', 'Round-robin · all-time ranking'),
  },
  {
    id: 'fast',
    label: L('Fast Liga', 'Fast League'),
    icon: Zap,
    subtitle: L('Quem joga mais, sobe mais rápido.', 'Play more, climb faster.'),
    quote: L('Cada partida RÁPIDA soma pontos — quem joga mais, sobe mais rápido.', 'Every QUICK match adds points — play more, climb faster.'),
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
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 overflow-x-hidden pb-8 lg:max-w-5xl xl:max-w-6xl px-3 sm:px-4">
      <BackButton to="/competicao" label={L('Competição', 'Competition')} />

      {/* ── Cabeçalho DS 2027 — muda com a liga selecionada ── */}
      <CabecalhoRua rotulo={primaryMeta.heroCaption} titulo={primaryMeta.label} voz={primaryMeta.subtitle} />

      {/* Abas PRIMÁRIAS — LIGA GLOBAL / LIGA CLASSIC / FAST LIGA */}
      <AbasRua
        ariaLabel={L('Ligas', 'Leagues')}
        ativa={primaryTab}
        onChange={setPrimaryTab}
        abas={PRIMARY_LEAGUE_TABS.map((t) => {
          const TabIcon = t.icon;
          return {
            id: t.id,
            label: (
              <span className="inline-flex items-center gap-2">
                <TabIcon aria-hidden className="h-4 w-4" />
                {t.label}
              </span>
            ),
          };
        })}
      />

      {/* ── Conteúdo da tab primária selecionada ── */}
      {primaryTab === 'global' && (
        <OlefootLigaSection
          teams={globalLeagueMVP?.teams ?? []}
          status={globalLeagueMVP?.status ?? 'waiting_teams'}
          minTeamsRequired={globalLeagueMVP?.minTeamsRequired ?? 32}
        />
      )}
      {primaryTab === 'classic' && <LocalLeagueSection league="classic" />}
      {primaryTab === 'fast' && <LocalLeagueSection league="fast" />}

      {/* ── Ligas locais (Nacionais / Estaduais) — seção secundária ── */}
      <section className="flex min-w-0 flex-col gap-5 border-t-2 border-linha pt-8">
        <div className="flex min-w-0 flex-col gap-3">
          <SecaoRua label={L('Ligas regionais', 'Regional leagues')} aside={scopeTab === 'national' ? L('#nacional', '#national') : L('#estadual', '#state')} />
          <AbasRua ariaLabel={L('Escopo', 'Scope')} ativa={scopeTab} onChange={setScopeTab} abas={PLAYER_SCOPE_TABS} />
        </div>

        {/* ── Estado vazio (sem ligas extras no save) ── */}
        {isEmpty || onlyWorld ? (
          <VazioRua titulo={L('Nenhuma liga regional', 'No regional leagues')} frase={L('Por enquanto, a rua é global.', 'For now, the street is global.')} />
        ) : null}

        {/* ── Slider horizontal — destaque das ligas da aba ── */}
        {!isEmpty && !onlyWorld && orderedLeagues.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            <SecaoRua
              label={L('Em destaque', 'Featured')}
              aside={orderedLeagues.length > 3 ? L(`${orderedLeagues.length} ligas`, `${orderedLeagues.length} leagues`) : undefined}
            />
            <div className="hide-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pr-2">
              {orderedLeagues.map((lg) => {
                const isPrimary = lg.id === adminPrimaryLeagueId;
                const champion = sortStandings(lg.standings)[0];
                return (
                  <a
                    key={`slide-${lg.id}`}
                    href={`#league-${lg.id}`}
                    className={cn(
                      'flex w-[260px] shrink-0 snap-start flex-col gap-2 bg-concreto p-4 transition-colors hover:bg-linha sm:w-[300px]',
                      isPrimary && 'border-l-[5px] border-rua',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">
                        #{LEAGUE_SCOPE_LABELS[lg.scope].toLowerCase()}
                      </span>
                      {isPrimary ? <SeloRua tom="corre" className="py-0.5 text-[10px]">{L('Principal', 'Main')}</SeloRua> : null}
                    </div>
                    <h3 className="truncate font-impact text-[22px] uppercase leading-none text-papel">{lg.name}</h3>
                    <p className="truncate font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
                      {LEAGUE_FORMAT_LABELS[lg.format]} · {lg.division}
                    </p>
                    {champion ? (
                      <p className="mt-1 flex min-w-0 items-center gap-2 border-t-2 border-linha pt-2">
                        <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-ouro-27">{L('Líder', 'Leader')}</span>
                        <span className="min-w-0 truncate font-impact text-[16px] uppercase leading-none text-papel">{champion.name}</span>
                        <span aria-hidden className="ml-auto font-impact text-rua">→</span>
                      </p>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-10">
          {noOnTab ? (
            <VazioRua
              titulo={L(`Nenhuma competição ${LEAGUE_SCOPE_LABELS[scopeTab].toLowerCase()}`, `No ${LEAGUE_SCOPE_LABELS[scopeTab].toLowerCase()} competitions`)}
              frase={L('Ainda não tem bola rolando aqui.', 'No ball rolling here yet.')}
            />
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
            const myRow = rowMatchingClub(sorted, club.name, club.shortName);

            return (
              <motion.section
                key={lg.id}
                id={`league-${lg.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex w-full min-w-0 max-w-full flex-col gap-5"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {isPrimary ? <SeloRua tom="corre">{L('Principal', 'Main')}</SeloRua> : null}
                    <SeloRua tom="mudo">{LEAGUE_FORMAT_LABELS[lg.format]}</SeloRua>
                    <SeloRua tom="mudo">{LEAGUE_SCOPE_LABELS[lg.scope]}</SeloRua>
                  </div>
                  <h3 className="min-w-0 font-impact uppercase leading-[0.9] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(30px, 8vw, 48px)' }}>
                    {lg.name}
                  </h3>
                  <p className="min-w-0 truncate font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">
                    {[lg.division, dateLine].filter(Boolean).join(' · ')}
                  </p>
                  {lg.format === 'hybrid' && lg.hybridQualificationEndDate ? (
                    <p className="max-w-full truncate font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
                      {L('Fim qualificação', 'Qualifying ends')}: {formatDatePt(lg.hybridQualificationEndDate)}
                    </p>
                  ) : null}
                  {(lg.format === 'knockout' || lg.format === 'hybrid') && lg.knockoutStartDate ? (
                    <p className="max-w-full truncate font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
                      {L('Mata-mata', 'Knockout')}: {formatDatePt(lg.knockoutStartDate)}
                      {lg.knockoutBracketSize ? L(` · chave de ${lg.knockoutBracketSize}`, ` · bracket of ${lg.knockoutBracketSize}`) : null}
                    </p>
                  ) : null}
                  {lg.prizeSummary ? (
                    <p className="max-w-full break-words border-l-[3px] border-ouro-27 pl-3 text-sm leading-snug text-suave lg:max-w-2xl">
                      <span className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-ouro-27">{L('Prêmios · ', 'Prizes · ')}</span>
                      {lg.prizeSummary}
                    </p>
                  ) : null}
                </div>

                {/* Placar do manager nesta liga — posição em rua (ação: subir), pontos e jogos em concreto. */}
                <div className="grid w-full min-w-0 max-w-xl grid-cols-3 gap-1.5">
                  <div className="min-w-0 -rotate-1 bg-rua px-3 py-3 text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]">
                    <div className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-asfalto-27/70">{L('Posição', 'Position')}</div>
                    <div className="truncate font-spray text-[40px] font-black leading-[0.9]">#{userPosition}</div>
                  </div>
                  <div className="min-w-0 bg-concreto px-3 py-3">
                    <div className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Pontos', 'Points')}</div>
                    <div className="truncate font-spray text-[40px] font-black leading-[0.9] text-papel">{myRow?.points ?? '—'}</div>
                  </div>
                  <div className="min-w-0 bg-concreto px-3 py-3">
                    <div className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Jogos', 'Played')}</div>
                    <div className="truncate font-spray text-[40px] font-black leading-[0.9] text-papel">{myRow?.played ?? '—'}</div>
                  </div>
                </div>

                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
                  <span className="shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Forma', 'Form')}</span>
                  {userForm.length > 0 ? <FormaRua form={userForm} /> : <span className="font-prova text-[12px] text-fio">—</span>}
                </div>

                {showTable ? (
                  <div className="flex min-w-0 max-w-full flex-col gap-3">
                    <SecaoRua label={lg.format === 'hybrid' ? L('Fase de qualificação', 'Qualifying stage') : L('Classificação', 'Standings')} />
                    <StandingsBlock sorted={sorted} clubName={club.name} clubShort={club.shortName} />
                  </div>
                ) : null}

                {showBracket ? (
                  <div className="flex min-w-0 max-w-full flex-col gap-3">
                    <SecaoRua label={lg.format === 'hybrid' ? L('Mata-mata', 'Knockout') : L('Chaves', 'Brackets')} />
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

  // Ordena por overall desc para vitrine antes do início
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.overall - a.overall),
    [teams],
  );

  const statusBadge =
    status === 'waiting_teams'
      ? { label: L('Aguardando cadastros', 'Awaiting sign-ups'), tom: 'corre-contorno' as const }
      : status === 'playoffs'
        ? { label: L('Playoffs em curso', 'Playoffs in progress'), tom: 'cal' as const }
        : status === 'active'
          ? { label: L('Liga em curso', 'League in progress'), tom: 'corre' as const }
          : { label: L('Temporada encerrada', 'Season ended'), tom: 'mudo' as const };

  const targetRoute =
    status === 'waiting_teams'
      ? '/liga-global/registro'
      : status === 'playoffs'
        ? '/liga-global/playoffs'
        : '/match/global';

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-6">
      <div className="rua-grao relative flex min-w-0 flex-col gap-4 overflow-hidden bg-concreto p-5 sm:p-7">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <span className="min-w-0 truncate font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
            {L('#ligaglobal · temporada 2026', '#globalleague · season 2026')}
          </span>
          <SeloRua tom={statusBadge.tom}>{statusBadge.label}</SeloRua>
        </div>

        <h2 className="flex min-w-0 flex-col">
          <span className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(40px, 11vw, 72px)' }}>
            {L('Liga Global', 'Global League')}
          </span>
          <span className="font-spray font-black uppercase leading-[0.9] text-rua" style={{ fontSize: 'clamp(32px, 9vw, 56px)' }}>
            {status === 'waiting_teams'
              ? L(`${teamsCount}/${minTeamsRequired} times`, `${teamsCount}/${minTeamsRequired} teams`)
              : status === 'playoffs'
                ? 'playoffs'
                : status === 'active'
                  ? L('em disputa', 'in play')
                  : L('encerrada', 'ended')}
          </span>
        </h2>

        {/* Progresso (só na fase de cadastro) — barra em segmentos. */}
        {status === 'waiting_teams' ? (
          <div className="flex max-w-md flex-col gap-2">
            <BarraSegmentos valor={teamsCount} max={minTeamsRequired} />
            <p className="font-voz text-[22px] leading-[1.05] text-suave">
              {remaining > 0
                ? L(`Faltam ${remaining} time${remaining === 1 ? '' : 's'} pros playoffs.`, `${remaining} more team${remaining === 1 ? '' : 's'} to the playoffs.`)
                : L('Quórum fechado. Os playoffs vêm aí.', 'Quorum reached. Playoffs are coming.')}
            </p>
          </div>
        ) : null}

        <BotaoRua to={targetRoute} className="self-start">
          {status === 'waiting_teams'
            ? L('Entrar na Liga', 'Join the League')
            : status === 'playoffs'
              ? L('Ver Playoffs', 'View Playoffs')
              : status === 'active'
                ? L('Ver Tabela', 'View Table')
                : L('Ver Resultado', 'View Result')}{' '}
          <span aria-hidden>→</span>
        </BotaoRua>
      </div>

      {/* Lista de times cadastrados — por OVR, o maior com fio de ouro. */}
      <div className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Times cadastrados', 'Registered teams')} aside={`${teamsCount} ${teamsCount === 1 ? 'manager' : 'managers'}`} />
        {teamsCount === 0 ? (
          <VazioRua titulo={L('Ninguém cadastrado ainda', 'No one registered yet')} frase={L('O primeiro a chegar escolhe o lugar.', 'First one in picks the spot.')} />
        ) : (
          <div className="grid max-h-[420px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {sortedTeams.map((team, index) => (
              <LinhaRua
                key={team.id}
                pos={index + 1}
                tom={index === 0 ? 'lider' : 'normal'}
                nome={team.clubName}
                valor={<span className={index === 0 ? undefined : 'text-rua'}>{team.overall}</span>}
              />
            ))}
          </div>
        )}
      </div>
      <FitaRua tags={['#ligaglobal', '#sobequemmerece']} inclinacao={1.5} className="-mx-3 sm:-mx-4" />
    </motion.section>
  );
}

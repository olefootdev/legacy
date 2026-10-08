import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Star, Trophy, TrendingUp, Award, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import type { LeagueScopeRankingEntry } from '@/ranking/leagueScopeRanking';
import { getLeagueScopeRankingEntries } from '@/ranking/leagueScopeRanking';
import { getGlobalLeagueRankingEntries } from '@/ranking/globalLeagueRanking';
import { useRankingFavorites } from '@/ranking/useRankingFavorites';
import { LEAGUE_SCOPE_LABELS } from '@/match/adminLeagues';
import { BackButton } from '@/components/BackButton';
import { BotaoRua, FitaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { AbasRua, CabecalhoRua, FaltaRua, LinhaRua, VazioRua, posRua } from '@/components/leagues/RuaTabela';
import { L, LOCALE } from '@/i18n/L';

const PER_PAGE = 25;

type RankingTabId = 'mundial' | 'nacional' | 'estadual';

/** Linha da aba Mundial (times reais da Liga Global). Mesma forma da
 *  LeagueScopeRankingEntry + a divisão pra badge. */
type MundialEntry = {
  team: string;
  /** = índice composto (reusa o render da coluna existente). */
  points: number;
  isMe: boolean;
  entryId: string;
  division?: number;
  /** Componentes do índice (pontos + força + engajamento) pro detalhe. */
  breakdown?: { points: number; overall: number; engagement: number };
};
type AnyRankRow = MundialEntry | LeagueScopeRankingEntry;

const TAB_OPTIONS: { id: RankingTabId; label: string }[] = [
  { id: 'mundial', label: L('Mundial', 'World') },
  { id: 'nacional', label: L(LEAGUE_SCOPE_LABELS.national, 'National') },
  { id: 'estadual', label: L(LEAGUE_SCOPE_LABELS.state, 'State') },
];

const TAB_META: Record<RankingTabId, { icon: typeof Trophy; title: string; subtitle: string }> = {
  mundial: {
    icon: Trophy,
    title: L('Mundial', 'World'),
    subtitle: L('Índice: média de pontos da temporada, força e engajamento', 'Index: average of season points, strength and engagement'),
  },
  nacional: {
    icon: TrendingUp,
    title: L('Nacional', 'National'),
    subtitle: L('Soma de pontos nas competições nacionais', 'Total points in national competitions'),
  },
  estadual: {
    icon: Award,
    title: L('Estadual', 'State'),
    subtitle: L('Soma de pontos nas competições estaduais', 'Total points in state competitions'),
  },
};

/**
 * Formata números grandes de forma inteligente:
 * - 1.000.000+ → "10M", "1.5M"
 * - 100.000+ → "100K", "250K"
 * - < 100.000 → "99.999", "1.234"
 */
function formatExpSmart(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.floor(m)}M` : `${L(m.toFixed(1).replace('.', ','), m.toFixed(1))}M`;
  }
  if (n >= 100_000) {
    return `${Math.floor(n / 1000)}K`;
  }
  return n.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

function parseTab(raw: string | null): RankingTabId {
  if (raw === 'estadual' || raw === 'nacional' || raw === 'mundial') return raw;
  return 'mundial';
}

export function RankingFull() {
  const club = useGameStore((s) => s.club);
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const favoriteRealTeam = useGameStore((s) => s.userSettings.favoriteRealTeam);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const { favorites, toggleFavorite } = useRankingFavorites();

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTeam, setSelectedTeam] = useState<(AnyRankRow & { globalRank: number }) | null>(null);

  useEffect(() => {
    const heart = searchParams.get('heart');
    if (heart !== '1') return;
    const name = favoriteRealTeam?.name?.trim();
    if (name) setSearch(name);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('heart');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, favoriteRealTeam?.name, setSearchParams]);

  // Aba Mundial = times REAIS da Liga Global, ordenados pelo ÍNDICE COMPOSTO
  // (média de pontos da temporada + força + engajamento). O "meu time" casa
  // pelo mesmo critério do resto do app (email do manager).
  const managerId = managerProfile?.email ?? club.id;
  const mundialEntries = useMemo<MundialEntry[]>(() => {
    const real = getGlobalLeagueRankingEntries(globalLeagueMVP?.teams, managerId, club.id);
    if (real.length > 0) {
      return real.map((r) => ({
        team: r.team,
        points: r.score,
        isMe: r.isMe,
        entryId: r.entryId,
        division: r.division,
        breakdown: { points: r.points, overall: r.overall, engagement: r.engagement },
      }));
    }
    // Fallback: liga ainda não carregou → mostra ao menos o próprio clube.
    return [{ team: club.name, points: 0, isMe: true, entryId: club.id }];
  }, [globalLeagueMVP, managerId, club.name, club.id]);

  const nacionalEntries = useMemo(
    () => getLeagueScopeRankingEntries(adminLeagues, 'national', club.name, club.shortName, leagueSeason),
    [adminLeagues, club.name, club.shortName, leagueSeason],
  );

  const estadualEntries = useMemo(
    () => getLeagueScopeRankingEntries(adminLeagues, 'state', club.name, club.shortName, leagueSeason),
    [adminLeagues, club.name, club.shortName, leagueSeason],
  );

  const activeList =
    tab === 'mundial' ? mundialEntries : tab === 'nacional' ? nacionalEntries : estadualEntries;

  type RowWithRank = AnyRankRow & { globalRank: number };

  const withGlobalRank = useMemo<RowWithRank[]>(
    () => activeList.map((row, i) => ({ ...row, globalRank: i + 1 })),
    [activeList],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withGlobalRank;
    return withGlobalRank.filter((r) => r.team.toLowerCase().includes(q));
  }, [withGlobalRank, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page, totalPages]);

  const setSearchAndResetPage = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const setTab = (id: RankingTabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === 'mundial') next.delete('tab');
        else next.set('tab', id);
        return next;
      },
      { replace: true },
    );
    setPage(1);
  };

  const meta = TAB_META[tab];

  const fmtValor = (n: number) =>
    tab === 'mundial' ? n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : formatExpSmart(n);

  // DS 2027: "quanto falta" — distância real do meu time pra linha de cima.
  const meIdx = withGlobalRank.findIndex((r) => r.isMe);
  const meRow = meIdx >= 0 ? withGlobalRank[meIdx] : null;
  const aboveRow = meIdx > 0 ? withGlobalRank[meIdx - 1] : null;
  const gap = meRow && aboveRow ? Math.max(0, Math.round((aboveRow.points - meRow.points) * 10) / 10) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 overflow-x-hidden pb-8 px-3 sm:px-4">
      <BackButton to="/competicao" label={L('Competição', 'Competition')} />

      <FitaRua tags={['#ranking', '#respeitoéouro']} className="-mx-3 sm:-mx-4" />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-6">
        <CabecalhoRua rotulo={`#ranking · ${meta.title}`} titulo={L('Quanto falta pra subir', 'How far to go up')}>
          <p className="max-w-md font-prova text-[11px] uppercase leading-snug tracking-[0.12em] text-mudo">{meta.subtitle}</p>
        </CabecalhoRua>

        <AbasRua ariaLabel="Ranking" ativa={tab} onChange={setTab} abas={TAB_OPTIONS} />

        {meRow && (
          gap != null && aboveRow ? (
            <FaltaRua
              valor={gap}
              unidade={tab === 'mundial' ? L('de índice', 'index') : L('pts', 'pts')}
              frase={L(`é o que separa tu do ${posRua(aboveRow.globalRank)}.`, `is all that's between you and ${posRua(aboveRow.globalRank)}.`)}
            />
          ) : meIdx === 0 && withGlobalRank.length > 1 ? (
            <div className="flex flex-col gap-1">
              <span className="font-spray font-black uppercase leading-[0.85] text-ouro-27" style={{ fontSize: 'clamp(60px, 18vw, 104px)' }}>#01</span>
              <span className="font-impact text-[clamp(17px,4.6vw,24px)] uppercase leading-tight text-papel">
                {L('Ninguém na frente. Segura.', 'Nobody ahead. Hold it.')}
              </span>
            </div>
          ) : null
        )}

        {/* Busca — input em concreto, foco em rua. */}
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mudo" />
          <input
            value={search}
            onChange={(e) => setSearchAndResetPage(e.target.value)}
            placeholder={L('Buscar time', 'Search team')}
            className="h-12 w-full border-2 border-linha bg-concreto px-9 font-prova text-[13px] uppercase tracking-[0.08em] text-papel transition-colors placeholder:text-mudo focus:border-rua focus:outline-none"
            aria-label={L('Buscar time no ranking', 'Search team in ranking')}
          />
        </div>

        {/* Tabela — linhas em concreto; líder no fio de ouro; meu time colado torto. */}
        <div className="flex min-w-0 flex-col gap-3">
          <SecaoRua
            label={tab === 'mundial' ? L('Equipe · índice', 'Team · index') : L('Equipe · pontos', 'Team · points')}
            aside={`${filtered.length}`}
          />
          {pageSlice.length === 0 ? (
            <VazioRua
              titulo={tab === 'mundial' ? L('Carregando a Liga Global…', 'Loading the Global League…') : L('Nenhuma liga nesta aba', 'No leagues in this tab')}
            />
          ) : (
            <div className="flex min-w-0 flex-col gap-1.5">
              {pageSlice.map((row) => {
                const fav = favorites.has(row.team);
                return (
                  <div key={`${row.team}-${row.globalRank}`} className="flex min-w-0 items-center gap-1.5">
                    <LinhaRua
                      className="min-w-0 grow"
                      pos={row.globalRank}
                      tom={row.isMe ? 'eu' : row.globalRank === 1 ? 'lider' : row.globalRank <= 3 ? 'zona' : meIdx >= 0 && row.globalRank - 1 > meIdx ? 'abaixo' : 'normal'}
                      nome={row.team}
                      onClick={() => setSelectedTeam(row)}
                      ariaLabel={L(`Detalhes de ${row.team}`, `Details for ${row.team}`)}
                      chip={
                        'division' in row && row.division ? (
                          <span className={cn('shrink-0 font-prova text-[10px] font-bold tracking-[0.12em]', row.isMe ? 'text-asfalto-27/70' : 'text-mudo')}>
                            D{row.division}
                          </span>
                        ) : null
                      }
                      valor={fmtValor(row.points)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleFavorite(row.team)}
                      className={cn(
                        'grid h-[50px] w-11 shrink-0 place-items-center border-2 transition-colors',
                        fav ? 'border-ouro-27 text-ouro-27' : 'border-linha text-mudo hover:border-papel hover:text-papel',
                      )}
                      aria-label={fav ? L('Remover dos favoritos', 'Remove from favorites') : L('Marcar favorito', 'Add to favorites')}
                    >
                      <Star className={cn('h-4 w-4', fav && 'fill-ouro-27')} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t-2 border-linha pt-4">
            <span className="font-spray text-[26px] font-black leading-none text-papel">
              {safePage}/{totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  'inline-flex h-11 items-center gap-1 whitespace-nowrap border-2 px-3 font-impact text-[15px] uppercase transition-colors',
                  safePage <= 1 ? 'cursor-not-allowed border-linha text-fio' : 'border-papel text-papel hover:bg-papel hover:text-asfalto-27',
                )}
              >
                <ChevronLeft aria-hidden className="h-4 w-4" />
                {L('Anterior', 'Previous')}
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  'inline-flex h-11 items-center gap-1 whitespace-nowrap border-2 px-3 font-impact text-[15px] uppercase transition-colors',
                  safePage >= totalPages ? 'cursor-not-allowed border-linha text-fio' : 'border-papel text-papel hover:bg-papel hover:text-asfalto-27',
                )}
              >
                {L('Próxima', 'Next')}
                <ChevronRight aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal de detalhes do time — ficha em concreto. */}
      {selectedTeam && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 p-4 sm:items-center"
          onClick={() => setSelectedTeam(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="rua-grao flex w-full max-w-md flex-col gap-5 bg-concreto p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn('font-spray text-[40px] font-black leading-none', selectedTeam.globalRank === 1 ? 'text-ouro-27' : 'text-papel')}>
                  {posRua(selectedTeam.globalRank)}
                </span>
                {selectedTeam.isMe && <SeloRua tom="corre">{L('Teu time', 'Your team')}</SeloRua>}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="grid h-10 w-10 place-items-center text-mudo transition-colors hover:text-papel"
                aria-label={L('Fechar', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-impact uppercase leading-[0.9] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(30px, 8vw, 42px)' }}>
                {selectedTeam.team}
              </h2>
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                — {tab === 'mundial' ? L('Ranking Mundial', 'World Ranking') : tab === 'nacional' ? L('Ranking Nacional', 'National Ranking') : L('Ranking Estadual', 'State Ranking')}
              </span>
            </div>

            <div className="flex flex-col gap-3 border-2 border-ouro-27 bg-asfalto-27 p-4">
              <span className="flex items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
                <Trophy aria-hidden className="h-4 w-4 text-ouro-27" />
                {tab === 'mundial' ? L('Índice', 'Index') : L('Pontos', 'Points')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-spray font-black leading-none text-ouro-27" style={{ fontSize: 'clamp(44px, 12vw, 60px)' }}>
                  {tab === 'mundial'
                    ? selectedTeam.points.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : selectedTeam.points.toLocaleString(LOCALE)}
                </span>
                <span className="font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{tab === 'mundial' ? '/ 100' : 'pts'}</span>
              </div>
              {/* Componentes do índice (só na aba Mundial). */}
              {'breakdown' in selectedTeam && selectedTeam.breakdown && (
                <div className="grid grid-cols-3 gap-1.5 border-t-2 border-linha pt-3">
                  {([
                    [L('Pontos', 'Points'), selectedTeam.breakdown.points],
                    [L('Força', 'Strength'), selectedTeam.breakdown.overall],
                    [L('Engaj.', 'Engag.'), selectedTeam.breakdown.engagement],
                  ] as [string, number][]).map(([label, val]) => (
                    <div key={label} className="flex flex-col">
                      <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{label}</span>
                      <span className="font-impact text-[22px] leading-none text-papel">{Math.round(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diferença para o líder (se não for #1) */}
            {selectedTeam.globalRank > 1 && (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
                  <TrendingUp aria-hidden className="h-4 w-4" />
                  {L('Falta pro líder', 'Gap to leader')}
                </span>
                <span className="font-spray text-[34px] font-black leading-none text-rua">
                  {(() => {
                    const leader = withGlobalRank[0];
                    if (!leader) return '—';
                    const diff = leader.points - selectedTeam.points;
                    return tab === 'mundial'
                      ? L(`${diff.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de índice`, `${diff.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} index`)
                      : `${diff.toLocaleString(LOCALE)} pts`;
                  })()}
                </span>
              </div>
            )}

            <BotaoRua
              variante={favorites.has(selectedTeam.team) ? 'ouro' : 'contorno'}
              onClick={() => toggleFavorite(selectedTeam.team)}
              className="w-full"
            >
              <Star aria-hidden className={cn('h-4 w-4', favorites.has(selectedTeam.team) && 'fill-asfalto-27')} />
              {favorites.has(selectedTeam.team) ? L('Favoritado', 'Favorited') : L('Favoritar', 'Favorite')}
            </BotaoRua>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

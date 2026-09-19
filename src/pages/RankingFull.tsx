import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Star, Trophy, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import type { LeagueScopeRankingEntry } from '@/ranking/leagueScopeRanking';
import { getLeagueScopeRankingEntries } from '@/ranking/leagueScopeRanking';
import { getGlobalLeagueRankingEntries } from '@/ranking/globalLeagueRanking';
import { useRankingFavorites } from '@/ranking/useRankingFavorites';
import { LEAGUE_SCOPE_LABELS } from '@/match/adminLeagues';
import { BackButton } from '@/components/BackButton';
import { Hashtag } from '@/components/ui';

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
  { id: 'mundial', label: 'Mundial' },
  { id: 'nacional', label: LEAGUE_SCOPE_LABELS.national },
  { id: 'estadual', label: LEAGUE_SCOPE_LABELS.state },
];

const TAB_META: Record<RankingTabId, { icon: typeof Trophy; title: string; subtitle: string }> = {
  mundial: {
    icon: Trophy,
    title: 'Mundial',
    subtitle: 'Índice: média de pontos da temporada, força e engajamento',
  },
  nacional: {
    icon: TrendingUp,
    title: 'Nacional',
    subtitle: 'Soma de pontos nas competições nacionais',
  },
  estadual: {
    icon: Award,
    title: 'Estadual',
    subtitle: 'Soma de pontos nas competições estaduais',
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
    return m >= 10 ? `${Math.floor(m)}M` : `${m.toFixed(1).replace('.', ',')}M`;
  }
  if (n >= 100_000) {
    return `${Math.floor(n / 1000)}K`;
  }
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
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

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 pb-8">
      <BackButton to="/competicao" label="Competição" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-white/10 bg-panel overflow-hidden"
      >
        {/* Header */}
        <div className="bg-deep-black p-6 md:p-8 border-b border-white/10">
          <Hashtag className="mb-3 text-neon-yellow">#ranking</Hashtag>
          <h1 className="leading-[1.1]">
            <span
              className="block font-impact uppercase text-white"
              style={{
                fontSize: 'clamp(2rem, 5.5vw, 3.5rem)',
                letterSpacing: '0.005em',
              }}
            >
              Ranking
            </span>
            <span
              className="ole-num block uppercase text-neon-yellow mt-1"
              style={{ fontSize: 'clamp(1.2rem, 3.6vw, 2rem)' }}
            >
              {meta.title}
            </span>
          </h1>
          <p className="mt-4 max-w-md font-mono text-[11px] leading-snug text-cimento">
            {meta.subtitle}
          </p>
        </div>

        {/* Tabs */}
        <div className="p-4 border-b border-white/10 flex flex-wrap gap-2">
          {TAB_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'ole-num h-10 whitespace-nowrap px-3 border text-[12px] uppercase transition-colors',
                tab === t.id
                  ? 'border-neon-yellow bg-neon-yellow text-black'
                  : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 text-poeira absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearchAndResetPage(e.target.value)}
              placeholder="Buscar time"
              className="w-full bg-deep-black border border-white/10 text-white placeholder:text-poeira px-9 py-2.5 text-sm transition-colors focus:border-neon-yellow/50 focus:outline-none"
              aria-label="Buscar time no ranking"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="ole-table">
            <thead>
              <tr>
                <th style={{ width: '3.5rem' }} className="text-center">#</th>
                <th>Equipe</th>
                <th style={{ width: '8rem' }} className="text-center">
                  {tab === 'mundial' ? 'Índice' : 'Pontos'}
                </th>
                <th style={{ width: '3rem' }} className="text-center">★</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">
                    <p className="font-mono text-[12px] text-cimento">
                      {tab === 'mundial'
                        ? 'Carregando a Liga Global…'
                        : 'Nenhuma liga nesta aba.'}
                    </p>
                  </td>
                </tr>
              ) : (
                pageSlice.map((row) => (
                  <tr
                    key={`${row.team}-${row.globalRank}`}
                    data-is-user={row.isMe ? 'true' : undefined}
                    className={row.isMe ? '!bg-neon-yellow text-black' : undefined}
                  >
                    <td className="text-center">
                      <span
                        className={cn(
                          'ole-num text-[15px]',
                          row.isMe ? 'text-black' : row.globalRank <= 3 ? 'text-white' : 'text-cimento',
                        )}
                      >
                        {row.globalRank}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedTeam(row)}
                        className="flex w-full min-w-0 items-center gap-2 text-left transition-opacity hover:opacity-80"
                      >
                        <span
                          className={cn(
                            'min-w-0 truncate text-[14px] sm:text-[15px]',
                            row.isMe ? 'font-bold text-black' : 'text-giz',
                          )}
                        >
                          {row.team}
                        </span>
                        {'division' in row && row.division && (
                          <span
                            className={cn(
                              'shrink-0 border px-[5px] py-0.5 font-mono text-[9.5px] tracking-[0.12em]',
                              row.isMe ? 'border-black/40 text-black' : 'border-white/16 text-cimento',
                            )}
                          >
                            D{row.division}
                          </span>
                        )}
                        {row.isMe && (
                          <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black/70">
                            você
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="text-center">
                      <span
                        className={cn(
                          'ole-num text-[16px]',
                          row.isMe ? 'text-black' : 'text-white',
                        )}
                      >
                        {tab === 'mundial'
                          ? row.points.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                          : formatExpSmart(row.points)}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(row.team)}
                        className={cn(
                          'p-1.5 border shrink-0 transition-colors',
                          row.isMe
                            ? favorites.has(row.team)
                              ? 'border-black text-black'
                              : 'border-black/30 text-black/60 hover:border-black'
                            : favorites.has(row.team)
                              ? 'border-neon-yellow text-neon-yellow'
                              : 'border-white/16 text-poeira hover:border-white/30 hover:text-white',
                        )}
                        aria-label={favorites.has(row.team) ? 'Remover dos favoritos' : 'Marcar favorito'}
                      >
                        <Star
                          className={cn(
                            'w-4 h-4',
                            favorites.has(row.team) && (row.isMe ? 'fill-black' : 'fill-neon-yellow'),
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 bg-deep-black">
            <span className="ole-num text-[13px] text-cimento">
              {safePage}/{totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  'ole-num inline-flex h-10 items-center gap-1 whitespace-nowrap px-3 border text-[11px] uppercase transition-colors',
                  safePage <= 1
                    ? 'border-white/10 text-poeira cursor-not-allowed'
                    : 'border-white/30 text-white hover:border-white hover:bg-white/5',
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  'ole-num inline-flex h-10 items-center gap-1 whitespace-nowrap px-3 border text-[11px] uppercase transition-colors',
                  safePage >= totalPages
                    ? 'border-white/10 text-poeira cursor-not-allowed'
                    : 'border-white/30 text-white hover:border-white hover:bg-white/5',
                )}
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal de detalhes do time */}
      {selectedTeam && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 p-4"
          onClick={() => setSelectedTeam(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-white/10 bg-panel overflow-hidden"
          >
            {/* Header */}
            <div className="bg-deep-black p-5 border-b border-white/10">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="ole-num text-[18px] text-white">
                    {selectedTeam.globalRank}º
                  </span>
                  {selectedTeam.isMe && (
                    <span className="bg-neon-yellow px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black">
                      Seu time
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="text-cimento hover:text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <h2
                className="truncate font-impact uppercase text-white leading-[1.1] mb-1"
                style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}
              >
                {selectedTeam.team}
              </h2>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cimento">
                {tab === 'mundial' ? 'Ranking Mundial' : tab === 'nacional' ? 'Ranking Nacional' : 'Ranking Estadual'}
              </p>
            </div>

            {/* Stats */}
            <div className="p-5 space-y-4">
              {/* EXP/Pontos exato */}
              <div className="bg-deep-black p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-neon-yellow" />
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-cimento">
                    {tab === 'mundial' ? 'Índice' : 'Pontos'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="ole-num text-neon-yellow"
                    style={{ fontSize: 'clamp(1.8rem, 5.5vw, 2.6rem)' }}
                  >
                    {tab === 'mundial'
                      ? selectedTeam.points.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                      : selectedTeam.points.toLocaleString('pt-BR')}
                  </span>
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-cimento">
                    {tab === 'mundial' ? '/ 100' : 'pts'}
                  </span>
                </div>
                {/* Componentes do índice (só na aba Mundial). */}
                {'breakdown' in selectedTeam && selectedTeam.breakdown && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                    {([
                      ['Pontos', selectedTeam.breakdown.points],
                      ['Força', selectedTeam.breakdown.overall],
                      ['Engaj.', selectedTeam.breakdown.engagement],
                    ] as [string, number][]).map(([label, val]) => (
                      <div key={label} className="flex flex-col">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-cimento">{label}</span>
                        <span className="ole-num text-[17px] text-white">{Math.round(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Diferença para o líder (se não for #1) */}
              {selectedTeam.globalRank > 1 && (
                <div className="bg-deep-black p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-cimento" />
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-cimento">
                      Diferença para o líder
                    </span>
                  </div>
                  <span className="ole-num text-[17px] text-giz">
                    {(() => {
                      const leader = withGlobalRank[0];
                      if (!leader) return '—';
                      const diff = leader.points - selectedTeam.points;
                      return tab === 'mundial'
                        ? `${diff.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de índice`
                        : `${diff.toLocaleString('pt-BR')} pts`;
                    })()}
                  </span>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleFavorite(selectedTeam.team);
                  }}
                  className={cn(
                    'ole-num flex-1 flex h-[50px] items-center justify-center gap-2 border text-[13px] uppercase transition-colors',
                    favorites.has(selectedTeam.team)
                      ? 'border-neon-yellow text-neon-yellow'
                      : 'border-white/30 text-white hover:border-white hover:bg-white/5',
                  )}
                >
                  <Star className={cn('w-4 h-4', favorites.has(selectedTeam.team) && 'fill-neon-yellow')} />
                  {favorites.has(selectedTeam.team) ? 'Favoritado' : 'Favoritar'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Star, Trophy, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { getFullRankingEntries, type RankingEntry } from '@/ranking/worldRanking';
import type { LeagueScopeRankingEntry } from '@/ranking/leagueScopeRanking';
import { getLeagueScopeRankingEntries } from '@/ranking/leagueScopeRanking';
import { useRankingFavorites } from '@/ranking/useRankingFavorites';
import { LEAGUE_SCOPE_LABELS } from '@/match/adminLeagues';
import { BackButton } from '@/components/BackButton';

const PER_PAGE = 25;

type RankingTabId = 'mundial' | 'nacional' | 'estadual';

const TAB_OPTIONS: { id: RankingTabId; label: string }[] = [
  { id: 'mundial', label: 'Mundial (OLE)' },
  { id: 'nacional', label: LEAGUE_SCOPE_LABELS.national },
  { id: 'estadual', label: LEAGUE_SCOPE_LABELS.state },
];

const TAB_META: Record<RankingTabId, { icon: typeof Trophy; title: string; subtitle: string }> = {
  mundial: {
    icon: Trophy,
    title: 'Global',
    subtitle: 'Ordenação mundial por saldo EXP.',
  },
  nacional: {
    icon: TrendingUp,
    title: 'Nacional',
    subtitle: 'Soma de pontos em competições nacionais.',
  },
  estadual: {
    icon: Award,
    title: 'Estadual',
    subtitle: 'Soma de pontos em competições estaduais.',
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
  const finance = useGameStore((s) => s.finance);
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const favoriteRealTeam = useGameStore((s) => s.userSettings.favoriteRealTeam);
  const { favorites, toggleFavorite } = useRankingFavorites();

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTeam, setSelectedTeam] = useState<(RankingEntry | LeagueScopeRankingEntry) & { globalRank: number } | null>(null);

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

  const mundialEntries = useMemo(
    () => getFullRankingEntries(club.name, finance.ole, club.id),
    [club.name, finance.ole, club.id],
  );

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

  type RowWithRank = (RankingEntry | LeagueScopeRankingEntry) & { globalRank: number };

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
        className="border border-white/10 bg-dark-gray overflow-hidden"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {/* Header — Sprint B-3 Legacy Tech: eyebrow + headline duo + régua */}
        <div className="bg-black/40 p-6 md:p-8 border-b border-[var(--color-divider-yellow)]">
          <div
            className="font-display font-bold uppercase text-neon-yellow/80 mb-3"
            style={{ fontSize: '10px', letterSpacing: '0.28em' }}
          >
            OLE Football · Ranking
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
              Ranking
            </span>
            <span
              className="block italic text-neon-yellow mt-1"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {meta.title}
            </span>
          </h1>
          <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-5" />
          <p
            className="text-white/55 max-w-md mt-4"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
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
                'px-3 py-2 border transition-colors',
                tab === t.id
                  ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                  : 'border-white/15 text-white/55 hover:border-white/25 hover:text-white/85',
              )}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearchAndResetPage(e.target.value)}
              placeholder="Buscar time"
              className="w-full bg-black/40 border border-white/10 text-white placeholder:text-white/40 px-9 py-2.5 text-sm transition-colors focus:border-neon-yellow/40 focus:outline-none"
              style={{
                fontFamily: 'var(--font-ui)',
                borderRadius: 'var(--radius-sm)',
              }}
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
                  {tab === 'mundial' ? 'EXP' : 'Pontos'}
                </th>
                <th style={{ width: '3rem' }} className="text-center">★</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">
                    <p
                      className="italic text-white/40"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontSize: '15px',
                      }}
                    >
                      {tab === 'mundial'
                        ? '"nenhum time encontrado."'
                        : '"configura ligas no /admin."'}
                    </p>
                  </td>
                </tr>
              ) : (
                pageSlice.map((row) => (
                  <tr key={`${row.team}-${row.globalRank}`} data-is-user={row.isMe ? 'true' : undefined}>
                    <td className="text-center">
                      <span className="ole-table__pos" data-rank={row.globalRank <= 3 ? row.globalRank : undefined}>
                        #{row.globalRank}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedTeam(row)}
                        className="text-left w-full hover:opacity-80 transition-opacity"
                      >
                        <span
                          className={cn(
                            'truncate uppercase',
                            row.isMe ? 'text-neon-yellow' : 'text-white',
                          )}
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(15px, 2vw, 18px)',
                            fontWeight: 900,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {row.team}
                        </span>
                        {row.isMe && (
                          <span
                            className="ml-2 text-neon-yellow/70"
                            style={{
                              fontFamily: 'var(--font-ui)',
                              fontSize: '10px',
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                            }}
                          >
                            você
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="text-center">
                      <span
                        className={cn(
                          'italic tabular-nums',
                          row.isMe ? 'text-neon-yellow' : 'text-white',
                        )}
                        style={{
                          fontFamily: 'var(--font-serif-hero)',
                          fontSize: '18px',
                          fontWeight: 700,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {'exp' in row ? formatExpSmart(row.exp) : row.points}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(row.team)}
                        className={cn(
                          'p-1.5 border shrink-0 transition-colors',
                          favorites.has(row.team)
                            ? 'border-neon-yellow text-neon-yellow'
                            : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-white/70',
                        )}
                        style={{ borderRadius: 'var(--radius-sm)' }}
                        aria-label={favorites.has(row.team) ? 'Remover dos favoritos' : 'Marcar favorito'}
                      >
                        <Star className={cn('w-4 h-4', favorites.has(row.team) && 'fill-neon-yellow')} />
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
          <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 bg-black/30">
            <span
              className="text-white/40 tabular-nums"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: '13px',
                fontStyle: 'italic',
              }}
            >
              {safePage}/{totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-2 border transition-colors',
                  safePage <= 1
                    ? 'border-white/10 text-gray-600 cursor-not-allowed'
                    : 'border-white/20 text-white hover:bg-white/10',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-2 border transition-colors',
                  safePage >= totalPages
                    ? 'border-white/10 text-gray-600 cursor-not-allowed'
                    : 'border-white/20 text-white hover:bg-white/10',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Seguinte
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedTeam(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-white/10 bg-dark-gray overflow-hidden"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {/* Header */}
            <div className="bg-black/40 p-5 border-b border-white/10">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="ole-table__pos"
                    data-rank={selectedTeam.globalRank <= 3 ? selectedTeam.globalRank : undefined}
                  >
                    #{selectedTeam.globalRank}
                  </span>
                  {selectedTeam.isMe && (
                    <span
                      className="inline-flex items-center gap-1.5 border border-neon-yellow bg-neon-yellow/15 text-neon-yellow px-2 py-1"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      Seu time
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <h2
                className="uppercase text-white leading-tight mb-1"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                  fontWeight: 900,
                  letterSpacing: '0.01em',
                }}
              >
                {selectedTeam.team}
              </h2>
              <p
                className="text-white/50"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                {tab === 'mundial' ? 'Ranking Mundial' : tab === 'nacional' ? 'Ranking Nacional' : 'Ranking Estadual'}
              </p>
            </div>

            {/* Stats */}
            <div className="p-5 space-y-4">
              {/* EXP/Pontos exato */}
              <div className="bg-black/40 p-4 border border-white/10" style={{ borderRadius: 'var(--radius-sm)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-neon-yellow" />
                  <span
                    className="text-white/50 uppercase"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      fontWeight: 600,
                    }}
                  >
                    {tab === 'mundial' ? 'EXP Total' : 'Pontos'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="italic text-neon-yellow tabular-nums"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontSize: 'clamp(2rem, 6vw, 3rem)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {'exp' in selectedTeam
                      ? selectedTeam.exp.toLocaleString('pt-BR')
                      : selectedTeam.points.toLocaleString('pt-BR')}
                  </span>
                  <span
                    className="text-white/40 uppercase"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '12px',
                      letterSpacing: '0.18em',
                    }}
                  >
                    {'exp' in selectedTeam ? 'EXP' : 'pts'}
                  </span>
                </div>
              </div>

              {/* Diferença para o líder (se não for #1) */}
              {selectedTeam.globalRank > 1 && (
                <div className="bg-black/20 p-4 border border-white/8" style={{ borderRadius: 'var(--radius-sm)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-white/50" />
                    <span
                      className="text-white/50 uppercase"
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '10px',
                        letterSpacing: '0.22em',
                        fontWeight: 600,
                      }}
                    >
                      Diferença para o líder
                    </span>
                  </div>
                  <span
                    className="italic text-white/70 tabular-nums"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontSize: '18px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {(() => {
                      const leader = withGlobalRank[0];
                      if (!leader) return '—';
                      const diff =
                        'exp' in selectedTeam && 'exp' in leader
                          ? leader.exp - selectedTeam.exp
                          : 'points' in selectedTeam && 'points' in leader
                            ? leader.points - selectedTeam.points
                            : 0;
                      return `${diff.toLocaleString('pt-BR')} ${tab === 'mundial' ? 'EXP' : 'pts'}`;
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
                    'flex-1 flex items-center justify-center gap-2 py-3 border transition-colors',
                    favorites.has(selectedTeam.team)
                      ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                      : 'border-white/15 text-white/70 hover:border-white/25 hover:text-white',
                  )}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
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

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Star, Trophy, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { getFullRankingEntries, type RankingEntry } from '@/ranking/worldRanking';
import type { LeagueScopeRankingEntry } from '@/ranking/leagueScopeRanking';
import { getLeagueScopeRankingEntries } from '@/ranking/leagueScopeRanking';
import { useRankingFavorites } from '@/ranking/useRankingFavorites';
import { LEAGUE_SCOPE_LABELS } from '@/match/adminLeagues';

const PER_PAGE = 25;

type RankingTabId = 'mundial' | 'nacional' | 'estadual';

const TAB_OPTIONS: { id: RankingTabId; label: string }[] = [
  { id: 'mundial', label: 'Mundial (OLE)' },
  { id: 'nacional', label: LEAGUE_SCOPE_LABELS.national },
  { id: 'estadual', label: LEAGUE_SCOPE_LABELS.state },
];

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

  const subtitle =
    tab === 'mundial'
      ? `Ordenação global por EXP (saldo). ${filtered.length} time${filtered.length !== 1 ? 's' : ''}${search.trim() ? ' na busca' : ''}.`
      : `Soma de pontos nas competições ${tab === 'nacional' ? 'nacionais' : 'estaduais'}. ${filtered.length} equipa${filtered.length !== 1 ? 's' : ''}${search.trim() ? ' na busca' : ''}.`;

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sports-panel p-0 overflow-hidden"
      >
        <div className="bg-dark-gray p-4 border-b border-white/10 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-display font-black text-2xl md:text-3xl uppercase tracking-wider text-white">
                Ranking OLE
              </h1>
              <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>
            </div>
            <span className="text-neon-yellow text-xs font-bold uppercase tracking-wider shrink-0">
              {PER_PAGE} por página
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TAB_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 font-display text-[10px] font-black uppercase tracking-wider sm:text-xs',
                  tab === t.id
                    ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                    : 'border-white/15 text-white/55 hover:border-white/25 hover:text-white/85',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearchAndResetPage(e.target.value)}
              placeholder="Buscar por nome do time"
              className="w-full bg-black/40 border border-white/10 rounded px-9 py-2.5 text-sm"
              aria-label="Buscar time no ranking"
            />
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {pageSlice.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              {tab === 'mundial'
                ? 'Nenhum time encontrado.'
                : 'Nenhuma equipa neste âmbito. Configura ligas no /admin ou troca de separador.'}
            </div>
          ) : (
            pageSlice.map((row) => (
              <div
                key={`${row.team}-${row.globalRank}`}
                className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
              >
                <div
                  className={cn(
                    'w-9 h-9 flex items-center justify-center text-xs font-display font-black rounded shrink-0',
                    row.globalRank <= 3 ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white',
                  )}
                >
                  {row.globalRank <= 3 ? <Trophy className="w-4 h-4" /> : `#${row.globalRank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm font-display font-bold truncate',
                      row.isMe ? 'text-neon-yellow' : 'text-white',
                    )}
                  >
                    {row.team} {row.isMe ? '(Você)' : ''}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {'exp' in row ? `${formatExp(row.exp)} EXP` : `${row.points} pts`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(row.team)}
                  className={cn(
                    'p-1.5 rounded border shrink-0',
                    favorites.has(row.team)
                      ? 'border-neon-yellow text-neon-yellow'
                      : 'border-white/10 text-gray-500',
                  )}
                  aria-label={favorites.has(row.team) ? 'Remover dos favoritos' : 'Marcar favorito'}
                >
                  <Star className={cn('w-4 h-4', favorites.has(row.team) && 'fill-neon-yellow')} />
                </button>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/30">
            <p className="text-[11px] text-gray-500 order-2 sm:order-1">
              Página {safePage} de {totalPages}
            </p>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-2 rounded border text-sm font-display font-bold uppercase tracking-wider transition-colors',
                  safePage <= 1
                    ? 'border-white/10 text-gray-600 cursor-not-allowed'
                    : 'border-white/20 text-white hover:bg-white/10',
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
                  'inline-flex items-center gap-1 px-3 py-2 rounded border text-sm font-display font-bold uppercase tracking-wider transition-colors',
                  safePage >= totalPages
                    ? 'border-white/10 text-gray-600 cursor-not-allowed'
                    : 'border-white/20 text-white hover:bg-white/10',
                )}
              >
                Seguinte
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

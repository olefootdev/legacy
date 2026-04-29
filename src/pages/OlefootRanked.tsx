/**
 * Liga OLEFOOT — Ranqueada (assíncrona, ELO).
 * Paralela à Liga LEGACY: partidas livres entre rodadas alimentam moral + rating.
 */

import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Activity, FlaskConical } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { BackButton } from '@/components/BackButton';
import type { OlefootLeaderboardRow, OlefootMatchRecord } from '@/olefootLeague/types';
import { cn } from '@/lib/utils';

function fmtRating(r: number): string {
  return Math.round(r).toString();
}

function fmtDelta(d: number): string {
  if (d > 0) return `+${Math.round(d)}`;
  return Math.round(d).toString();
}

function StandingsTable({ rows }: { rows: OlefootLeaderboardRow[] }) {
  return (
    <div className="sports-panel rounded-lg overflow-hidden">
      <div className="bg-deep-black border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-neon-yellow" />
          <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
            Tabela ELO
          </h3>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="text-left px-4 py-2 text-xs text-text-soft uppercase tracking-wider font-display">Pos</th>
              <th className="text-left px-4 py-2 text-xs text-text-soft uppercase tracking-wider font-display">Manager</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">P</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">J</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">V</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">E</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">D</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">GP</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">GC</th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">SG</th>
              <th className="text-right px-4 py-2 text-xs text-text-soft uppercase tracking-wider font-display">ELO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const sg = row.goalsFor - row.goalsAgainst;
              const top = idx < 3;
              return (
                <motion.tr
                  key={row.managerId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'font-serif-hero text-xl font-bold',
                          top ? 'text-neon-yellow' : 'text-white',
                        )}
                      >
                        {idx + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-display text-base font-bold text-white truncate">{row.managerName}</p>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-xl font-bold text-neon-yellow">{row.points}</span>
                  </td>
                  <td className="px-2 py-3 text-center"><span className="font-serif-hero text-base text-white">{row.matchesPlayed}</span></td>
                  <td className="px-2 py-3 text-center"><span className="font-serif-hero text-base text-neon-green">{row.wins}</span></td>
                  <td className="px-2 py-3 text-center"><span className="font-serif-hero text-base text-text-muted">{row.draws}</span></td>
                  <td className="px-2 py-3 text-center"><span className="font-serif-hero text-base text-red-500">{row.losses}</span></td>
                  <td className="px-2 py-3 text-center"><span className="font-serif-hero text-base text-white">{row.goalsFor}</span></td>
                  <td className="px-2 py-3 text-center"><span className="font-serif-hero text-base text-white">{row.goalsAgainst}</span></td>
                  <td className="px-2 py-3 text-center">
                    <span className={cn('font-serif-hero text-base', sg > 0 ? 'text-neon-green' : sg < 0 ? 'text-red-500' : 'text-text-muted')}>
                      {sg > 0 ? `+${sg}` : sg}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-serif-hero text-base font-bold text-neon-yellow">{fmtRating(row.rating)}</span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentMatches({ matches }: { matches: OlefootMatchRecord[] }) {
  if (matches.length === 0) return null;
  return (
    <section className="sports-panel rounded-lg overflow-hidden">
      <div className="bg-deep-black border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Activity className="w-5 h-5 text-neon-green" />
        <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
          Partidas recentes
        </h3>
      </div>
      <ul className="divide-y divide-white/5">
        {matches.slice(0, 10).map((m) => (
          <li key={m.matchId} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-bold text-white truncate uppercase">{m.homeManagerName}</p>
              <p className="text-xs text-text-muted">
                ELO <span className={cn('font-serif-hero', m.homeRatingDelta >= 0 ? 'text-neon-green' : 'text-red-500')}>
                  {fmtDelta(m.homeRatingDelta)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-deep-black rounded-md border border-white/5">
              <span className="font-serif-hero text-2xl font-bold text-neon-yellow">{m.homeGoals}</span>
              <span className="text-text-muted text-sm">×</span>
              <span className="font-serif-hero text-2xl font-bold text-neon-yellow">{m.awayGoals}</span>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="font-display text-sm font-bold text-white truncate uppercase">{m.awayManagerName}</p>
              <p className="text-xs text-text-muted">
                ELO <span className={cn('font-serif-hero', m.awayRatingDelta >= 0 ? 'text-neon-green' : 'text-red-500')}>
                  {fmtDelta(m.awayRatingDelta)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: 'yellow' | 'green' }) {
  return (
    <div className="sports-panel rounded-lg p-4">
      <p className="text-xs text-text-soft uppercase tracking-wider font-display">{label}</p>
      <p
        className={cn(
          'mt-1 font-serif-hero text-3xl font-bold',
          accent === 'green' ? 'text-neon-green' : 'text-neon-yellow',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function seedMockData(dispatch: (a: any) => void) {
  const managers = [
    { id: 'mgr_user', name: 'Você' },
    { id: 'mgr_arena', name: 'Arena FC' },
    { id: 'mgr_neon', name: 'Neon United' },
    { id: 'mgr_pixel', name: 'Pixel Atlético' },
    { id: 'mgr_olefoot', name: 'Olefoot Stars' },
    { id: 'mgr_legacy', name: 'Legacy Boys' },
    { id: 'mgr_meta', name: 'Meta Sports' },
    { id: 'mgr_velha', name: 'Guarda Velha' },
  ];
  const fixtures: Array<[number, number, number, number]> = [
    [0, 1, 3, 1], [2, 3, 2, 2], [4, 5, 0, 1], [6, 7, 4, 2],
    [0, 2, 1, 1], [3, 4, 2, 0], [5, 6, 3, 3], [7, 1, 0, 2],
    [0, 3, 2, 1], [1, 4, 1, 0], [2, 5, 0, 0], [6, 0, 1, 3],
    [4, 7, 2, 2], [3, 5, 1, 2], [1, 6, 3, 0], [2, 7, 1, 1],
    [0, 4, 4, 1], [5, 1, 0, 2], [7, 3, 1, 0], [6, 2, 2, 1],
  ];
  fixtures.forEach((f, i) => {
    const [hi, ai, hg, ag] = f;
    dispatch({
      type: 'OLEFOOT_RECORD_MATCH',
      matchId: `mock-${i}`,
      homeManagerId: managers[hi].id,
      awayManagerId: managers[ai].id,
      homeManagerName: managers[hi].name,
      awayManagerName: managers[ai].name,
      homeGoals: hg,
      awayGoals: ag,
      homePlayerIds: [],
      awayPlayerIds: [],
    });
  });
}

export default function OlefootRanked() {
  const dispatch = useGameDispatch();
  const ranked = useGameStore((s) => s.olefootRanked);
  const leaderboard = ranked?.leaderboard ?? [];
  const recent = ranked?.recentMatches ?? [];
  const isDev = import.meta.env.DEV;

  const myRow = leaderboard.find((r) => r.managerId === 'mgr_user');
  const totalMatches = ranked?.recentMatches.length ?? 0;
  const topRating = leaderboard[0]?.rating ?? 1200;

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl px-3 sm:px-4 lg:px-6 py-4 space-y-4 pb-28 md:pb-12">
      <BackButton to="/competicao" label="Competição" />

      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-neon-yellow/30 sports-panel"
        style={{ borderRadius: 'var(--radius-sm, 6px)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/55 to-black/85" aria-hidden />
        <div className="relative z-10 p-5">
          <div className="flex items-center gap-2 text-neon-yellow">
            <Trophy className="h-4 w-4 shrink-0" />
            <span className="font-display text-[10px] font-black uppercase tracking-[0.25em]">
              Liga OLEFOOT · Ranqueada
            </span>
          </div>
          <h1 className="ole-headline-italic mt-2 text-white" style={{ fontSize: 'clamp(28px, 7vw, 40px)' }}>
            Tabela ELO assíncrona
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Partidas livres entre rodadas <strong className="text-white">LEGACY</strong> alimentam moral e rating.
            Cada vitória sobe seu ELO e pontua na tabela.
          </p>
        </div>
      </motion.section>

      {/* STAT TILES */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Sua posição" value={myRow ? `#${leaderboard.findIndex((r) => r.managerId === 'mgr_user') + 1}` : '—'} />
        <StatTile label="Seu ELO" value={myRow ? fmtRating(myRow.rating) : '1200'} accent="green" />
        <StatTile label="Partidas" value={totalMatches} />
      </div>

      {/* TABLE */}
      {leaderboard.length === 0 ? (
        <div className="sports-panel rounded-lg p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-text-muted" />
          <p className="font-display text-sm font-bold text-white uppercase tracking-wider mb-2">
            Tabela vazia
          </p>
          <p className="text-sm text-text-soft">
            Nenhuma partida ranqueada disputada ainda.
          </p>
          {isDev && (
            <button
              onClick={() => seedMockData(dispatch)}
              className="mt-4 inline-flex items-center gap-2 bg-neon-yellow text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
            >
              <FlaskConical className="w-3 h-3" />
              Seed mock (dev)
            </button>
          )}
        </div>
      ) : (
        <>
          <StandingsTable rows={leaderboard} />
          <RecentMatches matches={recent} />
          {isDev && (
            <div className="text-center">
              <button
                onClick={() => seedMockData(dispatch)}
                className="inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="Adiciona +20 partidas mock"
              >
                <FlaskConical className="w-3 h-3" />
                Adicionar mais mock (dev)
              </button>
            </div>
          )}
        </>
      )}

      {/* Top rating context */}
      {leaderboard.length > 0 && (
        <p className="text-center text-xs text-text-muted font-display tracking-wide">
          Top ELO: <span className="text-neon-yellow font-serif-hero font-bold text-base">{fmtRating(topRating)}</span>
        </p>
      )}
    </div>
  );
}

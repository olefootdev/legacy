import { useGameStore } from '@/game/store';
import type { OlefootLeaderboardRow, OlefootMatchRecord } from '@/olefootLeague/types';

function fmtRating(r: number): string {
  return Math.round(r).toString();
}

function fmtDelta(d: number): string {
  if (d > 0) return `+${Math.round(d)}`;
  return Math.round(d).toString();
}

function LeaderboardTable({ rows }: { rows: OlefootLeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
        Nenhuma partida disputada ainda. Jogue uma partida ranqueada para entrar na tabela.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Manager</th>
            <th className="px-3 py-2 text-right">PTS</th>
            <th className="px-3 py-2 text-right">J</th>
            <th className="px-3 py-2 text-right">V</th>
            <th className="px-3 py-2 text-right">E</th>
            <th className="px-3 py-2 text-right">D</th>
            <th className="px-3 py-2 text-right">GP</th>
            <th className="px-3 py-2 text-right">GC</th>
            <th className="px-3 py-2 text-right">SG</th>
            <th className="px-3 py-2 text-right">ELO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.managerId} className="border-t border-zinc-800 hover:bg-zinc-900/40">
              <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-zinc-100">{row.managerName}</td>
              <td className="px-3 py-2 text-right font-bold text-emerald-400">{row.points}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.matchesPlayed}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.wins}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.draws}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.losses}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.goalsFor}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.goalsAgainst}</td>
              <td className="px-3 py-2 text-right text-zinc-300">{row.goalsFor - row.goalsAgainst}</td>
              <td className="px-3 py-2 text-right font-mono text-amber-400">{fmtRating(row.rating)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentMatches({ matches }: { matches: OlefootMatchRecord[] }) {
  if (matches.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Partidas recentes
      </h2>
      <div className="space-y-1">
        {matches.slice(0, 10).map((m) => (
          <div
            key={m.matchId}
            className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
          >
            <div className="flex-1 truncate text-zinc-200">{m.homeManagerName}</div>
            <div className="px-3 font-mono font-bold text-zinc-100">
              {m.homeGoals} : {m.awayGoals}
            </div>
            <div className="flex-1 truncate text-right text-zinc-200">{m.awayManagerName}</div>
            <div className="ml-3 w-24 text-right font-mono text-xs text-zinc-500">
              <span className={m.homeRatingDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {fmtDelta(m.homeRatingDelta)}
              </span>
              {' / '}
              <span className={m.awayRatingDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {fmtDelta(m.awayRatingDelta)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function OlefootRanked() {
  const ranked = useGameStore((s) => s.olefootRanked);
  const leaderboard = ranked?.leaderboard ?? [];
  const recent = ranked?.recentMatches ?? [];

  return (
    <div className="mx-auto max-w-4xl p-4">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-100">Liga OLEFOOT — Ranqueada</h1>
          <p className="text-sm text-zinc-400">
            Tabela ELO assíncrona. Partidas livres entre rodadas LEGACY alimentam moral e rating.
          </p>
        </header>
        <LeaderboardTable rows={leaderboard} />
        <RecentMatches matches={recent} />
    </div>
  );
}

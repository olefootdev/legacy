/**
 * Página /ligas-locais — mostra Liga Classic e Fast Liga lado a lado.
 * Cada tab mostra:
 *   1. Suas estatísticas (placar acumulado)
 *   2. Top 50 do leaderboard (puxado do manager_game_state via Supabase)
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, Zap, Layers } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { cn } from '@/lib/utils';
import {
  emptyLocalLeagueStanding,
  type LocalLeagueId,
  type LocalLeagueStanding,
} from '@/match/localLeagues';
import {
  fetchLocalLeagueLeaderboard,
  type LocalLeaderboardEntry,
} from '@/supabase/localLeaguesRanking';

const LEAGUE_META: Record<LocalLeagueId, { label: string; subtitle: string; icon: typeof Trophy }> = {
  classic: {
    label: 'Liga Classic',
    subtitle: 'Pontos somam toda vez que você joga uma partida CLASSIC (2D).',
    icon: Layers,
  },
  fast: {
    label: 'Fast Liga',
    subtitle: 'Pontos somam toda vez que você joga uma partida RÁPIDA.',
    icon: Zap,
  },
};

export default function LocalLeaguesPage() {
  const [tab, setTab] = useState<LocalLeagueId>('classic');
  const localLeagues = useGameStore((s) => s.localLeagues);
  const myStanding: LocalLeagueStanding = useMemo(
    () => localLeagues?.[tab] ?? emptyLocalLeagueStanding(),
    [localLeagues, tab],
  );

  const [leaderboard, setLeaderboard] = useState<LocalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLocalLeagueLeaderboard(tab, 50)
      .then((rows) => { if (!cancelled) setLeaderboard(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  const meta = LEAGUE_META[tab];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-deep-black text-white pb-16">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded hover:bg-white/5 text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-black uppercase tracking-wider text-lg">
            Ligas locais
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2">
          {(['classic', 'fast'] as const).map((id) => {
            const m = LEAGUE_META[id];
            const TabIcon = m.icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'py-3 rounded flex items-center justify-center gap-2 text-xs font-display font-bold uppercase border transition-all',
                  tab === id
                    ? 'bg-neon-yellow text-black border-neon-yellow'
                    : 'border-white/15 text-gray-400 hover:border-white/30',
                )}
              >
                <TabIcon className="w-4 h-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="border border-white/10 rounded bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-neon-yellow" />
              <h2 className="font-display font-bold uppercase tracking-wider text-sm">
                {meta.label}
              </h2>
            </div>
            <p className="text-xs text-gray-400">{meta.subtitle}</p>
          </div>

          {/* My stats */}
          <div className="border border-neon-yellow/30 rounded bg-black/40 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neon-yellow">
              Meu placar acumulado
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Jogos" value={myStanding.played} />
              <Stat label="Pontos" value={myStanding.points} highlight />
              <Stat label="V/E/D" value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
              <Stat label="Saldo" value={myStanding.goalsFor - myStanding.goalsAgainst} />
            </div>
            {myStanding.recentForm.length > 0 && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="uppercase tracking-wider text-gray-500">Forma:</span>
                <div className="flex gap-1">
                  {myStanding.recentForm.map((c, i) => (
                    <span
                      key={i}
                      className={cn(
                        'inline-block w-5 h-5 rounded-full text-[10px] font-bold leading-5 text-center',
                        c === 'W' && 'bg-emerald-500/30 text-emerald-300',
                        c === 'D' && 'bg-amber-500/30 text-amber-300',
                        c === 'L' && 'bg-red-500/30 text-red-300',
                      )}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="border border-white/10 rounded bg-black/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 mb-3">
              Top 50 managers
            </h3>
            {loading && (
              <p className="text-xs text-gray-500">Carregando ranking…</p>
            )}
            {!loading && leaderboard.length === 0 && (
              <p className="text-xs text-gray-500">
                Sem entradas ainda — jogue uma partida pra estrear no ranking.
              </p>
            )}
            {!loading && leaderboard.length > 0 && (
              <div className="space-y-1">
                {leaderboard.map((row, idx) => (
                  <div
                    key={row.userId}
                    className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
                  >
                    <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                    <span className="text-xs truncate">
                      {row.clubName ?? row.managerName ?? row.userId.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-gray-500 text-right">{row.played}j</span>
                    <span className="text-[10px] text-gray-400 text-right">
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </span>
                    <span className="text-xs font-bold text-neon-yellow text-right">
                      {row.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, small }: { label: string; value: number | string; highlight?: boolean; small?: boolean }) {
  return (
    <div className="border border-white/10 rounded py-2">
      <p className="text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={cn(
        'font-display font-bold mt-1',
        small ? 'text-sm' : 'text-lg',
        highlight ? 'text-neon-yellow' : 'text-white',
      )}>
        {value}
      </p>
    </div>
  );
}

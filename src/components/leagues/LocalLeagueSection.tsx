/**
 * Bloco inline da Liga Classic ou Fast Liga — exibe placar acumulado do
 * manager + Top 50 leaderboard. Usado em /competicao/ligas como conteúdo
 * principal das tabs "Liga Classic" / "Fast Liga".
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import {
  emptyLocalLeagueStanding,
  type LocalLeagueId,
  type LocalLeagueStanding,
} from '@/match/localLeagues';
import {
  fetchLocalLeagueLeaderboard,
  type LocalLeaderboardEntry,
} from '@/supabase/localLeaguesRanking';

const META: Record<LocalLeagueId, { title: string; subtitle: string; ctaLabel: string }> = {
  classic: {
    title: 'LIGA CLASSIC',
    subtitle: 'Pontos somam toda partida CLASSIC (2D tático).',
    ctaLabel: 'Jogar Classic',
  },
  fast: {
    title: 'FAST LIGA',
    subtitle: 'Pontos somam toda partida RÁPIDA.',
    ctaLabel: 'Jogar Rápida',
  },
};

interface Props {
  league: LocalLeagueId;
}

export function LocalLeagueSection({ league }: Props) {
  const localLeagues = useGameStore((s) => s.localLeagues);
  const myStanding: LocalLeagueStanding = useMemo(
    () => localLeagues?.[league] ?? emptyLocalLeagueStanding(),
    [localLeagues, league],
  );

  const [leaderboard, setLeaderboard] = useState<LocalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLocalLeagueLeaderboard(league, 50)
      .then((rows) => { if (!cancelled) setLeaderboard(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [league]);

  const meta = META[league];
  const ctaHref = league === 'classic' ? '/match/classic' : '/match/quick';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-white/10 bg-dark-gray overflow-hidden"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      {/* Header */}
      <div className="bg-black/40 p-6 md:p-7 border-b border-[var(--color-divider-yellow)]">
        <div
          className="font-display font-bold uppercase text-neon-yellow/80 mb-2"
          style={{ fontSize: '10px', letterSpacing: '0.28em' }}
        >
          Liga local · Cumulativa
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="leading-[0.95]">
            <span
              className="block font-bold uppercase text-white"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
                letterSpacing: '0.005em',
              }}
            >
              {meta.title}
            </span>
            <span
              className="block italic text-neon-yellow mt-0.5"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(1.25rem, 3.5vw, 2rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {myStanding.points} {myStanding.points === 1 ? 'ponto' : 'pontos'}
            </span>
          </h2>
          <Link
            to={ctaHref}
            className="inline-flex items-center rounded-[var(--radius-pill)] bg-neon-yellow text-black px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.22em] hover:opacity-90"
          >
            {meta.ctaLabel}
          </Link>
        </div>
        <p className="text-white/55 max-w-md mt-3" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.5 }}>
          {meta.subtitle}
        </p>
      </div>

      {/* Meu placar */}
      <div className="p-5 border-b border-white/10 space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
          Meu placar acumulado
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Jogos" value={myStanding.played} />
          <Stat label="Pontos" value={myStanding.points} highlight />
          <Stat label="V/E/D" value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
          <Stat label="Saldo" value={fmtDiff(myStanding.goalsFor - myStanding.goalsAgainst)} />
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
            {myStanding.bestStreak > 0 && (
              <span className="ml-auto text-gray-500">Melhor sequência: {myStanding.bestStreak}V</span>
            )}
          </div>
        )}
      </div>

      {/* Top 50 leaderboard */}
      <div className="p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3 flex items-center gap-2">
          <Trophy className="w-3 h-3 text-neon-yellow" /> Top 50 managers
        </h3>
        {loading && (
          <p className="text-xs text-gray-500">Carregando ranking…</p>
        )}
        {!loading && leaderboard.length === 0 && (
          <p className="text-xs text-gray-500">
            Ranking ainda vazio — joga uma partida e estreias no top.
          </p>
        )}
        {!loading && leaderboard.length > 0 && (
          <div className="space-y-0.5 max-h-[420px] overflow-y-auto">
            {leaderboard.map((row, idx) => (
              <div
                key={row.userId}
                className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
              >
                <span className={cn(
                  'text-xs font-bold',
                  idx === 0 ? 'text-neon-yellow' : 'text-gray-400',
                )}>{idx + 1}</span>
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
    </motion.section>
  );
}

function fmtDiff(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
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

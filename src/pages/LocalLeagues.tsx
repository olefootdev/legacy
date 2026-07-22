/**
 * Página /ligas-locais — mostra Liga Classic e Fast Liga lado a lado.
 * Cada tab mostra:
 *   1. Suas estatísticas (placar acumulado)
 *   2. Top 50 do leaderboard (puxado do manager_game_state via Supabase)
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Zap, Layers } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/BackButton';
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 pb-10 px-3 sm:px-4">
      <BackButton to="/competicao" label="Competição" />

      {/* Header editorial */}
      <header>
        <div
          className="font-display font-bold uppercase text-neon-yellow/80 mb-3"
          style={{ fontSize: '10px', letterSpacing: '0.28em' }}
        >
          OLE Football · Ligas locais
        </div>
        <h1 className="leading-[0.92]">
          <span
            className="block font-bold uppercase text-white"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5.5vw, 3.25rem)', letterSpacing: '0.005em' }}
          >
            Ligas locais
          </span>
          <span
            className="block italic text-neon-yellow mt-1"
            style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: 'clamp(1.4rem, 4vw, 2rem)', letterSpacing: '-0.02em' }}
          >
            {meta.label.toLowerCase()}
          </span>
        </h1>
        <span aria-hidden className="mt-4 block w-12 h-[3px] bg-neon-yellow" />
        <p className="mt-3 max-w-md text-sm leading-snug text-white/55">{meta.subtitle}</p>
      </header>

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
                'flex items-center justify-center gap-2 py-3 font-display text-xs font-bold uppercase tracking-wider border transition-all',
                tab === id
                  ? 'bg-neon-yellow text-black border-neon-yellow'
                  : 'border-white/15 bg-white/[0.03] text-white/60 hover:border-neon-yellow/40 hover:text-white',
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <TabIcon className="w-4 h-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* My stats */}
        <div
          className="border border-neon-yellow/30 bg-panel p-4 space-y-3"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-neon-yellow">Meu placar acumulado</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Jogos" value={myStanding.played} />
            <Stat label="Pontos" value={myStanding.points} highlight />
            <Stat label="V/E/D" value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
            <Stat label="Saldo" value={myStanding.goalsFor - myStanding.goalsAgainst} />
          </div>
          {myStanding.recentForm.length > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="uppercase tracking-wider text-white/40">Forma:</span>
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
        <div className="border border-white/10 bg-panel p-4" style={{ borderRadius: 'var(--radius-md)' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3">Top 50 managers</h3>
          {loading && <p className="text-xs text-white/45">Carregando ranking…</p>}
          {!loading && leaderboard.length === 0 && (
            <p className="text-xs text-white/45">Sem entradas ainda — jogue uma partida pra estrear no ranking.</p>
          )}
          {!loading && leaderboard.length > 0 && (
            <div className="space-y-1">
              {leaderboard.map((row, idx) => (
                <div
                  key={row.userId}
                  className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
                >
                  <span className="text-xs font-bold text-white/45">{idx + 1}</span>
                  <span className="text-xs truncate text-white/85">
                    {row.clubName ?? row.managerName ?? row.userId.slice(0, 8)}
                  </span>
                  <span className="text-[10px] text-white/45 text-right">{row.played}j</span>
                  <span className="text-[10px] text-white/55 text-right">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </span>
                  <span className="text-xs font-bold text-neon-yellow text-right">{row.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, highlight, small }: { label: string; value: number | string; highlight?: boolean; small?: boolean }) {
  return (
    <div className="border border-white/10 py-2" style={{ borderRadius: 'var(--radius-sm)' }}>
      <p className="text-[9px] uppercase tracking-wider text-white/45">{label}</p>
      <p className={cn('font-display font-bold mt-1', small ? 'text-sm' : 'text-lg', highlight ? 'text-neon-yellow' : 'text-white')}>
        {value}
      </p>
    </div>
  );
}

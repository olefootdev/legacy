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
import { Hashtag } from '@/components/ui';
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
  const myClubName = useGameStore((s) => s.club?.name);
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
        <Hashtag className="mb-3 text-neon-yellow">#ligaslocais</Hashtag>
        <h1 className="leading-[1.1]">
          <span
            className="block font-impact uppercase text-white"
            style={{ fontSize: 'clamp(2rem, 5.5vw, 3.25rem)', letterSpacing: '0.005em' }}
          >
            Ligas locais
          </span>
          <span
            className="ole-num block uppercase text-neon-yellow mt-1"
            style={{ fontSize: 'clamp(1.1rem, 3.4vw, 1.6rem)' }}
          >
            {meta.label}
          </span>
        </h1>
        <p className="mt-3 truncate font-mono text-[11.5px] text-cimento">{meta.subtitle}</p>
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
                'ole-num flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap border text-[12px] uppercase transition-colors',
                tab === id
                  ? 'bg-neon-yellow text-black border-neon-yellow'
                  : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
              )}
            >
              <TabIcon className="w-4 h-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* My stats */}
        <div className="border border-neon-yellow/40 bg-panel p-4 space-y-3">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">Meu placar acumulado</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Jogos" value={myStanding.played} />
            <Stat label="Pontos" value={myStanding.points} highlight />
            <Stat label="V/E/D" value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
            <Stat label="Saldo" value={myStanding.goalsFor - myStanding.goalsAgainst} />
          </div>
          {myStanding.recentForm.length > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-mono uppercase tracking-[0.14em] text-cimento">Forma</span>
              <div className="flex gap-1">
                {myStanding.recentForm.map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      'ole-num inline-block w-5 h-5 text-[9px] leading-5 text-center',
                      c === 'W' && 'bg-alta text-black',
                      c === 'D' && 'bg-card-hi text-white',
                      c === 'L' && 'bg-baixa text-white',
                    )}
                  >
                    {c === 'W' ? 'V' : c === 'D' ? 'E' : 'D'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="border border-white/10 bg-panel p-4">
          <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">Top 50 managers</h3>
          {loading && <p className="text-xs text-cimento">Carregando ranking…</p>}
          {!loading && leaderboard.length === 0 && (
            <p className="truncate text-xs text-cimento">Ranking vazio. Jogue e estreie no top.</p>
          )}
          {!loading && leaderboard.length > 0 && (
            <div className="border border-white/10">
              {leaderboard.map((row, idx) => {
                const isMe = !!row.clubName && row.clubName === myClubName;
                return (
                  <div
                    key={row.userId}
                    className={cn(
                      'grid h-11 grid-cols-[2rem_1fr_3rem_3rem_3rem] items-center gap-2 px-3',
                      isMe ? 'bg-neon-yellow text-black' : 'border-b border-white/[0.06]',
                    )}
                  >
                    <span className={cn('ole-num text-[13px]', isMe ? 'text-black' : 'text-cimento')}>{idx + 1}</span>
                    <span className={cn('truncate text-[13.5px]', isMe ? 'font-bold' : 'text-giz')}>
                      {row.clubName ?? row.managerName ?? row.userId.slice(0, 8)}
                    </span>
                    <span className={cn('font-mono text-[10.5px] text-right', isMe ? 'text-black/70' : 'text-cimento')}>{row.played}j</span>
                    <span className={cn('font-mono text-[10.5px] text-right', isMe ? 'text-black/70' : 'text-cimento')}>
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </span>
                    <span className={cn('ole-num text-[14px] text-right', isMe ? 'text-black' : 'text-white')}>{row.points}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, highlight, small }: { label: string; value: number | string; highlight?: boolean; small?: boolean }) {
  return (
    <div className="border border-white/10 py-2">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-cimento">{label}</p>
      <p className={cn('ole-num mt-1', small ? 'text-sm' : 'text-lg', highlight ? 'text-neon-yellow' : 'text-white')}>
        {value}
      </p>
    </div>
  );
}

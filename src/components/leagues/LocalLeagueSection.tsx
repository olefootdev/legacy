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
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';
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
    title: L('LIGA CLASSIC', 'CLASSIC LEAGUE'),
    subtitle: L('Pontos somam toda partida CLASSIC (2D tático).', 'Points add up every CLASSIC match (tactical 2D).'),
    ctaLabel: L('Jogar Classic', 'Play Classic'),
  },
  fast: {
    title: L('FAST LIGA', 'FAST LEAGUE'),
    subtitle: L('Pontos somam toda partida RÁPIDA.', 'Points add up every QUICK match.'),
    ctaLabel: L('Jogar Rápida', 'Play Quick'),
  },
};

interface Props {
  league: LocalLeagueId;
}

export function LocalLeagueSection({ league }: Props) {
  const localLeagues = useGameStore((s) => s.localLeagues);
  const myClubName = useGameStore((s) => s.club?.name);
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
  // 2026-05-27: Classic em "Em breve" — desativa CTA e redireciona pra Quick.
  const isClassicSoon = league === 'classic';
  const ctaHref = isClassicSoon ? '/match/quick' : '/match/quick';
  const ctaLabel = isClassicSoon ? L('Em breve', 'Coming soon') : meta.ctaLabel;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-white/10 bg-panel overflow-hidden"
    >
      {/* Header */}
      <div className="bg-deep-black p-6 md:p-7 border-b border-white/10">
        <Hashtag className="mb-2 text-neon-yellow">{L('#ligalocal · cumulativa', '#localleague · cumulative')}</Hashtag>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="min-w-0 leading-[1.1]">
            <span
              className="block truncate font-impact uppercase text-white"
              style={{
                fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
                letterSpacing: '0.005em',
              }}
            >
              {meta.title}
            </span>
            <span
              className="ole-num block uppercase text-neon-yellow mt-0.5"
              style={{ fontSize: 'clamp(1.1rem, 3.2vw, 1.75rem)' }}
            >
              {myStanding.points} {myStanding.points === 1 ? L('ponto', 'point') : L('pontos', 'points')}
            </span>
          </h2>
          {isClassicSoon ? (
            <span
              className="ole-num inline-flex h-11 items-center whitespace-nowrap border border-white/16 px-4 text-[12px] uppercase text-poeira cursor-not-allowed"
              aria-disabled="true"
            >
              {ctaLabel}
            </span>
          ) : (
            <Link
              to={ctaHref}
              className="ole-num inline-flex h-11 items-center whitespace-nowrap bg-neon-yellow px-4 text-[12px] uppercase text-black transition-colors hover:bg-white [--corte:10px] [clip-path:var(--clip-corte)]"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
        <p className="mt-3 truncate font-mono text-[11.5px] text-cimento">
          {meta.subtitle}
        </p>
      </div>

      {/* Meu placar */}
      <div className="p-5 border-b border-white/10 space-y-3">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
          {L('Meu placar acumulado', 'My cumulative record')}
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label={L('Jogos', 'Played')} value={myStanding.played} />
          <Stat label={L('Pontos', 'Points')} value={myStanding.points} highlight />
          <Stat label={L('V/E/D', 'W/D/L')} value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
          <Stat label={L('Saldo', 'GD')} value={fmtDiff(myStanding.goalsFor - myStanding.goalsAgainst)} />
        </div>
        {myStanding.recentForm.length > 0 && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-mono uppercase tracking-[0.14em] text-cimento">{L('Forma', 'Form')}</span>
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
                  {c === 'W' ? L('V', 'W') : c === 'D' ? L('E', 'D') : L('D', 'L')}
                </span>
              ))}
            </div>
            {myStanding.bestStreak > 0 && (
              <span className="ml-auto truncate font-mono text-cimento">{L('Melhor sequência', 'Best streak')}: {myStanding.bestStreak}{L('V', 'W')}</span>
            )}
          </div>
        )}
      </div>

      {/* Top 50 leaderboard */}
      <div className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
          <Trophy className="w-3 h-3 text-neon-yellow" /> Top 50 managers
        </h3>
        {loading && (
          <p className="text-xs text-cimento">{L('Carregando ranking…', 'Loading ranking…')}</p>
        )}
        {!loading && leaderboard.length === 0 && (
          <p className="truncate text-xs text-cimento">{L('Ranking vazio. Jogue e estreie no top.', 'Empty ranking. Play and make your debut at the top.')}</p>
        )}
        {!loading && leaderboard.length > 0 && (
          <div className="max-h-[420px] overflow-y-auto border border-white/10">
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
                  <span className={cn('font-mono text-[10.5px] text-right', isMe ? 'text-black/70' : 'text-cimento')}>{row.played}{L('j', 'p')}</span>
                  <span className={cn('font-mono text-[10.5px] text-right', isMe ? 'text-black/70' : 'text-cimento')}>
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </span>
                  <span className={cn('ole-num text-[14px] text-right', isMe ? 'text-black' : 'text-white')}>
                    {row.points}
                  </span>
                </div>
              );
            })}
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
    <div className="border border-white/10 py-2">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-cimento">{label}</p>
      <p className={cn(
        'ole-num mt-1',
        small ? 'text-sm' : 'text-lg',
        highlight ? 'text-neon-yellow' : 'text-white',
      )}>
        {value}
      </p>
    </div>
  );
}

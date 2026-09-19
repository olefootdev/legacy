/**
 * PvpStandings — Liga Rápida e Liga Clássica.
 *
 * Tabela agregada de todos os managers que jogaram Quick/Classic. Pontos
 * conta 3 por vitória, 1 por empate. Crítica de desempate: saldo de gols,
 * depois gols pró.
 */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Zap, Target } from 'lucide-react';
import { fetchPvpStandings, type PvpStandingRow, type PvpMatchMode } from '@/supabase/pvpMatches';
import { localCrestUrl } from '@/settings/crestUrl';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/BackButton';
import { Hashtag } from '@/components/ui';
import { useGameStore } from '@/game/store';

const MODE_LABEL: Record<PvpMatchMode, string> = {
  quick: 'Liga Rápida',
  classic: 'Liga Clássica',
};

export function PvpStandings() {
  const [mode, setMode] = useState<PvpMatchMode>('quick');
  const myClubName = useGameStore((s) => s.club?.name);
  const [rows, setRows] = useState<PvpStandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const data = await fetchPvpStandings(mode, 100);
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-5">
      <BackButton to="/competicao" label="Competição" />

      {/* Header */}
      <header className="space-y-2">
        <Hashtag className="text-neon-yellow">#pvp · classificação</Hashtag>
        <h1
          className="truncate font-impact uppercase text-white"
          style={{ fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: 1.1 }}
        >
          {MODE_LABEL[mode]}
        </h1>
      </header>

      {/* Mode tabs */}
      <div className="inline-flex border border-white/16">
        {(['quick', 'classic'] as PvpMatchMode[]).map((m) => {
          const active = m === mode;
          const Icon = m === 'quick' ? Zap : Target;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'ole-num inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[11px] uppercase transition-colors sm:px-4 sm:text-[12px]',
                active
                  ? 'bg-neon-yellow text-black'
                  : 'bg-transparent text-cimento hover:text-white',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-panel border border-dashed border-white/10 p-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cimento">Carregando classificação…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-panel border border-dashed border-white/10 p-8 text-center space-y-3">
          <Trophy className="w-10 h-10 text-poeira mx-auto" />
          <p className="text-sm text-cimento">Nenhuma partida nesta liga ainda.</p>
        </div>
      ) : (
        <div className="bg-panel border border-white/10 overflow-x-auto">
          {/* 8 colunas não cabem em 320px: a tabela rola dentro do card, a página não. */}
          {/* Header */}
          <div
            className="grid min-w-[440px] items-center gap-3 px-4 py-2.5 bg-deep-black border-b border-white/10 font-mono text-[9.5px] uppercase tracking-[0.14em] text-cimento"
            style={{ gridTemplateColumns: '40px 1fr 36px 36px 36px 36px 50px 44px' }}
          >
            <span>#</span>
            <span>Manager</span>
            <span className="text-center">J</span>
            <span className="text-center">V</span>
            <span className="text-center">E</span>
            <span className="text-center">D</span>
            <span className="text-center">SG</span>
            <span className="text-right">Pts</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-white/5">
            {rows.map((row, idx) => {
              const isTop3 = row.rank <= 3;
              const isMe = !!row.clubName && row.clubName === myClubName;
              return (
                <motion.div
                  key={row.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(0.02 * idx, 0.4) }}
                  className={cn(
                    'grid min-w-[440px] items-center gap-3 px-4 py-2.5 transition-colors',
                    isMe ? 'bg-neon-yellow text-black' : 'hover:bg-card',
                  )}
                  style={{
                    gridTemplateColumns: '40px 1fr 36px 36px 36px 36px 50px 44px',
                  }}
                >
                  <span
                    className={cn(
                      'ole-num text-base',
                      isMe ? 'text-black' : isTop3 ? 'text-white' : 'text-cimento',
                    )}
                  >
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex items-center gap-2.5">
                    {row.favoriteTeamId ? (
                      <img
                        src={localCrestUrl(row.favoriteTeamId)}
                        alt=""
                        className="w-7 h-7 shrink-0 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className={cn('w-7 h-7 shrink-0 grid place-items-center font-mono text-[9px]', isMe ? 'bg-black/10 text-black/70' : 'bg-card-hi text-cimento')}>
                        {(row.clubShort ?? '—').slice(0, 3)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={cn('text-sm font-bold truncate', isMe ? 'text-black' : 'text-white')}>
                        {row.clubName ?? row.displayName ?? 'Manager'}
                      </p>
                      <p className={cn('font-mono text-[10px] uppercase tracking-[0.1em] truncate', isMe ? 'text-black/70' : 'text-cimento')}>
                        {row.displayName ?? '—'}
                        {row.clubShort ? ` · ${row.clubShort}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={cn('ole-num text-center text-sm', isMe ? 'text-black' : 'text-giz')}>{row.played}</span>
                  <span className={cn('ole-num text-center text-sm', isMe ? 'text-black' : 'text-alta')}>{row.wins}</span>
                  <span className={cn('ole-num text-center text-sm', isMe ? 'text-black' : 'text-cimento')}>{row.draws}</span>
                  <span className={cn('ole-num text-center text-sm', isMe ? 'text-black' : 'text-baixa')}>{row.losses}</span>
                  <span
                    className={cn(
                      'ole-num text-center text-sm',
                      isMe ? 'text-black' : row.goalDiff > 0 ? 'text-alta' : row.goalDiff < 0 ? 'text-baixa' : 'text-cimento',
                    )}
                  >
                    {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                  </span>
                  <span
                    className={cn('ole-num text-right text-base', isMe ? 'text-black' : 'text-white')}
                  >
                    {row.points}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <p className="font-mono text-[10.5px] text-cimento text-center pt-2">
        Vitória 3 · empate 1 · derrota 0 · desempate: saldo, depois gols pró
      </p>
    </div>
  );
}

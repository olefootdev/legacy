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

const MODE_LABEL: Record<PvpMatchMode, string> = {
  quick: 'Liga Rápida',
  classic: 'Liga Clássica',
};

export function PvpStandings() {
  const [mode, setMode] = useState<PvpMatchMode>('quick');
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

      {/* Header editorial — eyebrow + título Moret + régua */}
      <header className="space-y-2">
        <div className="ole-eyebrow !text-neon-yellow">
          <span>OLE Football · Standings</span>
        </div>
        <h1
          className="text-white italic"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontWeight: 700,
            fontSize: 'clamp(32px, 6vw, 56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {MODE_LABEL[mode]}
        </h1>
        <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow" />
      </header>

      {/* Mode tabs */}
      <div className="inline-flex border border-white/12" style={{ borderRadius: 'var(--radius-sm)' }}>
        {(['quick', 'classic'] as PvpMatchMode[]).map((m) => {
          const active = m === mode;
          const Icon = m === 'quick' ? Zap : Target;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 transition-colors',
                active
                  ? 'bg-neon-yellow text-black'
                  : 'bg-transparent text-white/70 hover:text-white',
              )}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">A carregar standings…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-panel border border-dashed border-white/10 rounded-sm p-8 text-center space-y-3">
          <Trophy className="w-10 h-10 text-white/20 mx-auto" />
          <p className="text-sm text-gray-500">Nenhuma partida registrada nesta liga ainda.</p>
          <p className="text-xs text-gray-600">
            Joga uma {MODE_LABEL[mode]} contra outro manager pra inaugurar o ranking.
          </p>
        </div>
      ) : (
        <div className="bg-panel border border-white/8 rounded-sm overflow-hidden">
          {/* Header */}
          <div
            className="grid items-center gap-3 px-4 py-2.5 bg-black/40 border-b border-white/8 text-white/55"
            style={{
              gridTemplateColumns: '40px 1fr 36px 36px 36px 36px 50px 44px',
              fontFamily: 'var(--font-display)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
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
              return (
                <motion.div
                  key={row.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(0.02 * idx, 0.4) }}
                  className="grid items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                  style={{
                    gridTemplateColumns: '40px 1fr 36px 36px 36px 36px 50px 44px',
                  }}
                >
                  <span
                    className={cn(
                      'tabular-nums font-display font-black text-base',
                      isTop3 ? 'text-neon-yellow' : 'text-white/55',
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
                      <div className="w-7 h-7 shrink-0 bg-white/5 rounded-sm grid place-items-center text-[9px] text-white/40 font-display font-bold">
                        {(row.clubShort ?? '—').slice(0, 3)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white font-bold truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {row.clubName ?? row.displayName ?? 'Manager'}
                      </p>
                      <p className="text-[10px] text-white/45 uppercase tracking-wider truncate">
                        {row.displayName ?? '—'}
                        {row.clubShort ? ` · ${row.clubShort}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-center text-sm text-white/75 tabular-nums">{row.played}</span>
                  <span className="text-center text-sm text-emerald-300 tabular-nums font-bold">{row.wins}</span>
                  <span className="text-center text-sm text-white/60 tabular-nums">{row.draws}</span>
                  <span className="text-center text-sm text-rose-300 tabular-nums">{row.losses}</span>
                  <span
                    className={cn(
                      'text-center text-sm tabular-nums',
                      row.goalDiff > 0 ? 'text-emerald-300' : row.goalDiff < 0 ? 'text-rose-300' : 'text-white/55',
                    )}
                  >
                    {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                  </span>
                  <span
                    className="text-right text-base tabular-nums text-neon-yellow font-display font-black"
                  >
                    {row.points}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-white/40 text-center pt-2">
        Vitória 3 pts · Empate 1 pt · Derrota 0 pts. Desempate: saldo de gols, depois gols marcados.
      </p>
    </div>
  );
}

import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

type RivalsLeaderboardMiniProps = {
  /** Posição atual do manager. */
  position: number;
  /** Total de managers no ranking. */
  total: number;
  /** Quanto falta (em OLE) pra subir 1 posição. */
  gapToNextOle: number;
  /** Nome do manager logo acima (rival mais próximo). */
  nextRivalName?: string;
  /** Delta nas últimas 24h em posições (positivo = subiu). */
  delta24h?: number;
};

function formatOle(n: number): string {
  if (n >= 1e6) return `${(Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(Math.floor(n / 1e2) / 10).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('pt-BR');
}

export function RivalsLeaderboardMini({
  position,
  total,
  gapToNextOle,
  nextRivalName,
  delta24h,
}: RivalsLeaderboardMiniProps) {
  const navigate = useNavigate();
  const hasDelta = typeof delta24h === 'number' && delta24h !== 0;
  const climbed = (delta24h ?? 0) > 0;

  return (
    <motion.button
      type="button"
      onClick={() => navigate('/competicao')}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex w-full items-center gap-3 overflow-hidden border border-white/[0.06] px-4 py-3 text-left transition-colors hover:border-white/15"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-panel-elevated,#0b0b0b)',
      }}
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-black/40 ring-1 ring-neon-yellow/20">
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
          Pos
        </span>
        <span
          className="tabular-nums text-neon-yellow leading-none"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: '18px',
          }}
        >
          #{position}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/80">
            Ranking de patrimônio
          </p>
          {hasDelta ? (
            <span
              className={`inline-flex items-center gap-0.5 font-display text-[9px] font-bold uppercase tracking-[0.12em] ${
                climbed ? 'text-neon-green' : 'text-red-400'
              }`}
            >
              {climbed ? '↑' : '↓'} {Math.abs(delta24h!)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-white/75">
          <span className="font-bold text-white">+{formatOle(gapToNextOle)} OLE</span>{' '}
          <span className="text-white/55">
            pra ultrapassar{' '}
            <span className="font-bold text-white/80">{nextRivalName ?? 'o próximo'}</span>
          </span>
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/35">
          De {total.toLocaleString('pt-BR')} managers
        </p>
      </div>

      <span aria-hidden className="text-neon-yellow/60 text-xl shrink-0">
        →
      </span>
    </motion.button>
  );
}

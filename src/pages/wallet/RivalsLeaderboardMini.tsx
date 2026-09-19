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
      className="relative flex w-full items-center gap-3 overflow-hidden border border-white/10 bg-panel px-4 py-3 text-left transition-colors hover:border-white/30"
      style={{ borderRadius: 'var(--radius-card)' }}
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center bg-card-hi">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-poeira">
          Pos
        </span>
        <span className="ole-num tabular-nums text-white leading-none" style={{ fontSize: '15px' }}>
          #{position}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-cimento">
            Ranking de patrimônio
          </p>
          {hasDelta ? (
            <span
              className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-medium ${
                climbed ? 'text-alta' : 'text-baixa'
              }`}
            >
              {climbed ? '↑' : '↓'} {Math.abs(delta24h!)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-giz">
          <span className="font-bold text-white">+{formatOle(gapToNextOle)} EXP</span>{' '}
          <span className="text-cimento">
            pra ultrapassar{' '}
            <span className="font-bold text-white/80">{nextRivalName ?? 'o próximo'}</span>
          </span>
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-poeira">
          De {total.toLocaleString('pt-BR')} managers
        </p>
      </div>

      <span aria-hidden className="text-cimento text-xl shrink-0">
        →
      </span>
    </motion.button>
  );
}

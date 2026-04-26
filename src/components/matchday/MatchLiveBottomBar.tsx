/**
 * MATCH LIVE - BOTTOM BAR COMPACTA
 * Informações essenciais em tempo real com design system BVB
 */
import { motion } from 'motion/react';
import { Activity, BarChart3, Users } from 'lucide-react';

export type MatchLiveBottomBarProps = {
  possession: 'home' | 'away';
  possessionPercent: number;
  homeShots: number;
  awayShots: number;
  homePasses: number;
  awayPasses: number;
  subsUsed: number;
  subsMax: number;
  onSubsClick?: () => void;
};

export function MatchLiveBottomBar({
  possession,
  possessionPercent,
  homeShots,
  awayShots,
  homePasses,
  awayPasses,
  subsUsed,
  subsMax,
  onSubsClick,
}: MatchLiveBottomBarProps) {
  const homePossession = possession === 'home' ? possessionPercent : 100 - possessionPercent;
  const awayPossession = 100 - homePossession;

  return (
    <div className="relative z-40 backdrop-blur-md border-t" style={{ background: 'rgba(0, 0, 0, 0.4)', borderColor: 'var(--border)' }}>
      {/* Barra de posse visual */}
      <div className="relative h-1 w-full overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{ background: 'var(--yellow)' }}
          initial={{ width: '50%' }}
          animate={{ width: `${homePossession}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute right-0 top-0 h-full bg-red-500"
          initial={{ width: '50%' }}
          animate={{ width: `${awayPossession}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Stats compactas */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Posse de bola */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white/40" />
          <div className="flex items-center gap-1">
            <span
              className="ole-headline tabular-nums"
              style={{
                fontSize: 'var(--text-ui-md)',
                color: 'var(--yellow)',
              }}
            >
              {Math.round(homePossession)}
            </span>
            <span className="text-white/30 text-xs">×</span>
            <span
              className="ole-headline tabular-nums text-red-400"
              style={{
                fontSize: 'var(--text-ui-md)',
              }}
            >
              {Math.round(awayPossession)}
            </span>
          </div>
          <span
            className="text-white/40"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Posse
          </span>
        </div>

        {/* Chutes */}
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-white/40" />
          <div className="flex items-center gap-1">
            <span
              className="ole-headline tabular-nums"
              style={{
                fontSize: 'var(--text-ui-md)',
                color: 'var(--yellow)',
              }}
            >
              {homeShots}
            </span>
            <span className="text-white/30 text-xs">×</span>
            <span
              className="ole-headline tabular-nums text-red-400"
              style={{
                fontSize: 'var(--text-ui-md)',
              }}
            >
              {awayShots}
            </span>
          </div>
          <span
            className="text-white/40"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Chutes
          </span>
        </div>

        {/* Substituições */}
        <button
          type="button"
          onClick={onSubsClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border transition-colors"
          style={{
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <Users className="w-4 h-4 text-white/60" />
          <span
            className="text-white/70"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-xs)',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            {subsUsed}/{subsMax}
          </span>
        </button>
      </div>
    </div>
  );
}

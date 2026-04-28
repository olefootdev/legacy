/**
 * MATCH LIVE — BOTTOM BAR (F2 — Olefoot Broadcast)
 *
 * Vira ticker de transmissão: barra única bipolar de posse no topo;
 * stats abaixo num rolling carousel que cicla a cada 6s.
 * Tudo via tokens (--color-team-home/away, durações, easings).
 */
import { motion } from 'motion/react';
import { Users } from 'lucide-react';

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

  // Stats que ciclam no ticker. Cada item entra e sai a cada 6s.
  const tickerStats: { label: string; home: number; away: number }[] = [
    { label: 'Chutes', home: homeShots, away: awayShots },
    { label: 'Passes', home: homePasses, away: awayPasses },
    {
      label: 'Posse',
      home: Math.round(homePossession),
      away: Math.round(awayPossession),
    },
  ];

  return (
    <div
      className="relative z-40"
      style={{
        background: 'linear-gradient(0deg, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.55) 100%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--color-divider-soft)',
      }}
    >
      {/* Barra bipolar de posse — sticky no topo */}
      <div className="relative h-1 w-full overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{
            background: `linear-gradient(90deg, var(--color-team-home) 0%, rgba(253, 225, 0, 0.55) 100%)`,
            boxShadow: '0 0 8px rgba(253, 225, 0, 0.45)',
          }}
          initial={{ width: '50%' }}
          animate={{ width: `${homePossession}%` }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div
          className="absolute right-0 top-0 h-full"
          style={{
            background: `linear-gradient(270deg, var(--color-team-away) 0%, rgba(225, 29, 42, 0.55) 100%)`,
            boxShadow: '0 0 8px rgba(225, 29, 42, 0.45)',
          }}
          initial={{ width: '50%' }}
          animate={{ width: `${awayPossession}%` }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Conteúdo da barra: ticker à esquerda, subs à direita */}
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        {/* Ticker de stats — 1 visível por vez, cicla. */}
        <div className="relative flex-1 min-w-0 h-7 overflow-hidden">
          {tickerStats.map((s, i) => (
            <div
              key={s.label}
              className="absolute inset-0 flex items-center gap-3"
              style={{
                animation: `ole-ticker-cycle 18s var(--ease-broadcast) infinite`,
                animationDelay: `${i * 6}s`,
                opacity: 0,
              }}
            >
              <span
                className="font-ui font-bold text-white/40"
                style={{
                  fontSize: '9px',
                  letterSpacing: '0.32em',
                  textTransform: 'uppercase',
                }}
              >
                {s.label}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="font-display font-black tabular-nums leading-none"
                  style={{
                    color: 'var(--color-team-home)',
                    fontSize: 'var(--text-base)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.home}
                </span>
                <span className="text-white/25 text-xs leading-none">×</span>
                <span
                  className="font-display font-black tabular-nums leading-none"
                  style={{
                    color: 'var(--color-team-away)',
                    fontSize: 'var(--text-base)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.away}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Substituições — botão skewed */}
        <button
          type="button"
          onClick={onSubsClick}
          className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 transition-all"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-divider-soft)',
            transitionDuration: 'var(--dur-micro)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-card-hi)';
            e.currentTarget.style.borderColor = 'var(--color-divider-yellow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-card)';
            e.currentTarget.style.borderColor = 'var(--color-divider-soft)';
          }}
        >
          <Users className="w-3.5 h-3.5" style={{ color: 'var(--color-event-substitution)' }} />
          <span
            className="font-display font-bold tabular-nums text-white/85"
            style={{
              fontSize: '11px',
              letterSpacing: '0.12em',
            }}
          >
            {subsUsed}/{subsMax}
          </span>
        </button>
      </div>
    </div>
  );
}

import { useGameStore } from '@/game/store';
import { engagementBuffPercent, engagementBuffLabel } from '@/systems/engagement/engagementScore';

export function EngagementBadge() {
  const score = useGameStore((s) => s.managerPresence?.engagementScore ?? 0);
  const pct = engagementBuffPercent(score);
  const label = engagementBuffLabel(score);

  const color = pct === 0
    ? 'text-white/30 border-white/10'
    : pct <= 5
      ? 'text-white/60 border-white/20'
      : pct <= 10
        ? 'text-neon-yellow/80 border-neon-yellow/30'
        : 'text-neon-green border-neon-green/40';

  const barColor = pct === 0
    ? 'bg-white/10'
    : pct <= 10
      ? 'bg-neon-yellow/60'
      : 'bg-neon-green/80';

  return (
    <div
      className={`relative overflow-hidden border ${color} bg-black/40 backdrop-blur-sm px-4 py-3`}
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
            Engajamento
          </p>
          <p className="mt-0.5 font-display text-[15px] font-black uppercase tracking-tight text-white">
            +{pct}% <span className="text-[11px] font-bold text-white/50">{label}</span>
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 font-display text-[11px] font-black tabular-nums"
          style={{ color: pct > 0 ? undefined : 'rgba(255,255,255,0.25)' }}
        >
          {score}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-white/30">
        Buff na Liga Global · Reseta após 48h sem login
      </p>
    </div>
  );
}

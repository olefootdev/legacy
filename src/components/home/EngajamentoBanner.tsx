/**
 * EngajamentoBanner — engajamento (buff Liga Global) no padrão StatBanner.
 */

import { Activity } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { engagementBuffPercent, engagementBuffLabel } from '@/systems/engagement/engagementScore';
import { StatBanner, type StatBannerTone } from './StatBanner';

export function EngajamentoBanner() {
  const score = useGameStore((s) => s.managerPresence?.engagementScore ?? 0);
  const pct = engagementBuffPercent(score);
  const label = engagementBuffLabel(score);
  const tone: StatBannerTone = pct === 0 ? 'neutral' : pct <= 10 ? 'yellow' : 'green';

  return (
    <StatBanner
      tone={tone}
      glow={pct > 10}
      icon={<Activity size={18} />}
      eyebrow={`Engajamento · ${label}`}
      value={pct > 0 ? `+${pct}% de buff` : 'Sem buff ativo'}
      sub="Buff na Liga Global · reseta após 48h sem login"
      rightSlot={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 font-display text-[12px] font-black tabular-nums"
          style={{ color: pct > 0 ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.3)' }}
        >
          {score}
        </div>
      }
    />
  );
}

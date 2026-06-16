/**
 * EngajamentoBanner — engajamento (buff Liga Global) no padrão StatBanner.
 *
 * Mostra o efeito REAL: pontos de OVR somados ao time na Liga Global
 * (espelho da Edge `effectiveOverall`). Quando o time da Liga Global está
 * carregado, mostra OVR base → efetivo pra deixar o ganho concreto.
 */

import { Activity } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { engagementBuffOvr, engagementBuffLabel } from '@/systems/engagement/engagementScore';
import { StatBanner, type StatBannerTone } from './StatBanner';

export function EngajamentoBanner() {
  const score = useGameStore((s) => s.managerPresence?.engagementScore ?? 0);
  const club = useGameStore((s) => s.club);
  const managerEmail = useGameStore((s) => s.userSettings?.managerProfile?.email);
  const teams = useGameStore((s) => s.globalLeagueMVP?.teams);

  const buff = engagementBuffOvr(score);
  const label = engagementBuffLabel(score);
  const tone: StatBannerTone = buff === 0 ? 'neutral' : buff <= 10 ? 'yellow' : 'green';

  // OVR base do meu time na Liga Global (quando disponível) → mostra base → efetivo.
  const managerId = managerEmail ?? club?.id;
  const baseOvr = managerId ? teams?.find((t) => t.managerId === managerId)?.overall ?? null : null;

  const value =
    buff > 0
      ? baseOvr != null
        ? `OVR ${baseOvr} → ${baseOvr + buff}`
        : `+${buff} OVR no time`
      : 'Sem buff ativo';

  return (
    <StatBanner
      tone={tone}
      glow={buff > 10}
      icon={<Activity size={18} />}
      eyebrow={`Engajamento · ${label}`}
      value={value}
      sub={
        buff > 0
          ? `+${buff} OVR em cada jogo da Liga Global · reseta após 48h sem login`
          : 'Jogue hoje pra render mais na Liga Global · reseta após 48h sem login'
      }
      rightSlot={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 font-display text-[12px] font-black tabular-nums"
          style={{ color: buff > 0 ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.3)' }}
        >
          {score}
        </div>
      }
    />
  );
}

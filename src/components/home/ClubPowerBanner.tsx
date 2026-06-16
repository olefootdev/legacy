/**
 * ClubPowerBanner — Poder do Clube (buff de mérito na Liga Global) no padrão StatBanner.
 *
 * Mostra o ganho REAL de OVR que o time acumulou por JOGAR e VENCER muito —
 * espelho da Edge. Quanto mais ativo/vencedor o clube, mais forte na Liga,
 * sem inflar o OVR dos jogadores.
 */

import { TrendingUp } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { clubPowerOvr, CLUB_POWER_CAP } from '@/systems/clubPower';
import { StatBanner, type StatBannerTone } from './StatBanner';

export function ClubPowerBanner() {
  const club = useGameStore((s) => s.club);
  const managerEmail = useGameStore((s) => s.userSettings?.managerProfile?.email);
  const teams = useGameStore((s) => s.globalLeagueMVP?.teams);

  const managerId = managerEmail ?? club?.id;
  const myTeam = managerId ? teams?.find((t) => t.managerId === managerId) : undefined;
  if (!myTeam) return null;

  const buff = clubPowerOvr(myTeam.allTimeMatchesPlayed ?? 0, myTeam.allTimeWins ?? 0);
  const tone: StatBannerTone = buff === 0 ? 'neutral' : buff <= 6 ? 'cyan' : 'green';
  const label = buff === 0 ? 'Iniciante' : buff < CLUB_POWER_CAP ? 'Em ascensão' : 'Máximo';

  return (
    <StatBanner
      tone={tone}
      glow={buff >= CLUB_POWER_CAP}
      icon={<TrendingUp size={18} />}
      eyebrow={`Poder do Clube · ${label}`}
      value={buff > 0 ? `+${buff} OVR no time` : 'Sem bônus ainda'}
      sub={
        buff > 0
          ? `Conquistado jogando e vencendo na Liga Global · máx +${CLUB_POWER_CAP}`
          : `Jogue e vença na Liga Global pra fortalecer o clube · máx +${CLUB_POWER_CAP} OVR`
      }
      rightSlot={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 font-display text-[12px] font-black tabular-nums"
          style={{ color: buff > 0 ? 'var(--color-success)' : 'rgba(255,255,255,0.3)' }}
        >
          {buff > 0 ? `+${buff}` : '0'}
        </div>
      }
    />
  );
}

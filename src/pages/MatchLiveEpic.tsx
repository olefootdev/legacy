/**
 * MATCH LIVE ÉPICO - Layout cinematográfico BVB
 * Wrapper que transforma o Live2dMatchShell em experiência imersiva
 */
import { useState } from 'react';
import { useGameStore } from '@/game/store';
import { MatchLiveHeader } from '@/components/matchday/MatchLiveHeader';
import { MatchLiveBottomBar } from '@/components/matchday/MatchLiveBottomBar';
import { MatchLiveWatermark } from '@/components/matchday/MatchLiveWatermark';
import { Live2dMatchShell } from './Live2dMatchShell';

export function MatchLiveEpic() {
  const live = useGameStore((s) => s.liveMatch);
  const [showHeader, setShowHeader] = useState(true);

  // Se não há partida ao vivo, renderiza o shell normal
  if (!live || live.phase !== 'playing') {
    return <Live2dMatchShell config={{ productLabel: 'OLEFOOT LIVE', productSub: 'Match Engine 2D' }} />;
  }

  const displayHomeScore = live.homeScore ?? 0;
  const displayAwayScore = live.awayScore ?? 0;
  const clockDisplay = `${live.minute}'`;
  const period = live.clockPeriod === 'first_half' ? '1T' : live.clockPeriod === 'second_half' ? '2T' : 'INT';

  // Stats para o bottom bar
  const homeShots = live.events.filter((e) => e.kind === 'shot_home').length;
  const awayShots = live.events.filter((e) => e.kind === 'shot_away').length;
  const subsUsed = live.substitutionsUsed ?? 0;
  const maxSubs = live.mode === 'quick' ? 5 : 3;

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Header épico - 10% */}
      {showHeader && (
        <MatchLiveHeader
          homeScore={displayHomeScore}
          awayScore={displayAwayScore}
          homeShort={live.homeShort}
          awayShort={live.awayShort}
          clockDisplay={clockDisplay}
          period={period}
          onExit={() => {
            // TODO: implementar lógica de saída
            window.history.back();
          }}
          onMenuToggle={() => {
            // TODO: implementar menu
          }}
        />
      )}

      {/* Campo 2D - 80% */}
      <div className="flex-1 relative overflow-hidden">
        {/* Watermark épico */}
        <MatchLiveWatermark homeScore={displayHomeScore} awayScore={displayAwayScore} />

        {/* Shell original do Live2d */}
        <div className="absolute inset-0">
          <Live2dMatchShell config={{ productLabel: 'OLEFOOT LIVE', productSub: 'Match Engine 2D' }} />
        </div>
      </div>

      {/* Bottom Bar épica - 10% */}
      <MatchLiveBottomBar
        possession={live.possession}
        possessionPercent={65}
        homeShots={homeShots}
        awayShots={awayShots}
        homePasses={0}
        awayPasses={0}
        subsUsed={subsUsed}
        subsMax={maxSubs}
        onSubsClick={() => {
          // TODO: abrir painel de substituições
        }}
      />
    </div>
  );
}

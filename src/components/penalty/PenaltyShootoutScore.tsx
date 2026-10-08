import { L } from '@/i18n/L';
import type { ShootoutContext, ShotResult } from './types';

export function PenaltyShootoutScore({
  ctx,
  highlightActive = true,
}: {
  ctx: ShootoutContext;
  highlightActive?: boolean;
}) {
  const homeGoals = ctx.homeShots.filter((s) => s === 'goal').length;
  const awayGoals = ctx.awayShots.filter((s) => s === 'goal').length;

  return (
    <div className="w-full max-w-[920px] mt-4 mb-6 border-t-2 border-asfalto-27/80 pt-4">
      <div className="grid grid-cols-3 items-center gap-4">
        {/* Home */}
        <div className="flex flex-col items-start gap-2">
          <div className="font-prova text-[10.5px] uppercase tracking-[0.16em] font-bold text-asfalto-27/75">
            {ctx.homeLabel ?? L('Casa', 'Home')}
          </div>
          <div className="flex items-center gap-2">
            {ctx.homeShots.map((s, i) => (
              <ShotDot
                key={i}
                result={s}
                active={highlightActive && i === ctx.currentShooter}
              />
            ))}
          </div>
        </div>

        {/* Placar central */}
        <div className="flex items-center justify-center gap-3">
          <div
            className="font-spray font-black text-asfalto-27 tabular-nums leading-none"
            style={{ fontSize: 'clamp(48px, 13vw, 76px)' }}
          >
            {homeGoals}
          </div>
          <div className="font-spray font-black text-asfalto-27/60 text-3xl">×</div>
          <div
            className="font-spray font-black text-asfalto-27 tabular-nums leading-none"
            style={{ fontSize: 'clamp(48px, 13vw, 76px)' }}
          >
            {awayGoals}
          </div>
        </div>

        {/* Away */}
        <div className="flex flex-col items-end gap-2">
          <div className="font-prova text-[10.5px] uppercase tracking-[0.16em] font-bold text-asfalto-27/75">
            {ctx.awayLabel ?? L('Visitante', 'Away')}
          </div>
          <div className="flex items-center gap-2">
            {ctx.awayShots.map((s, i) => (
              <ShotDot key={i} result={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShotDot({ result, active = false }: { key?: import("react").Key; result: ShotResult; active?: boolean }) {
  if (result === 'goal') {
    return (
      <div className="w-5 h-5 bg-asfalto-27 flex items-center justify-center" aria-label={L('Gol', 'Goal')}>
        <div className="w-2 h-2 bg-rua" />
      </div>
    );
  }
  if (result === 'save') {
    return (
      <div className="w-5 h-5 border-2 border-asfalto-27 flex items-center justify-center" aria-label={L('Defendido', 'Saved')}>
        <svg viewBox="0 0 12 12" className="w-3 h-3">
          <line x1="2" y1="2" x2="10" y2="10" stroke="#0D0D0C" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="#0D0D0C" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className={`w-5 h-5 border-2 ${
        active ? 'border-asfalto-27 animate-pulse bg-asfalto-27/10' : 'border-dashed border-asfalto-27/35'
      }`}
    />
  );
}

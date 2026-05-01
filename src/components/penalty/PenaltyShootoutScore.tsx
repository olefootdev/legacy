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
    <div className="w-full max-w-[920px] mt-4 mb-6 border-t-2 border-black/80 pt-4">
      <div className="grid grid-cols-3 items-center gap-4">
        {/* Home */}
        <div className="flex flex-col items-start gap-2">
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-black/70">
            {ctx.homeLabel ?? 'Casa'}
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
            className="font-display italic font-black text-black tabular-nums leading-none"
            style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}
          >
            {homeGoals}
          </div>
          <div className="text-black/50 text-3xl">—</div>
          <div
            className="font-display italic font-black text-black tabular-nums leading-none"
            style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}
          >
            {awayGoals}
          </div>
        </div>

        {/* Away */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-black/70">
            {ctx.awayLabel ?? 'Visitante'}
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
      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-neon-yellow" />
      </div>
    );
  }
  if (result === 'save') {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center">
        <svg viewBox="0 0 12 12" className="w-3 h-3">
          <line x1="2" y1="2" x2="10" y2="10" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className={`w-5 h-5 rounded-full border-2 ${
        active ? 'border-black animate-pulse bg-black/10' : 'border-black/30'
      }`}
    />
  );
}

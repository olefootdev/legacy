import { POWER_SWEET_HIGH, POWER_SWEET_LOW } from './constants';

export function PenaltyPowerBar({ power }: { power: number }) {
  const tone =
    power > POWER_SWEET_HIGH ? '#ef4444' : power > POWER_SWEET_LOW ? '#FDE100' : '#999';

  const label =
    power > POWER_SWEET_HIGH
      ? 'DEMAIS!'
      : power > POWER_SWEET_LOW
        ? power > 0.6
          ? 'PURA PANCADA'
          : 'BOM'
        : 'FRACO';

  return (
    <div className="w-full max-w-[920px] mt-4">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[11px] uppercase tracking-[0.35em] font-bold text-black">
          Força · {Math.round(power * 100)}%
        </div>
        <div
          className="text-[11px] uppercase tracking-[0.3em] font-black"
          style={{ color: tone === '#FDE100' ? '#000' : tone }}
        >
          {label}
        </div>
      </div>
      <div className="relative h-7 bg-black border-[3px] border-black overflow-hidden">
        <div
          className="h-full transition-none"
          style={{
            width: `${power * 100}%`,
            background: tone,
            boxShadow: power > POWER_SWEET_HIGH ? '0 0 16px rgba(239,68,68,0.8)' : undefined,
          }}
        />
        <div
          className="absolute top-0 h-full border-l-2 border-neon-yellow/80"
          style={{ left: `${POWER_SWEET_LOW * 100}%` }}
        />
        <div
          className="absolute top-0 h-full border-l-2 border-red-500"
          style={{ left: `${POWER_SWEET_HIGH * 100}%` }}
        />
      </div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-black/60 mt-1">
        Solte o botão pra chutar · Zona dourada = pancada na medida
      </div>
    </div>
  );
}

import { L } from '@/i18n/L';
import { POWER_SWEET_HIGH, POWER_SWEET_LOW } from './constants';

export function PenaltyPowerBar({ power }: { power: number }) {
  const tone =
    power > POWER_SWEET_HIGH ? '#FF4D4D' : power > POWER_SWEET_LOW ? '#FDE100' : '#9A9C9F';

  const label =
    power > POWER_SWEET_HIGH
      ? L('DEMAIS!', 'TOO MUCH!')
      : power > POWER_SWEET_LOW
        ? power > 0.6
          ? L('PURA PANCADA', 'PURE POWER')
          : L('BOM', 'GOOD')
        : L('FRACO', 'WEAK');

  return (
    <div className="w-full max-w-[920px] mt-4">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[11px] uppercase tracking-[0.35em] font-bold text-black">
          {L('Força', 'Power')} · {Math.round(power * 100)}%
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
        {L('Solte o botão pra chutar · Zona amarela = pancada na medida', 'Release to shoot · Yellow zone = perfect strike')}
      </div>
    </div>
  );
}

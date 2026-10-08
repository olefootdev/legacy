import { L } from '@/i18n/L';
import { POWER_SWEET_HIGH, POWER_SWEET_LOW } from './constants';

export function PenaltyPowerBar({ power }: { power: number }) {
  const tone =
    power > POWER_SWEET_HIGH ? '#FF4D4D' : power > POWER_SWEET_LOW ? '#F2E61E' : '#9A958A';

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
        <div className="font-prova text-[11px] uppercase tracking-[0.2em] font-bold text-asfalto-27">
          {L('Força', 'Power')} · {Math.round(power * 100)}%
        </div>
        <div
          className="font-impact text-[16px] uppercase leading-none"
          style={{ color: tone === '#FF4D4D' ? '#B3261E' : 'var(--color-asfalto-27)' }}
        >
          {label}
        </div>
      </div>
      <div className="relative h-7 bg-asfalto-27 border-[3px] border-asfalto-27 overflow-hidden">
        <div
          className="h-full transition-none"
          style={{
            width: `${power * 100}%`,
            background: tone,
          }}
        />
        <div
          className="absolute top-0 h-full border-l-2 border-rua/80"
          style={{ left: `${POWER_SWEET_LOW * 100}%` }}
        />
        <div
          className="absolute top-0 h-full border-l-2 border-baixa"
          style={{ left: `${POWER_SWEET_HIGH * 100}%` }}
        />
      </div>
      <div className="font-prova text-[10px] uppercase tracking-[0.12em] text-asfalto-27/65 mt-1">
        {L('Solte o botão pra chutar · Zona amarela = pancada na medida', 'Release to shoot · Yellow zone = perfect strike')}
      </div>
    </div>
  );
}

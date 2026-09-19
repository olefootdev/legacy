type ChangePillProps = {
  change: number;
  compact?: boolean;
};

/** Pílula colorida +X.X% / -X.X% — verde positivo, vermelho negativo. */
export function ChangePill({ change, compact }: ChangePillProps) {
  const positive = change >= 0;
  const sign = positive ? '+' : '';
  const arrow = positive ? '↑' : '↓';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium tabular-nums ${
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'
      } rounded-full border ${
        positive
          ? 'border-alta/30 text-alta bg-alta/[0.08]'
          : 'border-baixa/30 text-baixa bg-baixa/[0.08]'
      }`}
    >
      <span>{arrow}</span>
      <span>
        {sign}
        {change.toFixed(1)}%
      </span>
    </span>
  );
}

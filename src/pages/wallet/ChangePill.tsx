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
      className={`inline-flex items-center gap-1 font-display font-bold uppercase tracking-[0.12em] tabular-nums ${
        compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
      } rounded-full border ${
        positive
          ? 'border-neon-green/30 text-neon-green bg-neon-green/[0.08]'
          : 'border-red-400/30 text-red-400 bg-red-400/[0.08]'
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

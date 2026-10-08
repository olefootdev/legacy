type SparklineProps = {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

/**
 * Mini SVG line chart — sem eixos, sem grid. Trend-only.
 *
 * DS 2027: traço chapado, sem área pintada embaixo. Verde/vermelho é a única
 * cor de delta de jogo que o DS deixa — aqui o traço É o delta.
 */
export function Sparkline({
  data,
  positive = true,
  width = 72,
  height = 22,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const stroke = positive ? 'var(--color-alta)' : 'var(--color-baixa)';
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

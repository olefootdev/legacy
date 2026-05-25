type SparklineProps = {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

/** Mini SVG line chart — sem eixos, sem grid. Trend-only. */
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

  const stroke = positive ? 'var(--color-neon-green, #65ff8a)' : '#ff6b6b';
  const fill = positive
    ? 'rgba(101, 255, 138, 0.08)'
    : 'rgba(255, 107, 107, 0.08)';

  const areaPath = `M 0,${height} L ${points.split(' ').join(' L ')} L ${width},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path d={areaPath} fill={fill} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

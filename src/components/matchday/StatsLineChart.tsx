/**
 * Mini-gráfico de linha para histórico de stats — Melhoria #3
 */
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { StatsHistoryPoint } from '@/hooks/useStatsHistory';

interface StatsLineChartProps {
  history: StatsHistoryPoint[];
  stat: 'possession' | 'shots';
  homeColor?: string;
  awayColor?: string;
  className?: string;
}

export function StatsLineChart({
  history,
  stat,
  homeColor = 'rgb(253,225,0)',
  awayColor = 'rgb(96,165,250)',
  className,
}: StatsLineChartProps) {
  if (history.length < 2) return null;

  const width = 100;
  const height = 30;
  const padding = 2;

  // Normaliza pontos para o viewBox
  const points = history.map((point, i) => {
    const x = (i / (history.length - 1)) * (width - padding * 2) + padding;
    const homeValue = point[stat].home;
    const awayValue = point[stat].away;

    // Para posse: 0-100%
    // Para chutes: normaliza pelo máximo
    const maxShots = stat === 'shots'
      ? Math.max(...history.map(p => Math.max(p.shots.home, p.shots.away)), 1)
      : 100;

    const homeY = height - padding - ((homeValue / (stat === 'possession' ? 100 : maxShots)) * (height - padding * 2));
    const awayY = height - padding - ((awayValue / (stat === 'possession' ? 100 : maxShots)) * (height - padding * 2));

    return { x, homeY, awayY };
  });

  const homePolyline = points.map(p => `${p.x},${p.homeY}`).join(' ');
  const awayPolyline = points.map(p => `${p.x},${p.awayY}`).join(' ');

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-8 w-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Away line */}
        <motion.polyline
          points={awayPolyline}
          fill="none"
          stroke={awayColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Home line */}
        <motion.polyline
          points={homePolyline}
          fill="none"
          stroke={homeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />

        {/* Dots no último ponto */}
        {points.length > 0 && (
          <>
            <motion.circle
              cx={points[points.length - 1]!.x}
              cy={points[points.length - 1]!.homeY}
              r="1.5"
              fill={homeColor}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9 }}
            />
            <motion.circle
              cx={points[points.length - 1]!.x}
              cy={points[points.length - 1]!.awayY}
              r="1.5"
              fill={awayColor}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9 }}
            />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Heatmap Tático Inteligente
 * Visualização profissional com grid estruturado, zonas de influência e setas de visão
 */

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Target, Shield, Eye, Activity } from 'lucide-react';
import type { QuickMatchHeatmap } from '@/match/quickMatchHeatmap';
import { drawHeatmap } from '@/match/quickMatchHeatmap';
import { cn } from '@/lib/utils';

interface Props {
  heatmap: QuickMatchHeatmap;
  homeColor?: string;
  awayColor?: string;
}

export function QuickMatchHeatmapPanel({
  heatmap,
  homeColor = '#fbbf24',
  awayColor = '#ef4444',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Redesenha quando o canvas muda de tamanho
    const resizeObserver = new ResizeObserver(() => {
      drawHeatmap(canvas, heatmap, homeColor, awayColor);
    });

    resizeObserver.observe(canvas);
    drawHeatmap(canvas, heatmap, homeColor, awayColor);

    return () => resizeObserver.disconnect();
  }, [heatmap, homeColor, awayColor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-neon-yellow" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Visão Tática
          </h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/50">
          <Activity className="w-3.5 h-3.5" />
          <span>{heatmap.playerPositions.length} jogadores</span>
        </div>
      </div>

      {/* Canvas Heatmap */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative rounded-lg overflow-hidden border border-white/10 bg-[#0a0f1a]"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-64"
          style={{ display: 'block' }}
        />

        {/* Legend - Compacta e organizada */}
        <div className="absolute top-2 right-2 space-y-1">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-2 ring-white" />
            <span className="text-[10px] text-white font-medium">Gol</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-[10px] text-white font-medium">Chute</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-white font-medium">Defesa</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-white font-medium">Passe</span>
          </div>
        </div>

        {/* Info: Raio de ação */}
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-neon-yellow">
              <circle
                cx="8"
                cy="8"
                r="5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="2 2"
              />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            </svg>
            <span className="text-[10px] text-white font-medium">Raio de ação</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 rounded-lg bg-black/40 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/60">Defesa</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {heatmap.homeZones.defense}%
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-3 rounded-lg bg-black/40 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/60">Meio</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {heatmap.homeZones.midfield}%
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-3 rounded-lg bg-black/40 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-red-400" />
            <span className="text-xs text-white/60">Ataque</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {heatmap.homeZones.attack}%
          </div>
        </motion.div>
      </div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(
          'p-3 rounded-lg border',
          'bg-gradient-to-r from-neon-yellow/5 to-neon-yellow/10',
          'border-neon-yellow/20',
        )}
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-white/60 mb-1">Posse</div>
            <div className="text-lg font-bold text-white">{heatmap.possession}%</div>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Finalizações</div>
            <div className="text-lg font-bold text-white">{heatmap.shots}</div>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">No Alvo</div>
            <div className="text-lg font-bold text-white">{heatmap.shotsOnTarget}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

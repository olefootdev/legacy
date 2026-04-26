/**
 * Sprint 3: Heatmap Tático Pós-Jogo
 * Visualização em Canvas 2D com zonas de calor e momentos-chave
 */

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Target, Shield } from 'lucide-react';
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

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawHeatmap(canvas, heatmap, homeColor, awayColor);
    }
  }, [heatmap, homeColor, awayColor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Análise Tática
        </h3>
      </div>

      {/* Canvas Heatmap */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative rounded-xl overflow-hidden border-2 border-white/20 bg-black/40"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-48"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Legend */}
        <div className="absolute top-2 right-2 space-y-1">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="text-xs text-white">Golo</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-white">Defesa</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <span className="text-xs text-white">Chute</span>
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
          'p-3 rounded-lg border-2',
          'bg-gradient-to-r from-blue-500/10 to-purple-500/10',
          'border-blue-500/30',
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

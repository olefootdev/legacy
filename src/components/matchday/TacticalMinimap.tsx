/**
 * Mini-mapa Tático — Fase 3 Polish #5
 * Mostra heatmap, zonas de pressão e padrões táticos.
 */
import { motion } from 'motion/react';
import { Map, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TacticalHeatmap {
  home: { zone: string; intensity: number }[]; // 0-1
  away: { zone: string; intensity: number }[];
}

export interface TacticalPattern {
  pressureZones: string[]; // zonas onde adversário pressiona
  dangerZones: string[]; // zonas onde casa cria chances
  attackSide: 'left' | 'right' | 'center'; // lado preferido de ataque
}

interface TacticalMinimapProps {
  heatmap?: TacticalHeatmap;
  pattern?: TacticalPattern;
  homeShort: string;
  awayShort: string;
  className?: string;
}

const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {
  'def_left': { x: 15, y: 25 },
  'def_center': { x: 15, y: 50 },
  'def_right': { x: 15, y: 75 },
  'mid_left': { x: 50, y: 25 },
  'mid_center': { x: 50, y: 50 },
  'mid_right': { x: 50, y: 75 },
  'att_left': { x: 85, y: 25 },
  'att_center': { x: 85, y: 50 },
  'att_right': { x: 85, y: 75 },
};

export function TacticalMinimap({ heatmap, pattern, homeShort, awayShort, className }: TacticalMinimapProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg bg-black/40 backdrop-blur-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-white/60" />
          <span className="text-xs font-medium uppercase tracking-wider text-white/60">
            Mapa Tático
          </span>
        </div>
      </div>

      {/* Campo miniatura */}
      <div className="relative aspect-[2/1] w-full p-3">
        <svg viewBox="0 0 100 50" className="h-full w-full">
          {/* Campo base */}
          <rect x="0" y="0" width="100" height="50" fill="rgba(34, 197, 94, 0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

          {/* Linha do meio */}
          <line x1="50" y1="0" x2="50" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

          {/* Áreas */}
          <rect x="0" y="15" width="15" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          <rect x="85" y="15" width="15" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

          {/* Heatmap casa (amarelo) */}
          {heatmap?.home.map((zone, i) => {
            const pos = ZONE_POSITIONS[zone.zone];
            if (!pos) return null;
            return (
              <motion.circle
                key={`home-${i}`}
                cx={pos.x}
                cy={pos.y}
                r={8}
                fill="rgba(253,225,0,0.3)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: zone.intensity * 0.6,
                  scale: 0.5 + zone.intensity * 0.5,
                }}
                transition={{ duration: 0.5 }}
              />
            );
          })}

          {/* Heatmap visitante (azul) */}
          {heatmap?.away.map((zone, i) => {
            const pos = ZONE_POSITIONS[zone.zone];
            if (!pos) return null;
            return (
              <motion.circle
                key={`away-${i}`}
                cx={100 - pos.x}
                cy={pos.y}
                r={8}
                fill="rgba(96,165,250,0.3)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: zone.intensity * 0.6,
                  scale: 0.5 + zone.intensity * 0.5,
                }}
                transition={{ duration: 0.5 }}
              />
            );
          })}

          {/* Zonas de pressão (vermelho) */}
          {pattern?.pressureZones.map((zone, i) => {
            const pos = ZONE_POSITIONS[zone];
            if (!pos) return null;
            return (
              <motion.rect
                key={`pressure-${i}`}
                x={pos.x - 6}
                y={pos.y - 4}
                width={12}
                height={8}
                fill="none"
                stroke="rgba(239,68,68,0.6)"
                strokeWidth="1"
                strokeDasharray="2,2"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            );
          })}

          {/* Zonas de perigo (verde) */}
          {pattern?.dangerZones.map((zone, i) => {
            const pos = ZONE_POSITIONS[zone];
            if (!pos) return null;
            return (
              <motion.circle
                key={`danger-${i}`}
                cx={pos.x}
                cy={pos.y}
                r={5}
                fill="none"
                stroke="rgba(34,197,94,0.8)"
                strokeWidth="1.5"
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            );
          })}
        </svg>

        {/* Labels */}
        <div className="absolute bottom-1 left-1 text-[8px] font-bold uppercase text-yellow-400">
          {homeShort}
        </div>
        <div className="absolute bottom-1 right-1 text-[8px] font-bold uppercase text-blue-400">
          {awayShort}
        </div>
      </div>

      {/* Insights */}
      {pattern && (
        <div className="border-t border-white/10 px-3 py-2 space-y-1">
          {pattern.attackSide && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <TrendingUp className="h-3 w-3 text-yellow-400" />
              <span className="text-gray-400">Ataca pela</span>
              <span className="font-bold text-white">
                {pattern.attackSide === 'left' && 'esquerda'}
                {pattern.attackSide === 'right' && 'direita'}
                {pattern.attackSide === 'center' && 'centro'}
              </span>
            </div>
          )}
          {pattern.pressureZones.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-gray-400">
                {awayShort} pressiona em {pattern.pressureZones.length} zona{pattern.pressureZones.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Hook para calcular heatmap e padrões táticos */
import { useMemo } from 'react';
import type { LiveMatchSnapshot } from '@/engine/types';

export function useTacticalAnalysis(live: LiveMatchSnapshot | undefined): {
  heatmap: TacticalHeatmap;
  pattern: TacticalPattern;
} {
  return useMemo(() => {
    if (!live) {
      return {
        heatmap: { home: [], away: [] },
        pattern: { pressureZones: [], dangerZones: [], attackSide: 'center' },
      };
    }

    // Analisa eventos causais para gerar heatmap
    const causal = Array.isArray(live.causalLog) ? live.causalLog : [];
    const homeZones: Record<string, number> = {};
    const awayZones: Record<string, number> = {};

    for (const event of causal) {
      if (event.type === 'ball_state') {
        const payload = event.payload as any;
        // Mapeia posição da bola para zona
        const x = payload.x ?? 50;
        const y = payload.y ?? 50;

        const zoneX = x < 33 ? 'def' : x < 66 ? 'mid' : 'att';
        const zoneY = y < 33 ? 'left' : y < 66 ? 'center' : 'right';
        const zone = `${zoneX}_${zoneY}`;

        homeZones[zone] = (homeZones[zone] ?? 0) + 1;
      }
    }

    // Normaliza intensidades
    const maxIntensity = Math.max(...Object.values(homeZones), 1);
    const heatmap: TacticalHeatmap = {
      home: Object.entries(homeZones).map(([zone, count]) => ({
        zone,
        intensity: count / maxIntensity,
      })),
      away: [], // TODO: calcular para visitante
    };

    // Detecta padrões
    const attackLeft = (homeZones['att_left'] ?? 0);
    const attackCenter = (homeZones['att_center'] ?? 0);
    const attackRight = (homeZones['att_right'] ?? 0);
    const attackSide =
      attackLeft > attackCenter && attackLeft > attackRight ? 'left' :
      attackRight > attackCenter && attackRight > attackLeft ? 'right' : 'center';

    const pattern: TacticalPattern = {
      pressureZones: [], // TODO: detectar zonas de pressão
      dangerZones: heatmap.home.filter(z => z.intensity > 0.7).map(z => z.zone),
      attackSide,
    };

    return { heatmap, pattern };
  }, [live]);
}

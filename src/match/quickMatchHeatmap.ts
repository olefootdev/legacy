/**
 * Sistema de Heatmap Pós-Jogo
 * Sprint 3: visualização tática em Canvas 2D
 */

import type { MatchEventEntry } from '@/engine/types';

export interface HeatmapZone {
  attack: number;
  midfield: number;
  defense: number;
}

export interface KeyMoment {
  minute: number;
  x: number;
  y: number;
  type: 'shot' | 'save' | 'goal';
}

export interface QuickMatchHeatmap {
  homeZones: HeatmapZone;
  awayZones: HeatmapZone;
  keyMoments: KeyMoment[];
  possession: number;
  shots: number;
  shotsOnTarget: number;
}

function classifyZone(x: number): 'defense' | 'midfield' | 'attack' {
  if (x < 33) return 'defense';
  if (x < 66) return 'midfield';
  return 'attack';
}

export function buildHeatmapFromEvents(
  events: MatchEventEntry[],
  possession: number,
): QuickMatchHeatmap {
  const homeZones: HeatmapZone = { attack: 0, midfield: 0, defense: 0 };
  const awayZones: HeatmapZone = { attack: 0, midfield: 0, defense: 0 };
  const keyMoments: KeyMoment[] = [];

  let shots = 0;
  let shotsOnTarget = 0;

  for (const e of events) {
    const x = Math.random() * 100;
    const y = Math.random() * 100;

    if (e.kind === 'goal_home') {
      homeZones.attack += 20;
      keyMoments.push({ minute: e.minute, x: 85, y: 50, type: 'goal' });
      shots++;
      shotsOnTarget++;
    } else if (e.kind === 'narrative') {
      const text = e.text.toLowerCase();
      if (text.includes('chut') || text.includes('remat')) {
        const zone = classifyZone(x);
        homeZones[zone] += 5;
        shots++;
        if (text.includes('defende') || text.includes('salva')) {
          keyMoments.push({ minute: e.minute, x: 80, y: 50 + (Math.random() - 0.5) * 30, type: 'save' });
          shotsOnTarget++;
        } else if (!text.includes('fora') && !text.includes('longe')) {
          keyMoments.push({ minute: e.minute, x: 75, y: 50 + (Math.random() - 0.5) * 40, type: 'shot' });
          shotsOnTarget++;
        }
      }
      if (text.includes('ataque') || text.includes('avanç')) {
        homeZones.attack += 3;
      }
      if (text.includes('defesa') || text.includes('recua')) {
        homeZones.defense += 3;
      }
    }
  }

  const totalHome = homeZones.attack + homeZones.midfield + homeZones.defense || 1;
  homeZones.attack = Math.round((homeZones.attack / totalHome) * 100);
  homeZones.midfield = Math.round((homeZones.midfield / totalHome) * 100);
  homeZones.defense = Math.round((homeZones.defense / totalHome) * 100);

  awayZones.attack = Math.round((100 - possession) * 0.3);
  awayZones.midfield = Math.round((100 - possession) * 0.5);
  awayZones.defense = Math.round((100 - possession) * 0.2);

  return {
    homeZones,
    awayZones,
    keyMoments: keyMoments.slice(0, 10),
    possession,
    shots,
    shotsOnTarget,
  };
}

export function drawHeatmap(
  canvas: HTMLCanvasElement,
  heatmap: QuickMatchHeatmap,
  homeColor: string,
  awayColor: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(w / 3, 0);
  ctx.lineTo(w / 3, h);
  ctx.moveTo((w * 2) / 3, 0);
  ctx.lineTo((w * 2) / 3, h);
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, `${awayColor}33`);
  gradient.addColorStop(0.5, '#00000000');
  gradient.addColorStop(1, `${homeColor}66`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  for (const m of heatmap.keyMoments) {
    const px = (m.x / 100) * w;
    const py = (m.y / 100) * h;

    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    if (m.type === 'goal') {
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (m.type === 'save') {
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    } else {
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    }
  }

  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(`Posse: ${heatmap.possession}%`, 10, 20);
  ctx.fillText(`Finalizações: ${heatmap.shots} (${heatmap.shotsOnTarget} no alvo)`, 10, 40);
}

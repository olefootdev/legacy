/**
 * Sistema de Heatmap Tático Inteligente
 * Integrado com SmartField para respeitar zonas, dimensões e regras do campo
 */

import type { MatchEventEntry, PitchPlayerState } from '@/engine/types';
import { FIELD_LENGTH, FIELD_WIDTH, worldToUiPercent } from '@/simulation/field';
import { sfSnapshot, sfGetZoneDef, sfGetAnchor, sfRoleFromSlot } from '@/smartfield/smartfieldBridge';
import type { FormationSchemeId } from '@/match-engine/types';

export interface HeatmapZone {
  attack: number;
  midfield: number;
  defense: number;
}

export interface KeyMoment {
  minute: number;
  x: number; // metros (0-105)
  z: number; // metros (0-68)
  type: 'shot' | 'save' | 'goal' | 'pass' | 'tackle';
}

export interface PlayerPosition {
  id: string;
  name: string;
  x: number; // metros (0-105)
  z: number; // metros (0-68)
  role: string;
  actionRadius: number; // metros - raio de ação tático
  influence: number; // 0-1
  anchorX: number; // metros - posição âncora do SmartField
  anchorZ: number; // metros
  allowedRadius: number; // metros - raio permitido pelo SmartField
}

export interface QuickMatchHeatmap {
  homeZones: HeatmapZone;
  awayZones: HeatmapZone;
  keyMoments: KeyMoment[];
  possession: number;
  shots: number;
  shotsOnTarget: number;
  playerPositions: PlayerPosition[];
  fieldDimensions: { length: number; width: number };
}

function classifyZone(x: number): 'defense' | 'midfield' | 'attack' {
  // Usa terços do campo real (105m)
  if (x < FIELD_LENGTH / 3) return 'defense';
  if (x < (FIELD_LENGTH * 2) / 3) return 'midfield';
  return 'attack';
}

/**
 * Converte coordenadas UI (0-100) para metros do mundo real
 */
function uiToWorldMeters(uiX: number, uiY: number): { x: number; z: number } {
  return {
    x: (uiX / 100) * FIELD_LENGTH,
    z: (uiY / 100) * FIELD_WIDTH,
  };
}

/**
 * Calcula raio de ação tático baseado em atributos e role
 */
function calculateActionRadius(player: PitchPlayerState, sfRole: string): number {
  const tatico = player.attributes?.tatico ?? 50;
  const velocidade = player.attributes?.velocidade ?? 50;

  // Range base por role (em metros)
  let baseRange = 15;
  if (sfRole === 'GK') baseRange = 25;
  else if (sfRole.includes('CB')) baseRange = 18;
  else if (sfRole.includes('M')) baseRange = 20;
  else if (sfRole.includes('W') || sfRole === 'ST') baseRange = 22;

  // Bônus por atributos (até +10m)
  const bonus = (tatico * 0.06 + velocidade * 0.04) / 100 * 10;

  return Math.min(30, baseRange + bonus);
}

/**
 * Calcula influência do jogador na zona
 */
function calculateInfluence(player: PitchPlayerState, events: MatchEventEntry[]): number {
  let influence = 0.4; // base

  // Aumenta influência baseado em eventos do jogador
  const playerEvents = events.filter(e => e.playerId === player.id);
  influence += playerEvents.length * 0.04;

  // Bônus por role
  if (player.role === 'attack') influence += 0.2;
  if (player.role === 'mid') influence += 0.15;
  if (player.role === 'defense') influence += 0.1;

  return Math.min(1, influence);
}

/**
 * Infere posição em metros baseada no contexto da narrativa
 */
function inferPositionFromNarrative(text: string): { x: number; z: number } {
  const lower = text.toLowerCase();
  let x = FIELD_LENGTH / 2;
  let z = FIELD_WIDTH / 2;

  // Inferência de X (profundidade)
  if (lower.includes('área') || lower.includes('baliza') || lower.includes('gol')) {
    x = 85 + Math.random() * 10; // Zona de ataque (85-95m)
    z = 25 + Math.random() * 18; // Centro da área (25-43m)
  } else if (lower.includes('meio') || lower.includes('centro')) {
    x = 45 + Math.random() * 15; // Meio-campo (45-60m)
    z = 20 + Math.random() * 28; // Largura variada
  } else if (lower.includes('defesa') || lower.includes('recua')) {
    x = 10 + Math.random() * 20; // Zona defensiva (10-30m)
    z = 20 + Math.random() * 28;
  } else {
    x = 35 + Math.random() * 35; // Zona intermediária
    z = 15 + Math.random() * 38;
  }

  // Inferência de Z (largura)
  if (lower.includes('esquerda') || lower.includes('esq')) {
    z = 10 + Math.random() * 15; // Lateral esquerda
  } else if (lower.includes('direita') || lower.includes('dir')) {
    z = 43 + Math.random() * 15; // Lateral direita
  }

  return { x, z };
}

export function buildHeatmapFromEvents(
  events: MatchEventEntry[],
  possession: number,
  homePlayers?: PitchPlayerState[],
  formation?: FormationSchemeId,
): QuickMatchHeatmap {
  const homeZones: HeatmapZone = { attack: 0, midfield: 0, defense: 0 };
  const awayZones: HeatmapZone = { attack: 0, midfield: 0, defense: 0 };
  const keyMoments: KeyMoment[] = [];
  const playerPositions: PlayerPosition[] = [];

  let shots = 0;
  let shotsOnTarget = 0;

  const sf = sfSnapshot();

  // Processa eventos para criar momentos-chave com posições reais
  for (const e of events) {
    let pos = { x: FIELD_LENGTH / 2, z: FIELD_WIDTH / 2 };

    if (e.kind === 'goal_home') {
      // Gol: sempre na área adversária
      pos.x = 90 + Math.random() * 5;
      pos.z = 28 + Math.random() * 12; // Centro da área
      homeZones.attack += 20;
      keyMoments.push({ minute: e.minute, x: pos.x, z: pos.z, type: 'goal' });
      shots++;
      shotsOnTarget++;
    } else if (e.kind === 'narrative') {
      const text = e.text;
      pos = inferPositionFromNarrative(text);

      const lower = text.toLowerCase();

      if (lower.includes('chut') || lower.includes('remat')) {
        const zone = classifyZone(pos.x);
        homeZones[zone] += 5;
        shots++;

        if (lower.includes('defende') || lower.includes('salva')) {
          keyMoments.push({ minute: e.minute, x: pos.x, z: pos.z, type: 'save' });
          shotsOnTarget++;
        } else if (!lower.includes('fora') && !lower.includes('longe')) {
          keyMoments.push({ minute: e.minute, x: pos.x, z: pos.z, type: 'shot' });
          shotsOnTarget++;
        }
      }

      if (lower.includes('pass') || lower.includes('serve')) {
        keyMoments.push({ minute: e.minute, x: pos.x, z: pos.z, type: 'pass' });
      }

      if (lower.includes('roub') || lower.includes('recuper') || lower.includes('intercet')) {
        keyMoments.push({ minute: e.minute, x: pos.x, z: pos.z, type: 'tackle' });
      }

      if (lower.includes('ataque') || lower.includes('avanç')) {
        homeZones.attack += 3;
      }
      if (lower.includes('defesa') || lower.includes('recua')) {
        homeZones.defense += 3;
      }
      if (lower.includes('meio') || lower.includes('centro')) {
        homeZones.midfield += 2;
      }
    }
  }

  // Converte jogadores para posições no heatmap usando SmartField
  if (homePlayers && homePlayers.length > 0) {
    for (const player of homePlayers) {
      // Converte coordenadas UI (0-100) para metros
      const worldPos = uiToWorldMeters(player.x, player.y);

      // Obtém role do SmartField
      const sfRole = sfRoleFromSlot(player.slotId, formation);
      const anchor = sfGetAnchor(sfRole, 'home');

      playerPositions.push({
        id: player.id,
        name: player.name || `#${player.num}`,
        x: worldPos.x,
        z: worldPos.z,
        role: sfRole,
        actionRadius: calculateActionRadius(player, sfRole),
        influence: calculateInfluence(player, events),
        anchorX: anchor?.base_anchor.x ?? worldPos.x,
        anchorZ: anchor?.base_anchor.z ?? worldPos.z,
        allowedRadius: anchor?.allowed_radius ?? 15,
      });
    }
  }

  // Normaliza zonas
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
    keyMoments: keyMoments.slice(-15),
    possession,
    shots,
    shotsOnTarget,
    playerPositions,
    fieldDimensions: { length: FIELD_LENGTH, width: FIELD_WIDTH },
  };
}

/**
 * Desenha campo tático profissional respeitando SmartField
 */
export function drawHeatmap(
  canvas: HTMLCanvasElement,
  heatmap: QuickMatchHeatmap,
  homeColor: string,
  awayColor: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  // Proporção do campo real (105m x 68m)
  const fieldRatio = FIELD_LENGTH / FIELD_WIDTH; // ~1.54
  const canvasRatio = w / h;

  // Padding interno para as linhas ficarem dentro do gramado
  const PADDING = 8;

  // Calcula escala para caber o campo no canvas mantendo proporção
  let scale: number;
  let offsetX = PADDING;
  let offsetY = PADDING;

  if (canvasRatio > fieldRatio) {
    // Canvas mais largo que o campo
    scale = (h - PADDING * 2) / FIELD_WIDTH;
    offsetX = (w - FIELD_LENGTH * scale) / 2;
  } else {
    // Canvas mais alto que o campo
    scale = (w - PADDING * 2) / FIELD_LENGTH;
    offsetY = (h - FIELD_WIDTH * scale) / 2;
  }

  // Função para converter metros para pixels do canvas
  const toCanvasX = (x: number) => offsetX + x * scale;
  const toCanvasZ = (z: number) => offsetY + z * scale;

  // Limpa canvas
  ctx.clearRect(0, 0, w, h);

  // Fundo
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, w, h);

  // Área do campo
  ctx.fillStyle = '#0d1520';
  ctx.fillRect(offsetX, offsetY, FIELD_LENGTH * scale, FIELD_WIDTH * scale);

  // Borda do campo
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, FIELD_LENGTH * scale, FIELD_WIDTH * scale);

  // Linha central
  ctx.strokeStyle = '#2a3a52';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toCanvasX(FIELD_LENGTH / 2), offsetY);
  ctx.lineTo(toCanvasX(FIELD_LENGTH / 2), offsetY + FIELD_WIDTH * scale);
  ctx.stroke();

  // Círculo central (raio 9.15m)
  ctx.beginPath();
  ctx.arc(
    toCanvasX(FIELD_LENGTH / 2),
    toCanvasZ(FIELD_WIDTH / 2),
    9.15 * scale,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // Linhas de terço (33.33m e 66.66m)
  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.moveTo(toCanvasX(FIELD_LENGTH / 3), offsetY);
  ctx.lineTo(toCanvasX(FIELD_LENGTH / 3), offsetY + FIELD_WIDTH * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toCanvasX((FIELD_LENGTH * 2) / 3), offsetY);
  ctx.lineTo(toCanvasX((FIELD_LENGTH * 2) / 3), offsetY + FIELD_WIDTH * scale);
  ctx.stroke();

  ctx.setLineDash([]);

  // Áreas (16.5m de profundidade, largura variável)
  const sf = sfSnapshot();
  ctx.strokeStyle = '#2a3a52';
  ctx.lineWidth = 1.5;

  // Área oeste (casa)
  const westBox = sf.goals.west.penalty_box;
  ctx.strokeRect(
    toCanvasX(westBox.x_min),
    toCanvasZ(westBox.z_min),
    (westBox.x_max - westBox.x_min) * scale,
    (westBox.z_max - westBox.z_min) * scale
  );

  // Área leste (visitante)
  const eastBox = sf.goals.east.penalty_box;
  ctx.strokeRect(
    toCanvasX(eastBox.x_min),
    toCanvasZ(eastBox.z_min),
    (eastBox.x_max - eastBox.x_min) * scale,
    (eastBox.z_max - eastBox.z_min) * scale
  );

  // Gradiente de calor baseado em posse
  const gradient = ctx.createLinearGradient(offsetX, 0, offsetX + FIELD_LENGTH * scale, 0);
  const homeIntensity = Math.min(0.3, heatmap.possession / 300);
  const awayIntensity = Math.min(0.3, (100 - heatmap.possession) / 300);

  gradient.addColorStop(0, `${awayColor}${Math.round(awayIntensity * 255).toString(16).padStart(2, '0')}`);
  gradient.addColorStop(0.5, '#00000000');
  gradient.addColorStop(1, `${homeColor}${Math.round(homeIntensity * 255).toString(16).padStart(2, '0')}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(offsetX, offsetY, FIELD_LENGTH * scale, FIELD_WIDTH * scale);

  // Ativa clipping para garantir que tudo fique dentro do campo
  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, FIELD_LENGTH * scale, FIELD_WIDTH * scale);
  ctx.clip();

  // Desenha conexões de passe entre jogadores próximos (< 25m)
  const PASS_CONNECTION_THRESHOLD = 25;
  for (let i = 0; i < heatmap.playerPositions.length; i++) {
    const p1 = heatmap.playerPositions[i]!;
    const px1 = toCanvasX(p1.x);
    const pz1 = toCanvasZ(p1.z);

    for (let j = i + 1; j < heatmap.playerPositions.length; j++) {
      const p2 = heatmap.playerPositions[j]!;
      const distance = Math.hypot(p1.x - p2.x, p1.z - p2.z);

      if (distance < PASS_CONNECTION_THRESHOLD) {
        const px2 = toCanvasX(p2.x);
        const pz2 = toCanvasZ(p2.z);

        // Espessura baseada na proximidade (mais próximo = linha mais grossa)
        const proximity = 1 - distance / PASS_CONNECTION_THRESHOLD;
        const lineWidth = 0.5 + proximity * 1.5;
        const alpha = Math.round(proximity * 40).toString(16).padStart(2, '0');

        ctx.strokeStyle = `${homeColor}${alpha}`;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(px1, pz1);
        ctx.lineTo(px2, pz2);
        ctx.stroke();
      }
    }
  }

  // Desenha zonas de influência e raio de ação dos jogadores
  for (const player of heatmap.playerPositions) {
    const px = toCanvasX(player.x);
    const pz = toCanvasZ(player.z);
    const actionRadius = player.actionRadius * scale;
    const anchorX = toCanvasX(player.anchorX);
    const anchorZ = toCanvasZ(player.anchorZ);
    const allowedRadius = player.allowedRadius * scale;

    // Raio permitido pelo SmartField (círculo sutil)
    ctx.strokeStyle = `${homeColor}20`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(anchorX, anchorZ, allowedRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zona de influência (círculo suave com gradiente radial)
    const influenceGradient = ctx.createRadialGradient(px, pz, 0, px, pz, actionRadius);
    const alpha = Math.round(player.influence * 35).toString(16).padStart(2, '0');
    influenceGradient.addColorStop(0, `${homeColor}${alpha}`);
    influenceGradient.addColorStop(0.6, `${homeColor}08`);
    influenceGradient.addColorStop(1, '#00000000');

    ctx.fillStyle = influenceGradient;
    ctx.beginPath();
    ctx.arc(px, pz, actionRadius, 0, Math.PI * 2);
    ctx.fill();

    // Borda do raio de ação (círculo sutil)
    ctx.strokeStyle = `${homeColor}40`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(px, pz, actionRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Token do jogador
    ctx.fillStyle = homeColor;
    ctx.beginPath();
    ctx.arc(px, pz, 4, 0, Math.PI * 2);
    ctx.fill();

    // Borda do token
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Role do jogador
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px var(--font-display)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(player.role, px, pz - 8);
  }

  // Restaura contexto (remove clipping)
  ctx.restore();

  // Desenha momentos-chave
  for (const m of heatmap.keyMoments) {
    const px = toCanvasX(m.x);
    const pz = toCanvasZ(m.z);

    // Halo ao redor do momento
    const haloGradient = ctx.createRadialGradient(px, pz, 0, px, pz, 10);

    if (m.type === 'goal') {
      haloGradient.addColorStop(0, '#fbbf2460');
      haloGradient.addColorStop(1, '#fbbf2400');
    } else if (m.type === 'save') {
      haloGradient.addColorStop(0, '#ef444460');
      haloGradient.addColorStop(1, '#ef444400');
    } else if (m.type === 'shot') {
      haloGradient.addColorStop(0, '#60a5fa40');
      haloGradient.addColorStop(1, '#60a5fa00');
    } else if (m.type === 'pass') {
      haloGradient.addColorStop(0, '#10b98140');
      haloGradient.addColorStop(1, '#10b98100');
    } else {
      haloGradient.addColorStop(0, '#a855f740');
      haloGradient.addColorStop(1, '#a855f700');
    }

    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(px, pz, 10, 0, Math.PI * 2);
    ctx.fill();

    // Ícone do momento
    ctx.beginPath();
    ctx.arc(px, pz, 3.5, 0, Math.PI * 2);

    if (m.type === 'goal') {
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (m.type === 'save') {
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff80';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (m.type === 'shot') {
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    } else if (m.type === 'pass') {
      ctx.fillStyle = '#10b981';
      ctx.fill();
    } else {
      ctx.fillStyle = '#a855f7';
      ctx.fill();
    }
  }
}

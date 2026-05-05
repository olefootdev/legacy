/**
 * /agents/bridge/pitchPlayerToAgent.ts
 *
 * Converte PitchPlayerState (engine legacy, atributos reais do store)
 * para PlayerAgentState (sistema de agentes autônomos).
 *
 * Preserva x/y reais do jogador como currentPosition e basePosition.
 * Mapeia pos/role do engine para PositionId/RoleId dos agentes.
 * Usa atributos reais (velocidade, marcação, confiança) quando disponíveis.
 */

import { createAgent, type PlayerAgentState } from '../core/PlayerAgent';
import type { PositionId, RoleId, ArchetypeId, ZoneConstraint } from '../core/AgentTypes';
import type { PitchPlayerState } from '../../src/engine/types';

// ── Mapeamento pos/role do engine → PositionId dos agentes ───────────────────
// Usa slotId quando disponível (mais preciso), cai no pos como fallback.

const SLOT_TO_POSITION: Record<string, PositionId> = {
  // Goleiro
  gol: 'GK', gk: 'GK',
  // Zagueiros
  zag1: 'CB_L', zag2: 'CB_R', cb: 'CB_L',
  // Laterais
  le: 'LB', ld: 'RB', lb: 'LB', rb: 'RB',
  // Meias
  vol: 'CM_L', mc1: 'CM_L', mc2: 'CM_R',
  pe: 'LM', pd: 'RM', lm: 'LM', rm: 'RM',
  cm: 'CM_L', cm_l: 'CM_L', cm_r: 'CM_R',
  // Atacantes
  ata: 'ST_L', st: 'ST_L', st_l: 'ST_L', st_r: 'ST_R',
};

const POS_TO_POSITION: Record<string, PositionId> = {
  GOL: 'GK', GK: 'GK',
  ZAG: 'CB_L', CB: 'CB_L',
  LAT: 'LB', LB: 'LB', RB: 'RB',
  VOL: 'CM_L', MEI: 'CM_R', CM: 'CM_L',
  PE: 'LM', PD: 'RM', LM: 'LM', RM: 'RM',
  ATA: 'ST_L', ST: 'ST_L',
};

function resolvePositionId(p: PitchPlayerState, side: 'home' | 'away'): PositionId {
  const slotKey = (p.slotId ?? '').toLowerCase();
  if (SLOT_TO_POSITION[slotKey]) return SLOT_TO_POSITION[slotKey];
  const posKey = (p.pos ?? '').toUpperCase();
  const base = POS_TO_POSITION[posKey] ?? 'CM_L';
  // Away: espelha CB_L↔CB_R, LB↔RB, ST_L↔ST_R para manter simetria
  if (side === 'away') {
    if (base === 'CB_L') return 'CB_R';
    if (base === 'CB_R') return 'CB_L';
    if (base === 'LB')   return 'RB';
    if (base === 'RB')   return 'LB';
    if (base === 'LM')   return 'RM';
    if (base === 'RM')   return 'LM';
    if (base === 'ST_L') return 'ST_R';
    if (base === 'ST_R') return 'ST_L';
  }
  return base;
}

const ROLE_MAP: Record<string, RoleId> = {
  gk: 'defensive', def: 'defensive', mid: 'support', attack: 'offensive',
};

const ARCHETYPE_MAP: Record<string, ArchetypeId> = {
  gk: 'defensive', def: 'defensive', mid: 'balanced', attack: 'offensive',
};

// Zonas base canônicas por PositionId (home side — away é espelhado em x)
const BASE_ZONES: Record<PositionId, ZoneConstraint> = {
  GK:   { baseZone: { x: 3,  y: 50 }, maxRoam: 8,  bias: 'defensive' },
  LB:   { baseZone: { x: 22, y: 15 }, maxRoam: 28, bias: 'balanced'  },
  CB_L: { baseZone: { x: 20, y: 35 }, maxRoam: 15, bias: 'defensive' },
  CB_R: { baseZone: { x: 20, y: 65 }, maxRoam: 15, bias: 'defensive' },
  RB:   { baseZone: { x: 22, y: 85 }, maxRoam: 28, bias: 'balanced'  },
  LM:   { baseZone: { x: 44, y: 15 }, maxRoam: 30, bias: 'balanced'  },
  CM_L: { baseZone: { x: 44, y: 38 }, maxRoam: 32, bias: 'balanced'  },
  CM_R: { baseZone: { x: 44, y: 62 }, maxRoam: 32, bias: 'balanced'  },
  RM:   { baseZone: { x: 44, y: 85 }, maxRoam: 30, bias: 'balanced'  },
  ST_L: { baseZone: { x: 70, y: 38 }, maxRoam: 35, bias: 'offensive' },
  ST_R: { baseZone: { x: 70, y: 62 }, maxRoam: 35, bias: 'offensive' },
};

function mirrorZone(z: ZoneConstraint): ZoneConstraint {
  return { ...z, baseZone: { x: 100 - z.baseZone.x, y: 100 - z.baseZone.y } };
}

/**
 * Converte um PitchPlayerState para PlayerAgentState.
 * @param p     — jogador do engine legacy (com atributos reais quando disponíveis)
 * @param side  — 'home' | 'away'
 */
export function pitchPlayerToAgent(
  p: PitchPlayerState,
  side: 'home' | 'away',
): PlayerAgentState {
  const positionId = resolvePositionId(p, side);
  const roleId: RoleId = ROLE_MAP[p.role] ?? 'support';
  const archetypeId: ArchetypeId = ARCHETYPE_MAP[p.role] ?? 'balanced';

  // Zona base: home usa canônica, away espelha
  const zone = side === 'away' ? mirrorZone(BASE_ZONES[positionId]) : BASE_ZONES[positionId];

  // Stamina: 100 - fatigue (fatigue 0–100 → stamina 100–0)
  const stamina = Math.max(0, Math.min(100, 100 - (p.fatigue ?? 0)));

  // Confiança: atributo mentalidade/confiança quando disponível, default 75
  const attrs = p.attributes as unknown as Record<string, number> | undefined;
  const confidence = attrs?.mentalidade ?? attrs?.confianca ?? 75;

  // Skills: usa skills reais do jogador quando disponíveis
  const skillIds: string[] = (p as any).skills ?? [];

  const agent = createAgent(
    p.playerId,
    positionId,
    roleId,
    archetypeId,
    { x: p.x, y: p.y },  // basePosition = posição atual real
    zone,
    stamina,
    confidence,
    skillIds,
  );

  // Sobrescreve currentPosition com a posição real do campo
  return { ...agent, currentPosition: { x: p.x, y: p.y } };
}

/**
 * Converte um time inteiro de PitchPlayerState para PlayerAgentState[].
 */
export function teamToAgents(
  players: PitchPlayerState[],
  side: 'home' | 'away',
): PlayerAgentState[] {
  return players.map((p) => pitchPlayerToAgent(p, side));
}

/**
 * /agents/bridge/slotToPositionId.ts
 *
 * Mapeamento canônico slotId (engine legado) → PositionId (sistema de agentes).
 * Arquivo compartilhado — usado por TacticalSimLoop e OffBallDecision.
 */
import type { PositionId } from '../core/AgentTypes';

export function slotToPositionId(slotId: string): PositionId {
  switch (slotId) {
    case 'gol': return 'GK';
    case 'zag1': return 'CB_L';
    case 'zag2': return 'CB_R';
    case 'le':   return 'LB';
    case 'ld':   return 'RB';
    case 'vol':
    case 'mc1':  return 'CM_L';
    case 'mc2':  return 'CM_R';
    case 'pe':   return 'LM';
    case 'pd':   return 'RM';
    case 'ata':  return 'ST_L';
    default:     return 'CM_L';
  }
}

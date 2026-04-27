// Stub no-op: inicialização e promoção de Position Knowledge.

import type { PositionKnowledge } from './positionKnowledgeTypes';
import type { LegendDNA } from './legendDNA';

export function seedPositionKnowledgeFromLegend(_player: unknown): PositionKnowledge | undefined {
  return undefined;
}

export function promotePlayerKnowledgeToLegend(_player: unknown): LegendDNA {
  return { id: '', name: '', posCode: '', era: '', nationality: '', description: '' };
}

export function availableLegendIds(): { id: string; label: string; posCode: string }[] {
  return [];
}

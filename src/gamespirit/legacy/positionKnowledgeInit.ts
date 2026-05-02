import type { PositionKnowledge } from './positionKnowledgeTypes';
import { LEGEND_DNA_CATALOG, type LegendDNA } from './legendDNA';

/** Normaliza posCode do jogador para comparar com o catálogo. */
function normalizePos(pos: string): string {
  const p = pos.toUpperCase().trim();
  // Mapeia variantes comuns para o posCode canônico do catálogo
  if (p === 'GOL' || p === 'GK') return 'GOL';
  if (p === 'ZAG' || p === 'CB') return 'ZAG';
  if (p === 'LAT' || p === 'LE' || p === 'LD' || p === 'LB' || p === 'RB') return 'LAT';
  if (p === 'VOL' || p === 'DM' || p === 'CDM') return 'VOL';
  if (p === 'MEI' || p === 'CA' || p === 'CAM' || p === 'CM') return 'MEI';
  if (p === 'PE' || p === 'LW' || p === 'LM') return 'PE';
  if (p === 'PD' || p === 'RW' || p === 'RM') return 'PD';
  if (p === 'ATA' || p === 'ST' || p === 'CF' || p === 'SS') return 'ATA';
  return p;
}

/** Escolhe a lenda mais adequada para o posCode. Prefere a primeira entrada do catálogo para aquela posição. */
function pickLegendForPos(posCode: string): LegendDNA | undefined {
  return LEGEND_DNA_CATALOG.find((l) => l.posCode === posCode);
}

/**
 * Gera um PositionKnowledge inicial para um jogador com isLegacy: true.
 * Usa o posCode do jogador para selecionar a lenda mais adequada do catálogo
 * e inicializa actionWeights e traits a partir do DNA dessa lenda.
 */
export function seedPositionKnowledgeFromLegend(
  player: { pos?: string; isLegacy?: boolean },
): PositionKnowledge | undefined {
  if (!player.isLegacy) return undefined;

  const posCode = normalizePos(player.pos ?? '');
  const legend = pickLegendForPos(posCode);
  if (!legend) return undefined;

  // Converte baseActionWeights para o formato PositionKnowledge
  const actionWeights: PositionKnowledge['actionWeights'] = {};
  for (const [action, weight] of Object.entries(legend.baseActionWeights)) {
    actionWeights[action] = { weight, bias: weight > 1 ? weight - 1 : 0 };
  }

  return {
    posCode,
    legendSource: legend.id,
    actionWeights,
    traits: { ...legend.baseTraits },
    sessionsCompleted: 1,
    lastTrainedAt: new Date().toISOString(),
    coachNotes: `DNA inicial: ${legend.name} (${legend.era}, ${legend.nationality})`,
  };
}

export function promotePlayerKnowledgeToLegend(player: { pos?: string; name?: string }): LegendDNA {
  const posCode = normalizePos(player.pos ?? '');
  const base = pickLegendForPos(posCode);
  return {
    id: `legend_custom_${Date.now()}`,
    name: player.name ?? 'Lenda',
    posCode,
    era: '2020s',
    nationality: 'BRA',
    description: base?.description ?? '',
    baseActionWeights: base?.baseActionWeights ?? {},
    baseTraits: base?.baseTraits ?? { pressIntensity: 1, offensiveRuns: 1, riskTaking: 1, buildUpPreference: 1 },
  };
}

export function availableLegendIds(): { id: string; label: string; posCode: string }[] {
  return LEGEND_DNA_CATALOG.map((l) => ({ id: l.id, label: l.name, posCode: l.posCode }));
}

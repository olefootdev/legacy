import { hashStringSeed } from '@/match/seededRng';
import type { LivePrematchBundle, StoryWeights } from './storyContracts';
import { buildPrematchSectorAndMatrix, type PrematchAnalysisInput } from './prematchAnalysis';
import { generateStoryTimeline } from './storyMotor';

const defaultWeights = (): StoryWeights => ({
  duelIntensity: 1,
  chanceRate: 1,
  cardPressure: 1,
});

export function buildLivePrematchBundle(
  input: PrematchAnalysisInput & { homeShort: string; awayShort: string; simulationSeed?: number },
): LivePrematchBundle {
  const { sectorHome, sectorAway, matrix, highlights } = buildPrematchSectorAndMatrix(input);
  const baseSeed =
    input.simulationSeed ?? hashStringSeed(`${input.homeShort}|${input.awayShort}|prematch`);
  const variationSeed = hashStringSeed(`${baseSeed}|v1|${Date.now()}`);
  const storyWeights = defaultWeights();
  const timelineFirstHalf = generateStoryTimeline(1, matrix, sectorHome, sectorAway, storyWeights, variationSeed);
  const storyV1Id = timelineFirstHalf.id;

  return {
    sectorHome,
    sectorAway,
    matrix,
    storyV1Id,
    timelineFirstHalf,
    storyWeights: { ...storyWeights },
    highlights,
    preparedAtMs: Date.now(),
  };
}

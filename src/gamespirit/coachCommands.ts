import { TacticalIntent, type RelevanceResult, type StoryWeights } from './storyContracts';
import { L } from '@/i18n/L';

/** Frase canónica para testes de relevância (pressionar + fechar espaços). */
export const CANONICAL_RELEVANT_COMMAND =
  'pressiona mais no meio e fecha os espaços';

const KEYWORDS: { words: string[]; intent: TacticalIntent; reason: string }[] = [
  {
    words: ['press', 'pressiona', 'pressing', 'alta', 'linha', 'high', 'push up'],
    intent: TacticalIntent.PressHigh,
    reason: L('Pedido de pressing / linha mais alta.', 'High press / higher line requested.'),
  },
  {
    words: ['recua', 'defende', 'fech', 'compact', 'bloco', 'deep', 'drop', 'sit back'],
    intent: TacticalIntent.Recover,
    reason: L('Pedido de bloco mais baixo / recuperação.', 'Deeper block / recovery requested.'),
  },
  {
    words: ['ataque', 'frente', 'remat', 'gol', 'finaliza', 'área', 'attack', 'shoot', 'goal', 'forward'],
    intent: TacticalIntent.FinalThird,
    reason: L('Ênfase na zona final / finalização.', 'Focus on the final third / finishing.'),
  },
  {
    words: ['lateral', 'corredor', 'extrem', 'wide', 'wing', 'flank'],
    intent: TacticalIntent.WideOverload,
    reason: L('Ênfase em corredores / largura.', 'Focus on the flanks / width.'),
  },
  {
    words: ['transição', 'contra', 'velocidade', 'counter', 'transition', 'fast'],
    intent: TacticalIntent.Counter,
    reason: L('Ênfase em transição / contra-ataque.', 'Focus on transition / counter-attack.'),
  },
  {
    words: ['toc', 'posse', 'calm', 'rodar', 'possession', 'keep the ball', 'patient'],
    intent: TacticalIntent.BuildUp,
    reason: L('Ênfase em construção / posse.', 'Focus on build-up / possession.'),
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

export function scoreCommandRelevance(raw: string): RelevanceResult {
  const t = normalize(raw);
  if (t.length < 4) return { relevant: false, reason: L('Texto demasiado curto.', 'Text too short.') };

  for (const row of KEYWORDS) {
    if (row.words.some((w) => t.includes(w))) {
      return { relevant: true, matchedIntent: row.intent, reason: row.reason };
    }
  }

  if (t.includes('ole') && t.length > 12) {
    return { relevant: true, matchedIntent: TacticalIntent.Progress, reason: L('Comando genérico de impulso.', 'Generic push command.') };
  }

  return { relevant: false, reason: L('Sem palavras-chave táticas reconhecidas.', 'No tactical keywords recognised.') };
}

export function applyRelevantCommandToStoryWeights(
  weights: StoryWeights,
  rel: RelevanceResult,
  text: string,
): StoryWeights {
  const next = { ...weights, lastCommandEcho: text.slice(0, 120) };
  if (!rel.relevant) return next;

  switch (rel.matchedIntent) {
    case TacticalIntent.PressHigh:
      next.duelIntensity = Math.min(1.35, next.duelIntensity + 0.12);
      next.chanceRate = Math.min(1.25, next.chanceRate + 0.04);
      break;
    case TacticalIntent.Recover:
      next.duelIntensity = Math.max(0.65, next.duelIntensity - 0.06);
      next.cardPressure = Math.max(0.7, next.cardPressure - 0.05);
      break;
    case TacticalIntent.FinalThird:
      next.chanceRate = Math.min(1.4, next.chanceRate + 0.14);
      break;
    case TacticalIntent.WideOverload:
      next.chanceRate = Math.min(1.3, next.chanceRate + 0.06);
      next.duelIntensity = Math.min(1.25, next.duelIntensity + 0.04);
      break;
    case TacticalIntent.Counter:
      next.chanceRate = Math.min(1.35, next.chanceRate + 0.1);
      next.duelIntensity = Math.min(1.3, next.duelIntensity + 0.08);
      break;
    case TacticalIntent.BuildUp:
      next.duelIntensity = Math.max(0.72, next.duelIntensity - 0.04);
      next.chanceRate = Math.max(0.75, next.chanceRate - 0.03);
      break;
    default:
      next.chanceRate = Math.min(1.28, next.chanceRate + 0.05);
      break;
  }
  return next;
}

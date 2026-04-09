import type { LivePrematchBundle } from './storyContracts';

export interface PrematchCoachContext {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
  playingStyleLabel: string;
}

/**
 * Texto curto para o manager — usa só dados já permitidos no pré-jogo (sem placar / vencedor).
 */
export function prematchCoachSuggestion(pm: LivePrematchBundle, ctx: PrematchCoachContext): string {
  const { matrix, sectorHome, sectorAway } = pm;
  const { tacticalMentality: men, defensiveLine: defL, tempo, playingStyleLabel } = ctx;
  const chunks: string[] = [];

  if (matrix.atkVsDef >= 1.12) {
    chunks.push('A matriz de duelos favorece o teu ataque contra a última linha visitante.');
  } else if (matrix.atkVsDef <= 0.9) {
    chunks.push('O bloco ofensivo adversário aparece forte na matriz — cuidado nas transições.');
  }

  if (matrix.defVsAtk >= 1.1) {
    chunks.push('A tua defesa ganha duelos importantes no eixo defesa-vs-ataque deles.');
  } else if (matrix.defVsAtk <= 0.88) {
    chunks.push('O ataque visitante encaixa bem contra o teu setor defensivo; compactação ajuda.');
  }

  if (sectorHome.creative > sectorAway.creative + 6) {
    chunks.push('Meio-campo OLE com leitura de jogo ligeiramente superior ao modelo visitante.');
  }

  if (men < 40 && matrix.atkVsDef > 1.05) {
    chunks.push('Sugestão GameSpirit: há espaço para subir a mentalidade e explorar a frente.');
  } else if (men > 72 && matrix.defVsAtk < 0.95) {
    chunks.push('Sugestão GameSpirit: com risco na retaguarda, equilibra com linha defensiva ou ritmo mais cadenciado.');
  }

  if (defL > 72 && tempo > 70) {
    chunks.push('Linha alta + ritmo acelerado: confirma que o banco está pronto para refrescar o meio.');
  }

  if (playingStyleLabel) {
    chunks.push(`Plano atual (${playingStyleLabel}): mantém a identidade, ajusta pressão conforme o 1.º tempo.`);
  }

  if (!chunks.length) {
    return 'GameSpirit: duelo equilibrado na matriz — ajusta mentalidade e ritmo ao ritmo real da partida.';
  }
  return chunks.join(' ');
}

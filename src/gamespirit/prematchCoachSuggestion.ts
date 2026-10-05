import type { LivePrematchBundle } from './storyContracts';
import { L } from '@/i18n/L';

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
    chunks.push(L('A matriz de duelos favorece o teu ataque contra a última linha visitante.', 'The duel matrix favours your attack against their back line.'));
  } else if (matrix.atkVsDef <= 0.9) {
    chunks.push(L('O bloco ofensivo adversário aparece forte na matriz — cuidado nas transições.', 'Their attack looks strong in the matrix — careful in transition.'));
  }

  if (matrix.defVsAtk >= 1.1) {
    chunks.push(L('A tua defesa ganha duelos importantes no eixo defesa-vs-ataque deles.', 'Your defence wins key duels against their attack.'));
  } else if (matrix.defVsAtk <= 0.88) {
    chunks.push(L('O ataque visitante encaixa bem contra o teu setor defensivo; compactação ajuda.', 'Their attack matches up well against your defence; stay compact.'));
  }

  if (sectorHome.creative > sectorAway.creative + 6) {
    chunks.push(L('Meio-campo OLE com leitura de jogo ligeiramente superior ao modelo visitante.', 'OLE midfield reads the game slightly better than theirs.'));
  }

  if (men < 40 && matrix.atkVsDef > 1.05) {
    chunks.push(L('Sugestão GameSpirit: há espaço para subir a mentalidade e explorar a frente.', "GameSpirit tip: there's room to raise the mentality and push forward."));
  } else if (men > 72 && matrix.defVsAtk < 0.95) {
    chunks.push(L('Sugestão GameSpirit: com risco na retaguarda, equilibra com linha defensiva ou ritmo mais cadenciado.', 'GameSpirit tip: with risk at the back, balance it with the defensive line or a slower tempo.'));
  }

  if (defL > 72 && tempo > 70) {
    chunks.push(L('Linha alta + ritmo acelerado: confirma que o banco está pronto para refrescar o meio.', 'High line + fast tempo: make sure the bench is ready to freshen up midfield.'));
  }

  if (playingStyleLabel) {
    chunks.push(L(`Plano atual (${playingStyleLabel}): mantém a identidade, ajusta pressão conforme o 1.º tempo.`, `Current plan (${playingStyleLabel}): keep the identity, adjust the press after the 1st half.`));
  }

  if (!chunks.length) {
    return L('GameSpirit: duelo equilibrado na matriz — ajusta mentalidade e ritmo ao ritmo real da partida.', 'GameSpirit: even matchup in the matrix — adjust mentality and tempo to how the match unfolds.');
  }
  return chunks.join(' ');
}

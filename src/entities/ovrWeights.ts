/**
 * Pesos do OVR POR POSIÇÃO — fonte única.
 *
 * Antes, o OVR usava um peso único pra todo mundo: finalização valia 0,12 pro
 * goleiro, pro zagueiro e pro centroavante. Resultado: volante e zagueiro
 * excelentes não passavam de ~80 por não fazerem gol, enquanto atacante
 * mediano subia de graça.
 *
 * Regra de produto do fundador:
 *   ATACANTE  → o que importa é o GOL          (finalizacao)
 *   VOLANTE   → o que importa é o DESARME      (marcacao)
 *   MEIA      → o que importa é a ASSISTÊNCIA  (passe)
 *
 * DESENHO: mentalidade (.08), confiança (.08) e fair play (.06) são universais
 * — pesam igual em qualquer posição, somando 0,22. Os 0,78 restantes se
 * distribuem por posição entre os 7 atributos "de ofício".
 *
 * INVARIANTE: cada perfil soma exatamente 1.0. Há teste que falha se quebrar
 * (npm run test:ovr-weights). Sem isso, a escala do OVR deixa de ser comparável
 * entre posições — que era justamente o bug.
 */
import type { PlayerAttributes } from './types';

export type OvrWeights = Record<keyof PlayerAttributes, number>;

/** Universais — valem o mesmo pra qualquer posição (somam 0.22). */
const UNIVERSAL = { mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06 } as const;

/** Perfil por posição. Os 7 atributos de ofício somam 0.78. */
export const OVR_WEIGHTS_BY_POS: Record<string, OvrWeights> = {
  // Goleiro: posicionamento e presença. Finalização é praticamente irrelevante.
  GOL: { passe: 0.06, marcacao: 0.18, velocidade: 0.06, drible: 0.04, finalizacao: 0.02, fisico: 0.22, tatico: 0.20, ...UNIVERSAL },
  // Zagueiro: marcação + físico + leitura.
  ZAG: { passe: 0.08, marcacao: 0.24, velocidade: 0.07, drible: 0.02, finalizacao: 0.01, fisico: 0.18, tatico: 0.18, ...UNIVERSAL },
  // Laterais: velocidade e marcação, com drible pra subir a linha.
  LE:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  LD:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  // Volante: O DESARME manda. Depois leitura de jogo e saída de bola.
  VOL: { passe: 0.16, marcacao: 0.22, velocidade: 0.05, drible: 0.02, finalizacao: 0.01, fisico: 0.14, tatico: 0.18, ...UNIVERSAL },
  // Meio-campo central: distribuição + leitura, ainda com dever defensivo.
  MC:  { passe: 0.20, marcacao: 0.13, velocidade: 0.08, drible: 0.05, finalizacao: 0.02, fisico: 0.11, tatico: 0.19, ...UNIVERSAL },
  // Meia ofensivo: A ASSISTÊNCIA manda. Drible e chegada ao gol completam.
  MEI: { passe: 0.24, marcacao: 0.02, velocidade: 0.08, drible: 0.15, finalizacao: 0.12, fisico: 0.03, tatico: 0.14, ...UNIVERSAL },
  // Pontas: velocidade + drible, com passe e finalização de apoio.
  PE:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  PD:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  // Centroavante: O GOL manda, com folga.
  ATA: { passe: 0.05, marcacao: 0.01, velocidade: 0.16, drible: 0.13, finalizacao: 0.30, fisico: 0.09, tatico: 0.04, ...UNIVERSAL },
};

/**
 * Perfil neutro — usado quando a posição é desconhecida. É EXATAMENTE o peso
 * antigo, pra que jogador sem posição mantenha o OVR que já tinha.
 */
export const OVR_WEIGHTS_NEUTRAL: OvrWeights = {
  passe: 0.12, marcacao: 0.10, velocidade: 0.12, drible: 0.10, finalizacao: 0.12,
  fisico: 0.10, tatico: 0.12, mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06,
};

export function ovrWeightsForPos(pos?: string | null): OvrWeights {
  if (!pos) return OVR_WEIGHTS_NEUTRAL;
  return OVR_WEIGHTS_BY_POS[pos.trim().toUpperCase()] ?? OVR_WEIGHTS_NEUTRAL;
}

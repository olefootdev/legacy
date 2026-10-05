/**
 * OVR — a fórmula única, do lado do servidor.
 *
 * ⚠️ Cópia de `overallFromAttributes` + `OVR_WEIGHTS_BY_POS`
 * (src/entities/player.ts, src/entities/ovrWeights.ts). O servidor tem rootDir
 * próprio e não importa do jogo; `runSmartProfileSelfTest.mts` compara as duas
 * em milhares de fichas e falha se divergirem por 1 ponto que seja.
 */
import type { Atributos, AtributoNucleo } from './tipos.js';

type Pesos = Record<AtributoNucleo, number>;
const UNIVERSAL = { mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06 } as const;

const POR_POSICAO: Record<string, Pesos> = {
  GOL: { passe: 0.06, marcacao: 0.18, velocidade: 0.06, drible: 0.04, finalizacao: 0.02, fisico: 0.22, tatico: 0.20, ...UNIVERSAL },
  ZAG: { passe: 0.08, marcacao: 0.24, velocidade: 0.07, drible: 0.02, finalizacao: 0.01, fisico: 0.18, tatico: 0.18, ...UNIVERSAL },
  LE:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  LD:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  VOL: { passe: 0.16, marcacao: 0.22, velocidade: 0.05, drible: 0.02, finalizacao: 0.01, fisico: 0.14, tatico: 0.18, ...UNIVERSAL },
  MC:  { passe: 0.20, marcacao: 0.13, velocidade: 0.08, drible: 0.05, finalizacao: 0.02, fisico: 0.11, tatico: 0.19, ...UNIVERSAL },
  MEI: { passe: 0.24, marcacao: 0.02, velocidade: 0.08, drible: 0.15, finalizacao: 0.12, fisico: 0.03, tatico: 0.14, ...UNIVERSAL },
  PE:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  PD:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  ATA: { passe: 0.05, marcacao: 0.01, velocidade: 0.16, drible: 0.13, finalizacao: 0.30, fisico: 0.09, tatico: 0.04, ...UNIVERSAL },
};
const NEUTRO: Pesos = {
  passe: 0.12, marcacao: 0.10, velocidade: 0.12, drible: 0.10, finalizacao: 0.12,
  fisico: 0.10, tatico: 0.12, mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06,
};

export function ovrDe(a: Atributos, posicao?: string | null): number {
  const w = (posicao && POR_POSICAO[posicao.trim().toUpperCase()]) || NEUTRO;
  const total =
    a.passe * w.passe + a.marcacao * w.marcacao + a.velocidade * w.velocidade +
    a.drible * w.drible + a.finalizacao * w.finalizacao + a.fisico * w.fisico +
    a.tatico * w.tatico + a.mentalidade * w.mentalidade + a.confianca * w.confianca +
    a.fairPlay * w.fairPlay;
  return Math.round(Math.min(99, Math.max(40, total)));
}

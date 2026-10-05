/**
 * As 16 classes do SMART-PROFILE — o arquétipo único do jogador.
 *
 * Substitui os oito sistemas de arquétipo que conviviam no jogo. Cada classe
 * diz QUAIS atributos definem aquele tipo de jogador (`perfil`, soma 1.0). A
 * classe de um jogador é a de maior nota entre as permitidas para a posição
 * dele: nota = soma(atributo × peso). Determinístico e explicável — a mesma
 * ficha dá sempre a mesma classe, e dá pra mostrar ao manager o porquê.
 *
 * O `perfil` também é o que a Fase 2 usa para decidir quais atributos crescem
 * mais, e o que a Fase 3 manda para o motor da partida.
 */
import type { Atributo, ClasseId } from './tipos.js';

export type GrupoPosicao = 'gol' | 'zag' | 'lat' | 'vol' | 'mc' | 'mei' | 'ponta' | 'ata';

export interface Classe {
  id: ClasseId;
  setor: 'gol' | 'defesa' | 'meio' | 'ataque';
  grupos: readonly GrupoPosicao[];
  perfil: Partial<Record<Atributo, number>>;
}

export const CLASSES: readonly Classe[] = [
  { id: 'paredao', setor: 'gol', grupos: ['gol'], perfil: { marcacao: 0.35, fisico: 0.3, tatico: 0.2, mentalidade: 0.15 } },
  { id: 'goleiro_libero', setor: 'gol', grupos: ['gol'], perfil: { passe: 0.35, velocidade: 0.25, tatico: 0.25, confianca: 0.15 } },

  { id: 'xerife', setor: 'defesa', grupos: ['zag'], perfil: { marcacao: 0.4, fisico: 0.3, cabeceio: 0.2, mentalidade: 0.1 } },
  { id: 'zagueiro_construtor', setor: 'defesa', grupos: ['zag', 'vol'], perfil: { passe: 0.35, tatico: 0.35, marcacao: 0.2, confianca: 0.1 } },
  { id: 'lateral_apoiador', setor: 'defesa', grupos: ['lat'], perfil: { velocidade: 0.3, passe: 0.3, drible: 0.25, fisico: 0.15 } },
  { id: 'lateral_marcador', setor: 'defesa', grupos: ['lat'], perfil: { marcacao: 0.4, fisico: 0.25, tatico: 0.2, velocidade: 0.15 } },

  { id: 'volante_destruidor', setor: 'meio', grupos: ['vol', 'mc'], perfil: { marcacao: 0.4, fisico: 0.3, tatico: 0.2, mentalidade: 0.1 } },
  { id: 'regista', setor: 'meio', grupos: ['vol', 'mc'], perfil: { passe: 0.45, tatico: 0.35, mentalidade: 0.1, confianca: 0.1 } },
  { id: 'box_to_box', setor: 'meio', grupos: ['mc', 'vol', 'mei'], perfil: { fisico: 0.3, velocidade: 0.2, passe: 0.2, marcacao: 0.15, finalizacao: 0.15 } },
  { id: 'maestro', setor: 'meio', grupos: ['mei', 'mc'], perfil: { passe: 0.35, drible: 0.3, tatico: 0.2, confianca: 0.15 } },
  { id: 'meia_chegada', setor: 'meio', grupos: ['mei', 'mc'], perfil: { finalizacao: 0.4, velocidade: 0.2, drible: 0.2, passe: 0.2 } },

  { id: 'ponta_driblador', setor: 'ataque', grupos: ['ponta', 'mei'], perfil: { drible: 0.45, velocidade: 0.25, passe: 0.15, confianca: 0.15 } },
  { id: 'velocista', setor: 'ataque', grupos: ['ponta', 'ata'], perfil: { velocidade: 0.55, finalizacao: 0.2, drible: 0.15, fisico: 0.1 } },
  { id: 'pivo', setor: 'ataque', grupos: ['ata'], perfil: { fisico: 0.35, finalizacao: 0.3, cabeceio: 0.25, mentalidade: 0.1 } },
  { id: 'falso_9', setor: 'ataque', grupos: ['ata', 'mei'], perfil: { passe: 0.3, drible: 0.3, finalizacao: 0.25, tatico: 0.15 } },
  { id: 'matador', setor: 'ataque', grupos: ['ata'], perfil: { finalizacao: 0.55, confianca: 0.15, mentalidade: 0.15, velocidade: 0.15 } },
];

const GRUPO_DA_POSICAO: Record<string, GrupoPosicao> = {
  GOL: 'gol', GK: 'gol',
  ZAG: 'zag', ZC: 'zag',
  LD: 'lat', LE: 'lat', LAT: 'lat', ALA: 'lat',
  VOL: 'vol',
  MC: 'mc',
  MEI: 'mei',
  PE: 'ponta', PD: 'ponta', ME: 'ponta', MD: 'ponta',
  ATA: 'ata', CA: 'ata', SA: 'ata',
};

export function grupoDaPosicao(posicao: string): GrupoPosicao {
  return GRUPO_DA_POSICAO[posicao.trim().toUpperCase()] ?? 'mc';
}

export function classePorId(id: string): Classe | undefined {
  return CLASSES.find((c) => c.id === id);
}

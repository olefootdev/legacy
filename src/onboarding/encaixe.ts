/**
 * ENCAIXE: quanto um jogador cabe no DNA do clube (Fase 2 da Fundação).
 *
 * Cada eixo do DNA puxa os atributos que o motor usa pra ele (posse → passe +
 * tático; pressão → físico + marcação; …). O encaixe é a média desses atributos
 * PONDERADA pelo DNA efetivo — o mesmo vetor que a Partida Rápida e a Liga
 * Global jogam. Clube de posse valoriza quem passa; clube de pressão, quem corre.
 *
 * Usado na Janela da Estreia (quem vender pra várzea) e no Escalar (XI sugerido).
 */
import type { PlayerEntity, PlayerAttributes } from '@/entities/types';
import { overallFromAttributes, samePersonKey } from '@/entities/player';
import { PITCH_SLOT_ORDER } from '@/entities/lineup';
import { EIXOS_DNA, type DnaDoClube, type EixoDna } from '@/club/identidade';

export const ATRIBUTOS_DO_EIXO: Record<EixoDna, (keyof PlayerAttributes)[]> = {
  posse: ['passe', 'tatico'],
  pressao: ['fisico', 'marcacao'],
  vertical: ['velocidade', 'finalizacao'],
  criatividade: ['drible', 'passe'],
  solidez: ['marcacao', 'tatico'],
  disciplina: ['fairPlay', 'tatico'],
  intensidade: ['fisico', 'mentalidade'],
};

/** Eixos que o clube mais pede (DNA acima do neutro), do maior pro menor. */
export function eixosFortes(dna: DnaDoClube, n = 3): EixoDna[] {
  return [...EIXOS_DNA].sort((a, b) => dna[b] - dna[a]).slice(0, n);
}

/** Encaixe 0–100: atributos dos eixos, pesados pelo quanto o DNA passa do neutro. */
export function encaixe(p: Pick<PlayerEntity, 'attrs'>, dna: DnaDoClube): number {
  let soma = 0;
  let pesos = 0;
  for (const k of EIXOS_DNA) {
    // Peso só pro que o clube PEDE: eixo neutro ou abaixo quase não conta.
    const w = Math.max(0.05, dna[k] - 0.4) ** 2;
    const v = ATRIBUTOS_DO_EIXO[k].reduce((s, a) => s + (p.attrs[a] ?? 0), 0) / ATRIBUTOS_DO_EIXO[k].length;
    soma += v * w;
    pesos += w;
  }
  return pesos > 0 ? Math.round(soma / pesos) : 0;
}

export function ovrDe(p: PlayerEntity): number {
  return p.mintOverall ?? overallFromAttributes(p.attrs, p.pos);
}

/** Nota do slot: OVR manda, o encaixe desempata e pesa. */
export function notaPraEscalar(p: PlayerEntity, dna: DnaDoClube): number {
  return ovrDe(p) * 0.65 + encaixe(p, dna) * 0.35;
}

/**
 * XI pelo encaixe: cada slot com o melhor da posição; slot sem gente da
 * posição leva o melhor que sobrou (improviso — igual ao motor).
 */
export function escalarPeloEncaixe(players: Record<string, PlayerEntity>, dna: DnaDoClube): Record<string, string> {
  const pool = Object.values(players).filter((p) => (p.outForMatches ?? 0) === 0);
  const usados = new Set<string>();
  // Duas raridades da mesma pessoa no elenco: só uma é titular (regra do SET_LINEUP).
  const pessoas = new Set<string>();
  const lineup: Record<string, string> = {};
  const ordem = [...PITCH_SLOT_ORDER].sort((a, b) => (a.label === 'GOL' ? -1 : b.label === 'GOL' ? 1 : 0));
  const melhor = (ok: (p: PlayerEntity) => boolean) =>
    pool.filter((p) => !usados.has(p.id) && !pessoas.has(samePersonKey(p)) && ok(p)).sort((a, b) => notaPraEscalar(b, dna) - notaPraEscalar(a, dna))[0];
  // 1ª passada: só posição certa. 2ª: o que sobrou improvisa — senão um slot
  // sem dono "rouba" o melhor jogador de outra posição antes da vez dela.
  const poe = (slotId: string, p: PlayerEntity | undefined) => {
    if (!p) return;
    lineup[slotId] = p.id;
    usados.add(p.id);
    pessoas.add(samePersonKey(p));
  };
  for (const slot of ordem) poe(slot.id, melhor((x) => x.pos === slot.label));
  for (const slot of ordem) {
    if (lineup[slot.id] || slot.label === 'GOL') continue;
    poe(slot.id, melhor((x) => x.pos !== 'GOL'));
  }
  return lineup;
}

/** Quem a Janela sugere vender: menor nota, fora do XI, do pacote (nunca Edição Fundação). */
export function sugestaoDoDiretor(
  players: Record<string, PlayerEntity>,
  lineup: Record<string, string>,
  pacote: string[],
  dna: DnaDoClube,
): PlayerEntity | null {
  const titulares = new Set(Object.values(lineup));
  const candidatos = pacote
    .map((id) => players[id])
    .filter((p): p is PlayerEntity => !!p && !titulares.has(p.id) && p.pos !== 'GOL' && !p.edicaoFundacao);
  candidatos.sort((a, b) => notaPraEscalar(a, dna) - notaPraEscalar(b, dna));
  return candidatos[0] ?? null;
}

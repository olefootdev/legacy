/**
 * PARTIDA VIVA (Fase 3) — a classe de cada um dos 22 em campo, pelo
 * classificador oficial (`classeDe`), a partir dos MESMOS números que vão ao
 * motor. Viaja junto com o plano: o celular desenha o jeito de jogar de cada
 * classe (regista recua, velocista ataca as costas…) sem duplicar a tabela.
 * Só apresentação — não toca no resultado.
 */
import { classeDe } from './derivar.js';
import type { Atributos } from './tipos.js';

interface LinhaDoPlano {
  id?: unknown; pos?: unknown;
  passe?: number; marcacao?: number; velocidade?: number; drible?: number; finalizacao?: number;
  fisico?: number; tatico?: number; mentalidade?: number; confianca?: number; fair_play?: number;
  cabeceio?: number; bola_parada?: number; penalti?: number;
}

const n = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);

export function classesDaPartida(escalacoes: readonly (readonly object[])[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const escalacao of escalacoes) {
    for (const bruta of escalacao) {
      const p = bruta as LinhaDoPlano;
      if (typeof p.id !== 'string' || !p.id) continue;
      const a: Atributos = {
        passe: n(p.passe, 60), marcacao: n(p.marcacao, 60), velocidade: n(p.velocidade, 60), drible: n(p.drible, 60),
        finalizacao: n(p.finalizacao, 60), fisico: n(p.fisico, 60), tatico: n(p.tatico, 60), mentalidade: n(p.mentalidade, 60),
        confianca: n(p.confianca, 60), fairPlay: n(p.fair_play, 70), cabeceio: n(p.cabeceio, 55), bolaParada: n(p.bola_parada, 55),
        penalti: n(p.penalti, 55),
      };
      out[p.id] = classeDe(typeof p.pos === 'string' ? p.pos : 'MC', a).classe;
    }
  }
  return out;
}

/**
 * O ADVERSÁRIO AUSENTE JOGA PELO PLANO SALVO (Partida Viva, Fase 4) — o plano.
 *
 * O time de fora de uma partida LEGACY é de outro manager, que não está ali.
 * O plano salvo dele são as decisões que ELE tomou de verdade na última partida
 * que jogou em campo — guardadas na custódia (`quick_plans_emitidos`: o pedido
 * do motor com os comandos, os lances e as escolhas declaradas). Cada estilo e
 * cada grito vira uma regra presa à situação do placar daquele minuto, do
 * ponto de vista dele: "perdendo, depois dos 60', foi pro ataque e cobrou".
 * O motor cumpre (server/smartfield/plano_salvo.py). Puro, sem banco.
 */
import { contarPartida, costurar, lerEscolhas } from './partida/placar.js';
import type { PlanoGuardado } from './arena.js';

export type Situacao = 'ganhando' | 'empatando' | 'perdendo' | 'qualquer';
export interface RegraDoPlano { depois: number; quando: Situacao; estilo?: string; grito?: string }

const ESTILOS = new Set(['defend', 'counter', 'possession', 'press', 'attack']);
const GRITOS = new Set(['incentivar', 'cobrar', 'acalmar']);
export const MAX_REGRAS = 4;

/**
 * As regras do plano salvo a partir dos planos de UMA partida do ausente, na
 * ordem de emissão (o último pedido carrega o histórico inteiro de comandos).
 * Sem comando de estilo ou grito: plano vazio (o time joga pelo DNA, como antes).
 */
export function planoSalvoDaCustodia(planos: readonly (PlanoGuardado & { escolhas_declaradas?: unknown })[]): RegraDoPlano[] {
  if (!planos.length) return [];
  const ultimo = planos[planos.length - 1]!;
  const comandos = Array.isArray(ultimo.entrada?.comandos) ? (ultimo.entrada!.comandos as Array<Record<string, unknown>>) : [];
  const escolhas = lerEscolhas([...planos].reverse().find((p) => p.escolhas_declaradas)?.escolhas_declaradas);
  const { lances } = costurar(planos);
  const porMinuto = new Map<number, RegraDoPlano>();
  for (const c of comandos) {
    const minuto = Number(c.minuto);
    if (!Number.isInteger(minuto) || minuto < 1 || minuto > 90) continue;
    const estilo = c.tipo === 'estilo' && typeof c.estilo === 'string' && ESTILOS.has(c.estilo) ? c.estilo : undefined;
    const grito = typeof c.tipo === 'string' && GRITOS.has(c.tipo) ? c.tipo : undefined;
    if (!estilo && !grito) continue;
    // A situação de quando ELE decidiu (ele era a casa na partida dele).
    const p = contarPartida(lances, escolhas, minuto).placar;
    const quando: Situacao = p[0] > p[1] ? 'ganhando' : p[0] < p[1] ? 'perdendo' : 'empatando';
    const r = porMinuto.get(minuto) ?? { depois: minuto, quando };
    if (estilo) r.estilo = estilo;
    if (grito) r.grito = grito;
    porMinuto.set(minuto, r);
  }
  return [...porMinuto.values()].sort((a, b) => a.depois - b.depois).slice(0, MAX_REGRAS);
}

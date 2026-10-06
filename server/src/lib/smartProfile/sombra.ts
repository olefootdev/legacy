/**
 * MODO SOMBRA (Fase 2A) — compara a evolução que o celular aplicou com a que o
 * servidor calcula, jogador por jogador. Pura: recebe o relato já validado e as
 * fichas guardadas; devolve a linha de `evolucao_sombra`.
 */
import { atributosCompletos } from './derivar.js';
import { evoluirPorPartida, pesosValidos, type LinhaDaPartida, type Resultado } from './evolucao.js';
import { diferencaDeAtributos } from './ficha.js';
import type { Atributos, Ficha } from './tipos.js';

export interface RelatoJogador {
  id: string;
  pos: string;
  antes: { attrs: Record<string, unknown>; xp: number; ovrNascimento: number | null; taxa: number | null; criadoPeloManager: boolean };
  linha: LinhaDaPartida;
  gols: number;
  chutes: number;
  depois: { attrs: Record<string, unknown>; xp: number };
}
export interface RelatoPartida {
  seed: string;
  placar: [number, number];
  penaltis: 'home' | 'away' | null;
  leitura: number;
  estilo: unknown;
  /** Ids dos planos emitidos (1º tempo e, se houve, 2º tempo) — Fase 2B. */
  planos: string[];
  jogadores: RelatoJogador[];
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Valida o corpo vindo do celular. Devolve null se algo estiver fora do formato. */
export function lerRelato(b: unknown): RelatoPartida | null {
  if (!obj(b)) return null;
  const seed = typeof b.seed === 'string' ? b.seed.slice(0, 200) : '';
  const placar = Array.isArray(b.placar) ? b.placar.map(n) : [];
  if (!seed || placar.length !== 2 || placar.some((x) => !Number.isInteger(x) || x < 0 || x > 30)) return null;
  const penaltis = b.penaltis === 'home' || b.penaltis === 'away' ? b.penaltis : null;
  const leitura = n(b.leitura);
  if (!Array.isArray(b.jogadores) || b.jogadores.length === 0 || b.jogadores.length > 30) return null;
  const jogadores: RelatoJogador[] = [];
  for (const j of b.jogadores) {
    if (!obj(j) || typeof j.id !== 'string' || typeof j.pos !== 'string' || !obj(j.antes) || !obj(j.depois) || !obj(j.linha)) return null;
    const a = j.antes, d = j.depois, l = j.linha;
    if (!obj(a.attrs) || !obj(d.attrs)) return null;
    const linha = { rating: n(l.rating), passesOk: n(l.passesOk), passesAttempt: n(l.passesAttempt), tackles: n(l.tackles), km: n(l.km) };
    if (Object.values(linha).some(Number.isNaN)) return null;
    jogadores.push({
      id: j.id.slice(0, 120), pos: j.pos.slice(0, 8),
      antes: { attrs: a.attrs, xp: Number.isFinite(n(a.xp)) ? n(a.xp) : 0,
        ovrNascimento: Number.isFinite(n(a.ovrNascimento)) ? n(a.ovrNascimento) : null,
        taxa: Number.isFinite(n(a.taxa)) ? n(a.taxa) : null, criadoPeloManager: a.criadoPeloManager === true },
      linha,
      gols: Number.isInteger(n(j.gols)) && n(j.gols) >= 0 ? n(j.gols) : 0,
      chutes: Number.isInteger(n(j.chutes)) && n(j.chutes) >= 0 ? n(j.chutes) : 0,
      depois: { attrs: d.attrs, xp: Number.isFinite(n(d.xp)) ? n(d.xp) : 0 },
    });
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const planos = Array.isArray(b.planos) ? [...new Set(b.planos.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, 2) : [];
  return { seed, placar: placar as [number, number], penaltis, leitura: Number.isFinite(leitura) ? leitura : 0, estilo: b.estilo, planos, jogadores };
}

/** Mesma regra do celular (computeQuickPlanCredit): empate no tempo normal vai aos pênaltis. */
export function resultadoDe(placar: [number, number], penaltis: 'home' | 'away' | null): Resultado {
  const [c, f] = placar;
  if (c > f || (c === f && penaltis === 'home')) return 'win';
  if (c < f || (c === f && penaltis === 'away')) return 'loss';
  return 'draw';
}

export interface Comparacao {
  resultado: Resultado;
  jogadores: number;
  divergencias: number;
  antes_diferente: number;
  detalhes: Array<{ id: string; atributos?: Record<string, [number, number]>; xp?: [number, number]; antes?: Record<string, [number, number]> }>;
}

/** O que o servidor decidiu para um jogador — Fase 2C grava isto na ficha. */
export interface CreditoJogador {
  id: string;
  posicao: string;
  atributos: Atributos;
  xp: number;
  swing: number;
  /** false = não havia ficha; a base foi o "antes" do celular (não é autoridade). */
  daFicha: boolean;
}

/**
 * Teto na linha da partida (Fase 2C). O caminho vivo manda passe, desarme e
 * km em ZERO (MatchQuickEngaged: `passesOk: 0, passesAttempt: 0, tackles: 0,
 * km: 0`), então o swing nasce só da NOTA — que a custódia confere contra os
 * lances do plano — e do resultado. Mas o corpo é do cliente: sem teto, um
 * pedido forjado pediria km 99 e passe perfeito e ganharia +2 de swing por
 * partida sem passar pela custódia. Os limites são generosos de propósito:
 * cortam o absurdo, não a jogada boa.
 */
export function limitarLinha(l: LinhaDaPartida | undefined): { linha: LinhaDaPartida | undefined; cortou: boolean } {
  if (!l) return { linha: undefined, cortou: false };
  const tet = (v: number, max: number) => Math.min(max, Math.max(0, Number.isFinite(v) ? v : 0));
  const linha: LinhaDaPartida = {
    rating: Math.min(10, Math.max(0, Number.isFinite(l.rating) ? l.rating : 6.5)),
    passesAttempt: tet(l.passesAttempt, 150),
    passesOk: 0,
    tackles: tet(l.tackles, 15),
    km: tet(l.km, 14),
  };
  linha.passesOk = Math.min(linha.passesAttempt, tet(l.passesOk, 150));
  const cortou = linha.rating !== l.rating || linha.passesAttempt !== l.passesAttempt
    || linha.passesOk !== l.passesOk || linha.tackles !== l.tackles || linha.km !== l.km;
  return { linha, cortou };
}

/**
 * FASE 2C — a conta do servidor passa a VALER, e por isso ela parte da FICHA.
 *
 * Na 2A o "antes" vinha do celular e isto era só comparação. Agora a base é a
 * ficha que o servidor guarda (sincronizada com o elenco na emissão do plano,
 * ver plano.ts): o celular informa o DESEMPENHO — e a nota é conferida pela
 * custódia contra os lances do plano —, não o ponto de partida.
 *
 * Sem ficha (jogador que o servidor não conhece) o servidor não tem autoridade:
 * cai no "antes" do celular e marca `daFicha: false`, para o chamador não
 * gravar isso como verdade.
 *
 * `divergencias` continua medindo a mesma coisa útil: a conta do celular bate
 * com a do servidor? Só que agora, quando não bate, quem vale é o servidor.
 */
export function compararPartida(r: RelatoPartida, fichas: Map<string, Pick<Ficha, 'atributos'>>): Comparacao & { credito: CreditoJogador[] } {
  const resultado = resultadoDe(r.placar, r.penaltis);
  const pesos = pesosValidos(r.estilo);
  const xpLeitura = Math.round(r.leitura * 3);
  const out: Comparacao & { credito: CreditoJogador[] } = { resultado, jogadores: r.jogadores.length, divergencias: 0, antes_diferente: 0, detalhes: [], credito: [] };
  for (const j of r.jogadores) {
    const doCelular = atributosCompletos(j.antes.attrs, j.pos);
    const ficha0 = fichas.get(j.id);
    const antes = ficha0 ? atributosCompletos(ficha0.atributos, j.pos) : doCelular;
    const { linha: linhaLimitada } = limitarLinha(j.linha);
    const srv = evoluirPorPartida(
      { posicao: j.pos, atributos: antes, xp: j.antes.xp, taxaEvolucao: j.antes.taxa, ovrNascimento: j.antes.ovrNascimento, criadoPeloManager: j.antes.criadoPeloManager },
      linhaLimitada, resultado, pesos, xpLeitura,
    );
    out.credito.push({ id: j.id, posicao: j.pos, atributos: srv.atributos, xp: srv.xp, swing: srv.swing, daFicha: !!ficha0 });
    const cel = atributosCompletos(j.depois.attrs, j.pos);
    // Diferença = [servidor, celular] por atributo.
    const difAttrs = diferencaDeAtributos(srv.atributos, cel as Atributos);
    const difXp = srv.xp !== j.depois.xp ? ([srv.xp, j.depois.xp] as [number, number]) : undefined;
    const difAntes = ficha0 ? diferencaDeAtributos(atributosCompletos(ficha0.atributos, j.pos), doCelular) : undefined;
    const temDifAntes = !!difAntes && Object.keys(difAntes).length > 0;
    if (Object.keys(difAttrs).length || difXp) out.divergencias++;
    if (temDifAntes) out.antes_diferente++;
    if (Object.keys(difAttrs).length || difXp || temDifAntes) {
      out.detalhes.push({ id: j.id,
        ...(Object.keys(difAttrs).length ? { atributos: difAttrs } : {}),
        ...(difXp ? { xp: difXp } : {}),
        ...(temDifAntes ? { antes: difAntes } : {}) });
    }
  }
  return out;
}

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
  depois: { attrs: Record<string, unknown>; xp: number };
}
export interface RelatoPartida {
  seed: string;
  placar: [number, number];
  penaltis: 'home' | 'away' | null;
  leitura: number;
  estilo: unknown;
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
      depois: { attrs: d.attrs, xp: Number.isFinite(n(d.xp)) ? n(d.xp) : 0 },
    });
  }
  return { seed, placar: placar as [number, number], penaltis, leitura: Number.isFinite(leitura) ? leitura : 0, estilo: b.estilo, jogadores };
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

export function compararPartida(r: RelatoPartida, fichas: Map<string, Pick<Ficha, 'atributos'>>): Comparacao {
  const resultado = resultadoDe(r.placar, r.penaltis);
  const pesos = pesosValidos(r.estilo);
  const xpLeitura = Math.round(r.leitura * 3);
  const out: Comparacao = { resultado, jogadores: r.jogadores.length, divergencias: 0, antes_diferente: 0, detalhes: [] };
  for (const j of r.jogadores) {
    const antes = atributosCompletos(j.antes.attrs, j.pos);
    const srv = evoluirPorPartida(
      { posicao: j.pos, atributos: antes, xp: j.antes.xp, taxaEvolucao: j.antes.taxa, ovrNascimento: j.antes.ovrNascimento, criadoPeloManager: j.antes.criadoPeloManager },
      j.linha, resultado, pesos, xpLeitura,
    );
    const cel = atributosCompletos(j.depois.attrs, j.pos);
    // Diferença = [servidor, celular] por atributo.
    const difAttrs = diferencaDeAtributos(srv.atributos, cel as Atributos);
    const difXp = srv.xp !== j.depois.xp ? ([srv.xp, j.depois.xp] as [number, number]) : undefined;
    const ficha = fichas.get(j.id);
    const difAntes = ficha ? diferencaDeAtributos(ficha.atributos, antes) : undefined;
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

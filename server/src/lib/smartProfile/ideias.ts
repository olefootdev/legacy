/**
 * MANAGER-IDEAS (Fase 5) — o cérebro do jogador, e a chave de ouro do plano.
 *
 * As quatro fases anteriores construíram as condições para esta:
 *
 *   Fase 1  a ficha trouxe o CÉREBRO (espaços por raridade), a CLASSE e o
 *           TEMPERAMENTO — é o que decide quem pode aprender o quê.
 *   Fase 2C o servidor passou a gravar a carreira com histórico append-only —
 *           é onde "aprendeu" e "esqueceu" ficam registrados.
 *   Fase 3  o servidor virou dono da entrada do motor — é o que faz a ideia
 *           chegar ao Python sem o celular poder reivindicá-la.
 *   Fase 4  o nível virou real — é o que destrava a ideia.
 *
 * O QUE SEPARA IDEIA DE TRAÇO:
 *   · traço é AUTOMÁTICO (conquistado por marco) e vale sempre;
 *   · ideia é ESCOLHIDA pelo manager, ocupa espaço no cérebro, e só vale QUANDO
 *     a partida pede. E tem CONTRAPARTIDA.
 *
 * A contrapartida é o que faz disso uma decisão. Uma ideia que só soma é buff,
 * não instrução de treinador: "mata-leão" marca mais e finaliza menos, e o
 * manager escolhe se vale nesta partida.
 *
 * As condições são lidas do pedido do plano. Duas delas o cliente controla — a
 * força do adversário e o clássico —, e isso não é brecha: inflar o adversário
 * para disparar uma ideia defensiva deixa a partida MAIS DIFÍCIL no motor, e o
 * clássico já amplia os dois lados. Mentir ali é se prejudicar. A força do
 * PRÓPRIO time vem da ficha (Fase 3B), então a comparação tem um lado firme.
 *
 * Tudo puro: `runIdeiasSelfTest.mts`.
 */
import { classePorId } from './classes.js';
import type { AtributoNucleo, ClasseId, Temperamento } from './tipos.js';

export type Setor = 'gol' | 'defesa' | 'meio' | 'ataque';
export type EixoDeTemperamento = keyof Temperamento;

/** O que o servidor sabe da partida quando emite o plano. */
export interface ContextoDaPartida {
  /** Média de OVR das fichas dos meus 11 (Fase 3B) — o lado firme da comparação. */
  minhaForca: number | null;
  /** Força do adversário como veio no pedido. Inflar aqui é se prejudicar. */
  forcaAdversario: number;
  derby: boolean;
  intensidade: 'defensive' | 'balanced' | 'offensive';
  segundoTempo: boolean;
}

export interface Ideia {
  id: string;
  /** Nível mínimo (Fase 4). */
  nivel: number;
  /** Setores que fazem sentido para a ideia (Fase 1 — classe). */
  setores: readonly Setor[];
  /** Eixo do temperamento e o mínimo exigido (Fase 1). O jogador precisa topar. */
  exige: { eixo: EixoDeTemperamento; minimo: number };
  /** Quando a ideia vale em campo. */
  quando: (ctx: ContextoDaPartida) => boolean;
  /** O que ela muda no que vai ao motor. Tem negativo de propósito. */
  efeito: Partial<Record<AtributoNucleo, number>>;
}

const VANTAGEM = 5; // diferença de OVR que caracteriza favorito/azarão

export const IDEIAS: Ideia[] = [
  {
    // Azarão: fecha e sai menos.
    id: 'mata_leao', nivel: 5, setores: ['defesa', 'meio'],
    exige: { eixo: 'frieza', minimo: 55 },
    quando: (c) => c.minhaForca !== null && c.forcaAdversario >= c.minhaForca + VANTAGEM,
    efeito: { marcacao: 3, tatico: 1, finalizacao: -2 },
  },
  {
    // Com o time montado para atacar, ele vai pro gol — e cobre menos.
    id: 'chave_do_jogo', nivel: 5, setores: ['meio', 'ataque'],
    exige: { eixo: 'ousadia', minimo: 55 },
    quando: (c) => c.intensidade === 'offensive',
    efeito: { finalizacao: 3, drible: 1, marcacao: -2 },
  },
  {
    // Clássico: joga com o peito, pensa menos.
    id: 'dono_do_classico', nivel: 10, setores: ['gol', 'defesa', 'meio', 'ataque'],
    exige: { eixo: 'ambicao', minimo: 60 },
    quando: (c) => c.derby,
    efeito: { confianca: 2, fisico: 2, tatico: -1 },
  },
  {
    // Segurar o resultado: posição em vez de corrida.
    id: 'segura_o_jogo', nivel: 8, setores: ['gol', 'defesa', 'meio'],
    exige: { eixo: 'frieza', minimo: 60 },
    quando: (c) => c.intensidade === 'defensive' || c.segundoTempo,
    efeito: { tatico: 3, marcacao: 1, velocidade: -2 },
  },
  {
    // Favorito que não relaxa: controla o jogo em vez de atropelar.
    id: 'favorito_nao_relaxa', nivel: 12, setores: ['defesa', 'meio', 'ataque'],
    exige: { eixo: 'lealdade', minimo: 55 },
    quando: (c) => c.minhaForca !== null && c.minhaForca >= c.forcaAdversario + VANTAGEM,
    efeito: { mentalidade: 2, passe: 2, velocidade: -2 },
  },
];

const porId = new Map(IDEIAS.map((i) => [i.id, i]));
export const ideiaPorId = (id: string): Ideia | undefined => porId.get(id);

export const setorDaClasse = (classe: ClasseId): Setor | null => classePorId(classe)?.setor ?? null;

/** Ideias válidas que estão no cérebro (ignora lixo e repetição). */
export function ideiasDoCerebro(bruto: unknown[] | null | undefined): string[] {
  const vistas = new Set<string>();
  for (const i of bruto ?? []) {
    const id = typeof i === 'string' ? i : (i as { id?: unknown })?.id;
    if (typeof id === 'string' && porId.has(id)) vistas.add(id);
  }
  return [...vistas];
}

export type RecusaDeAprendizado =
  | 'ideia-desconhecida' | 'ja-sabe' | 'sem-espaco' | 'nivel-baixo' | 'fora-do-setor' | 'nao-topa';

export interface Veredito { pode: boolean; motivo?: RecusaDeAprendizado; detalhe?: string }

/**
 * O jogador aceita essa ideia? Quatro portas, e as quatro vêm das fases
 * anteriores: espaço (raridade/Fase 1), nível (Fase 4), setor (classe/Fase 1) e
 * temperamento (Fase 1).
 *
 * A porta do temperamento é a que dá personalidade ao plantel: um jogador
 * frio topa segurar o jogo; um sem ambição não vira dono do clássico. O manager
 * não molda o jogador no que quiser — ele ensina quem está disposto a aprender.
 */
export function podeAprender(
  ficha: { nivel: number; classe: ClasseId; temperamento: Temperamento; cerebro: { espacos: number; ideias: unknown[] } },
  ideiaId: string,
): Veredito {
  const ideia = porId.get(ideiaId);
  if (!ideia) return { pode: false, motivo: 'ideia-desconhecida' };

  const jaSabe = ideiasDoCerebro(ficha.cerebro?.ideias);
  if (jaSabe.includes(ideia.id)) return { pode: false, motivo: 'ja-sabe' };

  const espacos = Math.max(0, Math.round(ficha.cerebro?.espacos ?? 0));
  if (jaSabe.length >= espacos) {
    return { pode: false, motivo: 'sem-espaco', detalhe: `${jaSabe.length}/${espacos}` };
  }
  if (ficha.nivel < ideia.nivel) {
    return { pode: false, motivo: 'nivel-baixo', detalhe: `${ficha.nivel}/${ideia.nivel}` };
  }
  const setor = setorDaClasse(ficha.classe);
  if (!setor || !ideia.setores.includes(setor)) {
    return { pode: false, motivo: 'fora-do-setor', detalhe: setor ?? '?' };
  }
  const tem = Math.round(ficha.temperamento?.[ideia.exige.eixo] ?? 0);
  if (tem < ideia.exige.minimo) {
    return { pode: false, motivo: 'nao-topa', detalhe: `${ideia.exige.eixo} ${tem}/${ideia.exige.minimo}` };
  }
  return { pode: true };
}

/** Teto do lado POSITIVO. O negativo passa inteiro: a contrapartida é o ponto. */
export const TETO_POSITIVO_POR_ATRIBUTO = 3;
export const TETO_POSITIVO_TOTAL = 6;

export interface EfeitoDasIdeias {
  /** Ideias que a partida acionou. */
  acionadas: string[];
  /** Ideias no cérebro que não se aplicam a esta partida. */
  dormindo: string[];
  deltas: Partial<Record<AtributoNucleo, number>>;
}

/**
 * O que o cérebro faz NESTA partida. Ideia que não casa com o contexto fica
 * dormindo — e isso é a mecânica, não uma falha: o manager escolhe ideias para
 * os jogos que espera jogar.
 */
export function efeitoDasIdeias(
  cerebro: { ideias: unknown[] } | null | undefined,
  ctx: ContextoDaPartida,
): EfeitoDasIdeias {
  const out: EfeitoDasIdeias = { acionadas: [], dormindo: [], deltas: {} };
  for (const id of ideiasDoCerebro(cerebro?.ideias)) {
    const ideia = porId.get(id)!;
    if (!ideia.quando(ctx)) { out.dormindo.push(id); continue; }
    out.acionadas.push(id);
    for (const [k, v] of Object.entries(ideia.efeito)) {
      const atributo = k as AtributoNucleo;
      out.deltas[atributo] = (out.deltas[atributo] ?? 0) + (v ?? 0);
    }
  }
  // Limita só o que soma. Duas ideias no mesmo atributo não viram +6.
  let somaPositiva = 0;
  for (const k of Object.keys(out.deltas) as AtributoNucleo[]) {
    const v = out.deltas[k] ?? 0;
    if (v > TETO_POSITIVO_POR_ATRIBUTO) out.deltas[k] = TETO_POSITIVO_POR_ATRIBUTO;
    somaPositiva += Math.max(0, out.deltas[k] ?? 0);
  }
  if (somaPositiva > TETO_POSITIVO_TOTAL) {
    const ordem = (Object.keys(out.deltas) as AtributoNucleo[])
      .filter((k) => (out.deltas[k] ?? 0) > 0)
      .sort((a, b) => (out.deltas[a] ?? 0) - (out.deltas[b] ?? 0));
    for (const k of ordem) {
      while ((out.deltas[k] ?? 0) > 0 && somaPositiva > TETO_POSITIVO_TOTAL) {
        out.deltas[k] = (out.deltas[k] ?? 0) - 1;
        somaPositiva--;
      }
      if (out.deltas[k] === 0) delete out.deltas[k];
    }
  }
  return out;
}

/** O catálogo como o cliente precisa dele — sem as funções. */
export const catalogoDeIdeias = () =>
  IDEIAS.map(({ id, nivel, setores, exige, efeito }) => ({ id, nivel, setores: [...setores], exige, efeito }));

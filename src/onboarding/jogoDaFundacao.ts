/**
 * JOGO DA FUNDAÇÃO (Fase 3 da Fundação do Clube, 2026-10-07).
 *
 * A estreia é contra o FANTASMA do time histórico que o manager escolheu como
 * inspiração: mesma força do time dele (é um espelho, não um massacre — o
 * Barça 2010–11 com força 93 contra um elenco de OVR 35 não ensina nada) e o
 * DNA daquele time (`dnaDoTimeHistorico`). O jogo roda no motor de verdade
 * (POST /api/match/quick-plan, o mesmo Python da Partida Rápida).
 *
 * O RELATÓRIO DE IDENTIDADE não sai deste jogo (um jogo é amostra — ver o
 * bloco do relatório): sai da análise do motor, o mesmo confronto em ~150
 * seeds com e sem o DNA da casa.
 */
import type { FetchQuickPlanInput, QuickPlanPlayerPayload } from '@/match/quickPlanClient';
import type { PlayerEntity } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { applyFormationToPayloads, buildQuickPlanInputs } from '@/match/quickEngaged/buildQuickPlanInputs';
import {
  dnaDoClubeParaMotor,
  dnaDoTimeHistorico,
  EIXOS_DNA,
  TIMES_HISTORICOS,
  type DnaDoClube,
  type EixoDna,
  type IdentidadeDoClube,
} from '@/club/identidade';

/** Sem time histórico escolhido, o fantasma é a Seleção de 70. */
const FANTASMA_PADRAO = { time: 'selecao', temporada: '1970' } as const;

/** Sigla de placar de cada time histórico (a de jornal, não a gerada). */
const SIGLA_DO_TIME: Record<string, string> = {
  barcelona: 'BAR', selecao: 'BRA', saopaulo: 'SAO', flamengo: 'FLA', milan: 'MIL',
  holanda: 'HOL', liverpool: 'LIV', realmadrid: 'RMA', atletico: 'ATM', santos: 'SAN',
};
/** "do Barcelona", "da Holanda", "da Seleção". */
const ARTIGO_DO_TIME: Record<string, string> = { selecao: 'da Seleção', holanda: 'da Holanda' };

export interface Fantasma {
  time: string;
  temporada: string;
  nome: string;
  /** Sigla de 3 letras pro placar. */
  sigla: string;
  dna: DnaDoClube;
}

export function fantasmaDe(identidade: Pick<IdentidadeDoClube, 'historico'>): Fantasma {
  const h = identidade.historico && TIMES_HISTORICOS[identidade.historico.time]?.temporadas[identidade.historico.temporada]
    ? identidade.historico
    : FANTASMA_PADRAO;
  const nome = TIMES_HISTORICOS[h.time]!.nome;
  const sigla = SIGLA_DO_TIME[h.time] ?? nome.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return { time: h.time, temporada: h.temporada, nome, sigla, dna: dnaDoTimeHistorico(h.time, h.temporada)! };
}

/** Seed fixa por clube: rejogar a estreia dá o MESMO jogo (sem rolar até o relatório ficar bonito). */
export function seedDaFundacao(clubId: string, fundadoEm: string): string {
  return `fundacao|${clubId}|${fundadoEm}`;
}

/** Número da camisa por posição — o fantasma não tem nome de jogador real, tem o "9 do Barcelona". */
const CAMISA_DA_POS: Record<string, number> = { GOL: 1, LD: 2, ZAG: 4, LE: 6, VOL: 5, MC: 8, PE: 11, PD: 7, ATA: 9 };

/** Renomeia o elenco sintético: "O 9 do Barcelona". Ids próprios (`fantasma-i`). */
export function vestirFantasma(lineup: QuickPlanPlayerPayload[], f: Fantasma): QuickPlanPlayerPayload[] {
  const usados = new Set<number>();
  return lineup.map((p, i) => {
    let n = CAMISA_DA_POS[p.pos] ?? 10;
    while (usados.has(n)) n = n === 10 ? 3 : n + 10;
    usados.add(n);
    return { ...p, id: `fantasma-${i}`, name: `O ${n} ${ARTIGO_DO_TIME[f.time] ?? `do ${f.nome}`}` };
  });
}

/**
 * Entrada do motor pro Jogo da Fundação: o MESMO caminho da Partida Rápida
 * (`buildQuickPlanInputs` + formação), a casa com o DNA do clube e o rival
 * fantasma com a mesma força da casa e o DNA do time histórico.
 */
export function montarJogoDaFundacao(args: {
  players: Record<string, PlayerEntity>;
  playerHealth: Record<string, PlayerHealth> | undefined;
  lineup: Record<string, string>;
  clubId: string;
  clubShort: string;
  formacao: FormationSchemeId;
  identidade: IdentidadeDoClube;
}): { input: FetchQuickPlanInput; fantasma: Fantasma } {
  const fantasma = fantasmaDe(args.identidade);
  const seed = seedDaFundacao(args.clubId, args.identidade.fundadoEm);
  const base = buildQuickPlanInputs({
    players: args.players,
    playerHealth: args.playerHealth,
    lineup: args.lineup,
    homeShort: args.clubShort,
    awayShort: fantasma.sigla,
    awayStrength: 70,
    seed,
    awaySeedKey: `${seed}|fantasma`,
  }).input;
  // Espelho: o fantasma tem a força da casa (refaz o elenco sintético com ela).
  const espelho = buildQuickPlanInputs({
    players: args.players,
    playerHealth: args.playerHealth,
    lineup: args.lineup,
    homeShort: args.clubShort,
    awayShort: fantasma.sigla,
    awayStrength: base.homeStrength,
    seed,
    awaySeedKey: `${seed}|fantasma`,
  }).input;
  return {
    fantasma,
    input: {
      ...espelho,
      homeLineup: applyFormationToPayloads(espelho.homeLineup, args.formacao),
      awayLineup: vestirFantasma(espelho.awayLineup, fantasma),
      homeDna: dnaDoClubeParaMotor(args.identidade),
      fantasma: { dna: fantasma.dna },
    },
  };
}

/* ── Relatório de Identidade ───────────────────────────────────────────────── */
/*
 * UM jogo não prova identidade: o efeito típico do DNA (±2 pp de posse, ±10%
 * de xG por chute) some no ruído de uma partida (desvio ~7 pp de posse). Medido
 * em 07/10: o sinal certo aparecia em só 57% dos jogos isolados. Então o
 * relatório vem da ANÁLISE do motor (`analise_identidade` no Python): o mesmo
 * confronto em N seeds, com e sem o DNA da casa, pareado. A diferença é o DNA.
 */

export type MetricaDoEixo = 'possession_pct' | 'high_recoveries' | 'shots' | 'xg_per_shot' | 'conceded_shots' | 'fouls' | 'momentum';

export interface AnaliseDoMotor {
  n: number;
  eixos: Record<EixoDna, { metrica: MetricaDoEixo; sinal: 1 | -1; com: number; sem: number; pareadas_pro_alto: number }>;
  vitorias_pct: { com: number; sem: number };
}

export type Veredito = 'apareceu' | 'discreto' | 'contra';

export interface LinhaDoRelatorio {
  eixo: EixoDna;
  /** Pra onde o manager pediu: +1 acima do neutro, -1 abaixo. */
  direcao: 1 | -1;
  /** O que o motor aplicou (0.12–0.88). */
  pedido: number;
  com: number;
  sem: number;
  /** Variação relativa da métrica com o DNA (0.1 = +10%). */
  variacao: number;
  veredito: Veredito;
  /** "52,0% de posse × 50,3% sem a tua identidade". */
  prova: string;
}

export interface RelatorioDeIdentidade {
  n: number;
  linhas: LinhaDoRelatorio[];
  /** 0–100: quantos dos eixos pedidos apareceram em campo. */
  fidelidade: number;
  vitorias: { com: number; sem: number };
}

/** Abaixo de 3% de variação, o efeito existe mas não muda o jogo de forma visível. */
export const LIMIAR_VISIVEL = 0.03;

function fmtMetrica(m: MetricaDoEixo, v: number, L: (pt: string, en: string) => string): string {
  const n1 = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  switch (m) {
    case 'possession_pct': return L(`${n1(v)}% de posse`, `${n1(v)}% possession`);
    case 'high_recoveries': return L(`${n1(v)} roubadas no ataque`, `${n1(v)} high turnovers`);
    case 'shots': return L(`${n1(v)} finalizações`, `${n1(v)} shots`);
    case 'xg_per_shot': return L(`${v.toFixed(2).replace('.', ',')} de xG por chute`, `${v.toFixed(2)} xG per shot`);
    case 'conceded_shots': return L(`${n1(v)} chutes sofridos`, `${n1(v)} shots conceded`);
    case 'fouls': return L(`${n1(v)} faltas (cartão = 3)`, `${n1(v)} fouls (card = 3)`);
    case 'momentum': return L(`${n1(v)} de cerco médio (0–100)`, `${n1(v)} average pressure (0–100)`);
  }
}

/**
 * Relatório nos eixos em que o manager mais se afastou do neutro (pra cima OU
 * pra baixo — pedir menos pressão também é identidade). Veredito pelo efeito
 * MÉDIO: na direção pedida e ≥3% = apareceu; menor = discreto; ao contrário = contra.
 */
export function relatorioDeIdentidade(
  analise: AnaliseDoMotor,
  pedido: DnaDoClube,
  L: (pt: string, en: string) => string,
  n = 3,
): RelatorioDeIdentidade {
  const eixos = [...EIXOS_DNA].sort((a, b) => Math.abs(pedido[b] - 0.5) - Math.abs(pedido[a] - 0.5)).slice(0, n);
  const linhas = eixos.map((eixo): LinhaDoRelatorio => {
    const e = analise.eixos[eixo];
    const direcao: 1 | -1 = pedido[eixo] >= 0.5 ? 1 : -1;
    // Posse é % do jogo: a variação relativa é contra os 50% do equilíbrio.
    const variacao = e.sem > 0 ? (e.com - e.sem) / e.sem : 0;
    // Pra onde o eixo andou na régua do DNA (sinal da métrica corrige solidez/disciplina).
    const andou = variacao * e.sinal;
    const veredito: Veredito = Math.abs(andou) < LIMIAR_VISIVEL ? 'discreto' : andou * direcao > 0 ? 'apareceu' : 'contra';
    return {
      eixo,
      direcao,
      pedido: pedido[eixo],
      com: e.com,
      sem: e.sem,
      variacao,
      veredito,
      prova: L(`${fmtMetrica(e.metrica, e.com, L)} × ${fmtMetrica(e.metrica, e.sem, L)} sem a tua identidade`, `${fmtMetrica(e.metrica, e.com, L)} vs ${fmtMetrica(e.metrica, e.sem, L)} without your identity`),
    };
  });
  const fidelidade = Math.round((linhas.filter((l) => l.veredito === 'apareceu').length / linhas.length) * 100);
  return { n: analise.n, linhas, fidelidade, vitorias: analise.vitorias_pct };
}

/**
 * /src/motor/MotorEngine.ts — O MOTOR NOVO
 *
 * Substitui o `TacticalSimLoop` (6.463 linhas, 83 métodos) por um núcleo em
 * camadas. Emite exatamente o mesmo `MatchTruthSnapshot`, o que significa que a
 * régua de realismo e os 30 componentes de UI já construídos funcionam sem
 * mudar uma linha — e que os dois motores podem ser medidos lado a lado.
 *
 * ── As três decisões de fundo ────────────────────────────────────────────────
 *
 * 1. TEMPO DE FUTEBOL. Nada aqui é comprimido. Um segundo é um segundo, um
 *    metro é um metro, m/s é m/s. O motor antigo rodava 45 minutos em 180
 *    segundos com distâncias em metros reais, o que obrigava toda velocidade a
 *    ser multiplicada por 15 — e nenhuma era. Essa classe inteira de bug deixa
 *    de existir por construção. Acelerar a partida é problema do playback.
 *
 * 2. FORMA IMPOSTA, DISPUTA EMERGENTE. O bloco compacto que acompanha a bola é
 *    construído, não esperado. Tentar fazer compactação emergir de agentes
 *    maximizando utilidade é projeto de pesquisa; o Football Manager também
 *    impõe forma. O que emerge é o que deve emergir: quem disputa, quem recebe,
 *    quando o passe fura a linha.
 *
 * 3. DECISÃO POR VALOR DE ESPAÇO. O motor antigo pedia deslocamentos de 3 a 13
 *    metros a partir do próprio pé — foi o que travou tudo, e foi medido. Aqui
 *    todo destino sai do controle de espaço (L1) confrontado com valor de posse
 *    (L2): corre-se 25 metros porque aquele corredor vale, não porque um
 *    utilitário mandou andar um pouquinho para frente.
 */
import type {
  MatchTruthSnapshot,
  MatchTruthPlayer,
  MatchTruthPhase,
} from '@/bridge/matchTruthSchema';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/tactical';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  resolveArchetype,
  weightsFor,
  type DecisionWeights,
} from './archetypeWeights';
import {
  controlAt,
  passSurvival,
  pressureSec,
  timeToReach,
  type ControlPlayer,
} from './pitchControl';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES — todas em unidades de futebol real
// ═══════════════════════════════════════════════════════════════════════════════

/** Passo de integração do movimento, s. */
export const STEP_S = 0.05;
/** Cadência coletiva: a forma do time é recalculada nesta fatia. */
const SLICE_S = 0.25;
const STEPS_PER_SLICE = Math.round(SLICE_S / STEP_S);
/** Reavaliação individual do agente que lê mal o jogo, s. */
const SLICE_SLOW_S = 0.40;
/** Reavaliação individual do agente que lê bem, s. */
const SLICE_FAST_S = 0.15;
/** Desvio máximo da âncora para quem tem Posicionamento zero, m. */
const POSITIONING_MAX_DRIFT_M = 7.0;
/** Raio em que a corrida de um companheiro já "ocupa" o espaço, m. */
const CLAIM_RADIUS_M = 14;
/**
 * Amplitude da célula-alvo em torno da âncora, como fração do leque de
 * corrida. Pequeno de propósito: o jogador escolhe onde ficar DENTRO do seu
 * posto, não abandona o posto.
 */
const CELL_SPREAD = 0.42;
/** Alcance base para cortar uma bola em voo, m. */
const INTERCEPT_BASE_M = 1.1;
/** Alcance extra de quem antecipa bem — chega antes, não estica mais. */
const INTERCEPT_ANTICIPATION_M = 1.6;

/** Hash estável de id — para erros determinísticos por jogador. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Duração de cada tempo, s. */
export const HALF_SECONDS = 45 * 60;

/** Profundidade do bloco entre a linha mais recuada e a mais adiantada, m. */
const BLOCK_DEPTH_M = 30;
/** Largura do bloco, m. */
const BLOCK_WIDTH_M = 42;
/** Quanto o bloco desliza lateralmente atrás da bola, 0–1. */
const LATERAL_FOLLOW = 0.55;
/**
 * Quanto o bloco avança quando o time TEM a bola, m.
 */
const ATTACK_PUSH_M = 6;
/**
 * Quanto o bloco recua para o lado do próprio gol quando NÃO tem a bola, m.
 *
 * Este número é o que separa futebol de pega-pega. Com os dois blocos centrados
 * na bola (era o caso com um recuo simétrico de 6m), o time que defende nunca
 * fica ENTRE a bola e o próprio gol — o ataque chega à pequena área sem
 * atravessar ninguém, e o motor produzia 92 finalizações por partida.
 */
const DEFEND_DROP_M = 17;
/**
 * Faixa em que o centro do bloco pode viver, medida a partir do PRÓPRIO gol.
 *
 * Sem este limite o bloco só conhecia a bola: com a posse no goleiro
 * adversário, os onze do time que defende acampavam na entrada da área dele —
 * o clamp global levava os dois blocos para o mesmo lugar. Toda perda de bola
 * virava finalização, e o motor produzia mais chutes (212) do que passes (110).
 *
 * É a linha de confrontação: por mais que se pressione, o bloco não abandona a
 * própria metade; por mais que se recue, ele não cola na própria meta.
 */
const BLOCK_MIN_FROM_OWN_GOAL_M = 20;
/** Teto sem a bola: pressão alta ainda deixa o bloco aquém do meio adversário. */
const BLOCK_MAX_FROM_OWN_GOAL_DEF_M = 58;
/** Teto com a bola: aí sim o time inteiro sobe. */
const BLOCK_MAX_FROM_OWN_GOAL_ATT_M = 78;

/** Quantos defensores saem da forma para disputar a bola. */
const PRESSERS = 2;
/** Quantos atacantes fazem corrida de apoio livre da forma. */
const SUPPORT_RUNNERS = 2;

const PASS_SPEED_MIN_MS = 15;
const PASS_SPEED_MAX_MS = 26;

/**
 * Raio em que o portador é considerado sob disputa direta, m.
 *
 * Com 1,6m o portador simplesmente fugia: corria a 7 m/s e nenhum perseguidor
 * chegava perto o bastante para tentar o desarme. Conduzir virava progressão
 * grátis — e como conduzir sempre valia mais que passar, o motor produzia mais
 * finalizações (199) do que passes (134).
 */
const TACKLE_RADIUS_M = 2.5;
/** Quem carrega a bola corre menos que quem corre livre. */
const CARRY_SPEED_MULT = 0.82;

/**
 * ── Espaçamento entre companheiros ───────────────────────────────────────────
 *
 * Achado ao OLHAR a partida na tela, não na régua: aos 6 minutos havia nove
 * jogadores empilhados dentro da área, ocupando cinco metros quadrados, com o
 * resto do time largado no meio-campo. Todas as 17 medidas continuavam
 * passando — compactação de bloco mede a CAIXA que o time ocupa, não a
 * distância entre companheiros dentro dela.
 *
 * No futebol ninguém joga colado no companheiro: ocupar espaços diferentes é o
 * ponto. Adversário pode e deve chegar perto — isso é disputa —, então a
 * repulsão vale só entre quem é do mesmo lado.
 */
const TEAMMATE_MIN_SEP_M = 4.6;
/** Força da separação, em m/s de correção. */
const SEPARATION_STRENGTH = 2.6;
/**
 * Quem está fechando o cone de chute NÃO se espalha: defender a própria área é
 * aglomerado legítimo, e é justamente o que faz a finalização travar num corpo.
 */
const COVER_SEPARATION_MULT = 0.25;

// ── Ritmo ────────────────────────────────────────────────────────────────────
// Sem estas constantes o motor produz futebol geometricamente correto e
// completamente irreal: a primeira execução deu 118x189 com 12.221 passes e 917
// finalizações, porque o portador reavaliava a cada 0,25s e agia na hora, e a
// bola nunca saía de jogo. Numa partida de verdade a bola fica em jogo ~55 dos
// 90 minutos e são ~900 passes e ~25 finalizações somando os dois times.

/**
 * Tempo mínimo com a bola antes de agir (domínio + primeiro toque), s.
 *
 * Calibrado para baixo: sob pressão o jogador se livra em meio segundo, de um
 * ou dois toques. Com 1,1s de piso, quase metade das posses pressionadas
 * terminava em desarme ANTES de o jogador conseguir decidir qualquer coisa —
 * o que fazia a partida ter 116 passes em vez dos ~900 do futebol.
 */
const CONTROL_TIME_MIN_S = 0.5;
/** Tempo extra de posse quando ninguém pressiona, s. */
const CONTROL_TIME_FREE_S = 2.2;
/**
 * Valor de simplesmente NÃO PERDER a bola, em gols esperados.
 *
 * Faltava isto. A regra antiga exigia que o passe MELHORASSE a posição
 * (`passValue >= here * 1.10`), o que proibia passe para o lado e para trás —
 * e no futebol metade dos passes é circulação, sem ganho posicional nenhum.
 * Sem circulação toda posse virava linha reta para o gol: uma finalização a
 * cada passe, contra uma a cada ~36 do futebol real.
 *
 * Com retenção valendo algo, o passe seguro de lado ganha do drible arriscado.
 */
const RETENTION_VALUE = 0.042;
/**
 * Probabilidade de gol mínima para finalizar.
 *
 * Piso, não critério: a decisão continua sendo por comparação em gols
 * esperados. Serve para o jogador não bater de qualquer jeito quando a
 * alternativa também vale pouco — 9% corresponde grosso modo a uma bola
 * central de ~15m sem corpo na frente.
 */
const SHOT_MIN_XG = 0.09;
/** Bola parada depois de finalização (recuo, tiro de meta, escanteio), s. */
const DEAD_AFTER_SHOT_S = 18;
/** Bola parada depois de lateral, s. */
const DEAD_AFTER_OUT_S = 18;
/** Bola parada depois de falta, s. */
const DEAD_AFTER_FOUL_S = 26;
/** Fração dos bloqueios que desvia para fora em vez de sobrar em jogo. */
const BLOCKED_OUT_CHANCE = 0.45;
/** Fração das defesas em que o goleiro segura ou manda para fora. */
const SAVE_HELD_CHANCE = 0.78;
/** Quanto o goleiro avança em relação à distância da bola. */
const GK_OUT_RATIO = 0.17;
/** Teto de saída do goleiro, m. */
const GK_MAX_OUT_M = 7.5;
/** A partir desta distância da própria meta, a defesa fecha o cone de chute. */
const DANGER_DIST_M = 28;
/** Quantos defensores fecham a linha bola→gol na zona de perigo. */
const COVER_DEFENDERS = 3;
/**
 * Tentativas de desarme por segundo com um adversário colado.
 *
 * Precisa ser POR SEGUNDO, não por passo. A primeira versão sorteava a cada
 * passo de 0,05s, o que dava um desarme a cada 0,45 segundos: nenhuma posse
 * sobrevivia, o jogo virava pingue-pongue e saíam 130 passes por partida em vez
 * de ~900. É o erro clássico de probabilidade não escalada pelo dt.
 *
 * O valor foi de 0,55 para 0,09 depois de instrumentar o ciclo de posse. O
 * achado que mudou o diagnóstico: 3,3% das posses terminavam em finalização, que
 * é EXATAMENTE o futebol real. O excesso de chutes não vinha de finalizar
 * demais — vinha de haver posses demais. Eram 381 desarmes por partida contra
 * ~40 do futebol, o que picava o jogo em sequências de um passe só.
 */
const TACKLE_ATTEMPTS_PER_S = 0.09;
/** Faltas por segundo de contato. */
const FOUL_RATE_PER_S = 0.06;

const GOAL_Z = FIELD_WIDTH / 2;

// ═══════════════════════════════════════════════════════════════════════════════
// RNG determinístico
// ═══════════════════════════════════════════════════════════════════════════════

function makeRng(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 0xffffffff) / 0xffffffff;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ── Atributos ────────────────────────────────────────────────────────────────
 *
 * Três famílias, sem derivação automática entre elas.
 *
 * O motor antigo derivava `cruzamento = drible × 0,45 + passe × 0,45 + 6`, o
 * que tornava impossível existir um Beckham e um Xavi no mesmo jogo: os dois
 * colapsavam no mesmo jogador. Num catálogo de lendas de todas as épocas isso é
 * fatal, porque apaga exatamente a diferença que faz a coleção existir.
 *
 * E não havia atributo mental nenhum. É o que o gênero inteiro usa para decidir
 * partidas: um jogador tecnicamente mediano com Decisão e Antecipação altas
 * supera um mais talentoso mal empregado.
 */
export interface MotorAttrs {
  // ── Físicos ────────────────────────────────────────────────────────────────
  /** Arranque curto. Governa a aceleração em m/s² — o ponta de 5 metros. */
  aceleracao: number;
  /** Sprint longo. Governa a velocidade máxima — o ponta de 40 metros. */
  velocidadeMaxima: number;
  /** Resistência. */
  fisico: number;

  // ── Técnicos ───────────────────────────────────────────────────────────────
  passe: number;
  /** INDEPENDENTE de passe e drible: é o que separa o cruzador do armador. */
  cruzamento: number;
  drible: number;
  finalizacao: number;
  marcacao: number;

  // ── Mentais ────────────────────────────────────────────────────────────────
  /** Escolhe o melhor candidato ou um sub-ótimo; e erra mais sob pressão. */
  decisao: number;
  /** Quantos candidatos consegue avaliar por ciclo — raio de escaneamento. */
  visaoDeJogo: number;
  /** Reage ao presente ou à posição projetada. Encurta o tempo morto. */
  antecipacao: number;
  /** Tolerância de erro em relação à âncora: quem tem pouco vaza da linha. */
  posicionamento: number;

  /** Só goleiro. Sem valor, cai em `marcacao`. */
  goleiro?: number;
}

/**
 * Elenco de referência — todos os atributos em 72, sem nenhum destaque.
 * Serve de base para testes e para preencher lacunas; qualquer jogador real
 * sobrescreve o que importa.
 */
export function defaultAttrs(over: Partial<MotorAttrs> = {}): MotorAttrs {
  return {
    aceleracao: 72, velocidadeMaxima: 74, fisico: 72,
    passe: 72, cruzamento: 68, drible: 70, finalizacao: 72, marcacao: 70,
    decisao: 70, visaoDeJogo: 70, antecipacao: 70, posicionamento: 72,
    ...over,
  };
}

export interface MotorPlayerInput {
  id: string;
  side: 'home' | 'away';
  slotId: string;
  role: 'gk' | 'def' | 'mid' | 'attack';
  shirtNumber?: number;
  attrs: MotorAttrs;
  /**
   * OBRIGATÓRIO. Um dos 54 ids de `@/tactical/archetypesCatalog`.
   *
   * É o que define o ESTILO do jogador — o que ele valoriza ao decidir. No
   * motor antigo este campo era opcional, nunca era atribuído, e a leitura
   * ficava num `try/catch` silencioso: 35 KB de design tático nunca rodaram.
   * Aqui a ausência é erro de compilação, e um id inválido é erro em execução.
   */
  tacticalArchetypeId: string;
}

interface MotorPlayer extends MotorPlayerInput {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Profundidade normalizada dentro do bloco, 0 = mais recuado. */
  depth01: number;
  /** Largura normalizada, 0 = esquerda. */
  width01: number;
  vmax: number;
  /** Aceleração em m/s², vinda de `aceleracao`. */
  accel: number;
  /** 0–1, vindo de `antecipacao`. */
  anticipation01: number;
  /**
   * Intervalo entre reavaliações deste agente, s. Vem de Decisão + Visão: quem
   * lê o jogo revê o campo quase quatro vezes mais rápido que quem não lê.
   */
  sliceS: number;
  /** Instante da próxima reavaliação. */
  nextDecisionAt: number;
  /** Erro persistente em relação à âncora, m — vem de `posicionamento`. */
  anchorErrX: number;
  anchorErrZ: number;
  stamina: number;
  targetX: number;
  targetZ: number;
  /** Urgência do destino atual, 0–1. Governa o quanto ele corre. */
  urgency: number;
  /** Está fechando o cone de chute — pode e deve ficar colado aos companheiros. */
  tight: boolean;
  /** Pesos de decisão do arquétipo — o estilo, traduzido em multiplicadores. */
  w: DecisionWeights;
}

type BallMode = 'held' | 'flight';

export interface MotorConfig {
  seed: number;
  homeFormation?: FormationSchemeId;
  awayFormation?: FormationSchemeId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Valor de posse (L2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valor de uma posição para quem ataca em `dir`, 0–1.
 *
 * Decai com a distância ao gol e pune ângulo fechado. É o EPV em forma
 * mínima: suficiente para ordenar opções, e o lugar por onde um arquétipo de
 * época entra depois (um ponta de 1970 e um de 2020 pesam isto diferente).
 */
export function positionValue(x: number, z: number, dir: 1 | -1): number {
  const goalX = dir === 1 ? FIELD_LENGTH : 0;
  const dx = Math.abs(goalX - x);
  const dz = Math.abs(z - GOAL_Z);
  const dist = Math.hypot(dx, dz);
  const angle = Math.atan2(dx + 1, dz + 1); // fechado nas laterais
  return Math.exp(-dist / 24) * (0.55 + 0.45 * Math.min(1, angle / 1.35));
}

/**
 * Valor de uma POSSE naquela posição, em gols esperados.
 *
 * `positionValue` é potencial (0–1); `shotValue` é probabilidade de gol agora.
 * Comparar os dois direto — como a primeira versão fazia — é comparar unidades
 * diferentes, e foi o que fez finalizar ganhar de passar quase sempre: 71
 * finalizações e 163 passes por partida, quando o futebol faz uma finalização
 * a cada ~36 passes. Aqui tudo vira a mesma moeda: gols esperados.
 *
 * K é quanto vale ter a bola no melhor lugar possível do campo. Calibrado para
 * que a posse na entrada da área (16m) valha ~0,10 — um pouco MAIS que o xG de
 * uma finalização dali (~0,08). É isso que faz o jogador trabalhar a jogada em
 * vez de bater de qualquer lugar: manter a bola em zona boa carrega a opção de
 * chutar depois, de um lugar melhor. Com K baixo demais (0,12), um chute de 20
 * metros vencia continuar jogando e o motor produzia 177 finalizações.
 */
const POSSESSION_VALUE_K = 0.20;

export function possessionValue(x: number, z: number, dir: 1 | -1): number {
  return positionValue(x, z, dir) * POSSESSION_VALUE_K;
}

/**
 * Desfechos possíveis de uma finalização, em probabilidade.
 *
 * A MESMA função alimenta a decisão do portador e a resolução do lance. Se o
 * motor decide com um número e resolve com outro, ele finaliza errado por
 * construção — foi assim que a versão anterior produzia 167 chutes por
 * partida: a decisão via 0,13 de chance onde a realidade era bem menor.
 *
 * Referências de futebol real: ~1/3 das finalizações vão no alvo, ~30% das que
 * vão no alvo viram gol, conversão global ~10%.
 */
export interface ShotOutcome {
  /** Trava num corpo antes de chegar. */
  blocked: number;
  /** Vai no alvo, dado que não travou. */
  onTarget: number;
  /** Goleiro defende, dado que foi no alvo. */
  save: number;
  /** Probabilidade final de gol — é o que a decisão consome. */
  goal: number;
}

export function shotOutcome(
  dist: number,
  angle01: number,
  finalizacao: number,
  pressure: number,
  blockers: number,
  gkQuality: number,
  gkCover01: number,
): ShotOutcome {
  // Corpos no caminho.
  const blocked = 1 - Math.exp(-0.42 * blockers);
  // No alvo: quem finaliza melhor acerta mais; sob pressão, erra mais.
  const pressed = 0.55 + 0.45 * Math.min(1, pressure / 1.5);
  const onTarget = Math.max(
    0.12,
    Math.min(0.72, (0.30 + (finalizacao / 100) * 0.26) * pressed * (0.72 + 0.28 * angle01)),
  );
  // Defesa: quanto mais perto e mais aberto o ângulo, mais difícil defender.
  // gkCover01 mede o quanto o goleiro fechou o ângulo saindo da linha.
  const chanceQuality = Math.exp(-dist / 9) * angle01;
  const save = Math.max(
    0.12,
    Math.min(0.95, (0.94 - chanceQuality * 1.25) * (0.70 + 0.30 * (gkQuality / 100)) * (0.78 + 0.42 * gkCover01)),
  );
  const goal = (1 - blocked) * onTarget * (1 - save);
  return { blocked, onTarget, save, goal };
}

/**
 * Probabilidade de gol de uma finalização — curva de xG calibrada contra
 * futebol real, não contra o que parecia razoável.
 *
 * Referências: pênalti (11m, sem oposição) ~0,76; frente à área central (12m)
 * ~0,20; entrada da área (16m) ~0,09; de fora (25m) ~0,03. A primeira versão
 * deste motor dava 0,39 de 15 metros, o que sozinho produzia 56 gols por
 * partida.
 */
function shotValue(
  x: number, z: number, dir: 1 | -1, finalizacao: number, pressure: number,
  blockers = 0,
): number {
  const goalX = dir === 1 ? FIELD_LENGTH : 0;
  const dist = Math.hypot(goalX - x, z - GOAL_Z);
  // Ângulo visível do gol a partir do ponto: cai muito nas laterais.
  const halfGoal = 3.66;
  const openAngle = Math.atan2(halfGoal, Math.max(1, dist)) * 2;
  const angle01 = Math.min(1, openAngle / 0.55);
  const skill = 0.78 + (finalizacao / 100) * 0.42;
  const pressed = 0.42 + 0.58 * Math.min(1, pressure / 1.5);
  // Corpos no caminho. Um modelo de xG que ignora quantos defensores estão
  // entre o batedor e o gol superestima grosseiramente o chute de dentro de
  // área lotada — e foi o que fez o motor bater 178 vezes por partida, sempre
  // dos mesmos 14 metros, contra um bloco compacto de dez jogadores.
  const blocked = Math.exp(-0.45 * blockers);
  return Math.max(
    0.002,
    Math.min(0.55, 0.82 * Math.exp(-dist / 7.5) * angle01 * skill * pressed * blocked),
  );
}

/** Adversários dentro do cone entre o batedor e a meta. */
function countBlockers(
  shooter: { x: number; z: number; side: 'home' | 'away' },
  players: ReadonlyArray<{ x: number; z: number; side: 'home' | 'away' }>,
  dir: 1 | -1,
): number {
  const goalX = dir === 1 ? FIELD_LENGTH : 0;
  const dx = goalX - shooter.x;
  const dz = GOAL_Z - shooter.z;
  const len = Math.hypot(dx, dz);
  if (len < 1) return 0;
  const ux = dx / len;
  const uz = dz / len;
  let n = 0;
  for (const p of players) {
    if (p.side === shooter.side) continue;
    const rx = p.x - shooter.x;
    const rz = p.z - shooter.z;
    const along = rx * ux + rz * uz;
    if (along <= 0.5 || along >= len) continue;          // atrás do batedor ou além da meta
    const lateral = Math.abs(rx * -uz + rz * ux);
    // Cone que abre até a largura da meta na linha de fundo.
    if (lateral <= 1.2 + (along / len) * 4.2) n++;
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Motor
// ═══════════════════════════════════════════════════════════════════════════════

export class MotorEngine {
  private readonly rng: () => number;
  private players: MotorPlayer[] = [];
  private ball = { x: FIELD_LENGTH / 2, z: GOAL_Z, vx: 0, vz: 0 };
  private ballMode: BallMode = 'held';
  private carrierId: string | null = null;
  private flight: {
    toX: number; toZ: number; speed: number;
    targetId: string | null; passerId: string; travelled: number;
  } | null = null;
  private stepCount = 0;
  /**
   * Estatísticas POR JOGADOR. O pós-jogo precisa delas, e sem elas não há como
   * julgar um arquétipo: o efeito de dois zagueiros diluído em ~1.000 passes
   * do time some no ruído, e a medida chega a inverter de sinal.
   */
  readonly byPlayer = new Map<string, {
    passes: number; passesForward: number; passesOk: number;
    carries: number; shots: number; xg: number;
    tackles: number; goals: number; distanceM: number;
  }>();
  /** Instante em que o portador atual ganhou a bola. */
  private possessionSince = 0;
  /** Até quando a bola está parada. */
  private deadUntil = 0;
  readonly stoppages = { shots: 0, outs: 0, fouls: 0 };
  /**
   * Narrativa mínima da partida. Alimenta a barra de eventos da UI e é a
   * semente do traço causal — o mesmo lugar por onde o comentarista que
   * conhece o contrafactual vai ler depois.
   */
  readonly events: Array<{ minute: number; text: string; kind: string; playerId?: string }> = [];
  /**
   * Última decisão de cada jogador, em vocabulário de futebol.
   *
   * O motor SEMPRE soube isto — escolhe a cada fatia entre correr para a
   * célula-alvo, pressionar, fechar o cone de chute ou marcar homem, e o
   * portador escolhe entre passar, conduzir e finalizar comparando gols
   * esperados. O que faltava era guardar a escolha. É o que faz o toque no card
   * mostrar o que o jogador acabou de pensar, e é o primeiro degrau do traço
   * causal: sem isso, o comentarista não tem o que ler.
   */
  readonly lastAction = new Map<string, string>();
  /** Até quando uma ação com a bola resiste a ser sobrescrita pela forma. */
  private readonly actionHold = new Map<string, number>();
  private inPlayAccum = 0;

  t = 0;
  half: 1 | 2 = 1;
  homeScore = 0;
  awayScore = 0;
  phase: MatchTruthPhase = 'live';
  /** Estatísticas simples para o pós-jogo e para a narração. */
  readonly stats = {
    passes: 0, passesOk: 0, shots: 0, goals: 0, tackles: 0,
    blocked: 0, offTarget: 0, onTarget: 0, saves: 0, rebounds: 0,
  };
  /**
   * Estatísticas por lado. Além de alimentar o pós-jogo, é o que permite medir
   * o efeito de um atributo com centenas de eventos por partida em vez dos ~5
   * gols — gol tem variância alta demais para servir de régua de atributo.
   */
  readonly bySide = {
    home: {
      passes: 0, passesOk: 0, shots: 0, xg: 0, possessionS: 0,
      passesForward: 0, passDistSum: 0, carries: 0, touchesWide: 0, touches: 0,
      touchAdvanceSum: 0,
    },
    away: {
      passes: 0, passesOk: 0, shots: 0, xg: 0, possessionS: 0,
      passesForward: 0, passDistSum: 0, carries: 0, touchesWide: 0, touches: 0,
      touchAdvanceSum: 0,
    },
  };

  constructor(home: MotorPlayerInput[], away: MotorPlayerInput[], private readonly cfg: MotorConfig) {
    this.rng = makeRng(cfg.seed);
    this.players = [
      ...this.build(home, cfg.homeFormation ?? '4-3-3'),
      ...this.build(away, cfg.awayFormation ?? '4-4-2'),
    ];
    this.kickoff('home');
  }

  // ── construção ──────────────────────────────────────────────────────────────

  private build(input: MotorPlayerInput[], scheme: FormationSchemeId): MotorPlayer[] {
    const bases = FORMATION_BASES[scheme] ?? FORMATION_BASES['4-3-3'];
    const outfield = Object.entries(bases).filter(([k]) => k !== 'gol');
    const nxs = outfield.map(([, v]) => (v as { nx: number }).nx);
    const lo = Math.min(...nxs);
    const hi = Math.max(...nxs);
    const span = Math.max(1e-6, hi - lo);

    return input.map((p) => {
      const base = bases[p.slotId] as { nx: number; nz: number } | undefined;
      const nx = base?.nx ?? 0.5;
      const nz = base?.nz ?? 0.5;
      // Velocidade máxima real: 6,3 m/s no mais lento, 9,5 no mais rápido.
      const vmax = 6.3 + (p.attrs.velocidadeMaxima / 100) * 3.2;
      // Aceleração sustentada: 2,8 a 5,2 m/s².
      const accel = 2.8 + (p.attrs.aceleracao / 100) * 2.4;
      // Cadência de decisão por atributo — diretriz vinda da análise do FM:
      // quem tem Decisão e Visão altas reavalia a cada 150ms; quem não tem,
      // a cada 400ms. O motor usava fatia fixa de 250ms para os 22.
      const mind01 = (p.attrs.decisao + p.attrs.visaoDeJogo) / 200;
      const sliceS = SLICE_SLOW_S + (SLICE_FAST_S - SLICE_SLOW_S) * mind01;
      // Erro de posicionamento: determinístico por jogador, não sorteado a
      // cada tick — um zagueiro desatento erra SEMPRE para o mesmo lado.
      const posErr = (1 - p.attrs.posicionamento / 100) * POSITIONING_MAX_DRIFT_M;
      const phase = ((hashId(p.id) % 1000) / 1000) * Math.PI * 2;
      // Falha ruidosa: sem arquétipo válido a partida não começa.
      const archetype = resolveArchetype(p.tacticalArchetypeId, p.id);
      return {
        ...p,
        x: FIELD_LENGTH / 2,
        z: GOAL_Z,
        vx: 0,
        vz: 0,
        depth01: p.role === 'gk' ? 0 : (nx - lo) / span,
        width01: nz,
        vmax,
        accel,
        anticipation01: p.attrs.antecipacao / 100,
        sliceS,
        nextDecisionAt: 0,
        anchorErrX: Math.cos(phase) * posErr,
        anchorErrZ: Math.sin(phase) * posErr,
        stamina: 100,
        targetX: FIELD_LENGTH / 2,
        targetZ: GOAL_Z,
        urgency: 0.3,
        tight: false,
        w: weightsFor(archetype),
      };
    });
  }

  /** Acumulador do jogador, criado sob demanda. */
  private pstat(id: string) {
    let e = this.byPlayer.get(id);
    if (!e) {
      e = {
        passes: 0, passesForward: 0, passesOk: 0,
        carries: 0, shots: 0, xg: 0,
        tackles: 0, goals: 0, distanceM: 0,
      };
      this.byPlayer.set(id, e);
    }
    return e;
  }

  private dirOf(side: 'home' | 'away'): 1 | -1 {
    return side === 'home' ? 1 : -1;
  }

  // ── forma do time ───────────────────────────────────────────────────────────

  /**
   * Centro do bloco de um lado, em x. É o coração da compactação: o bloco vive
   * colado à bola, avançando quando o time tem a posse e recuando quando não
   * tem. Como o centro segue a bola, os que saem para disputar não esticam o
   * bloco — eles já estão perto.
   */
  private blockCenterX(side: 'home' | 'away', teamHasBall: boolean): number {
    const dir = this.dirOf(side);
    const ownGoalX = dir === 1 ? 0 : FIELD_LENGTH;
    const push = teamHasBall ? ATTACK_PUSH_M : -DEFEND_DROP_M;
    const raw = this.ball.x + dir * push;
    // O limite é medido a partir do PRÓPRIO gol, não do campo em abstrato —
    // é isso que impede os dois blocos de colapsarem no mesmo ponto quando a
    // bola está perto de uma das metas.
    const fromOwnGoal = (raw - ownGoalX) * dir;
    const maxOut = teamHasBall ? BLOCK_MAX_FROM_OWN_GOAL_ATT_M : BLOCK_MAX_FROM_OWN_GOAL_DEF_M;
    const clamped = Math.max(BLOCK_MIN_FROM_OWN_GOAL_M, Math.min(maxOut, fromOwnGoal));
    return ownGoalX + dir * clamped;
  }

  private shapeTarget(p: MotorPlayer, teamHasBall: boolean): { x: number; z: number } {
    if (p.role === 'gk') {
      const dir = this.dirOf(p.side);
      const goalX = dir === 1 ? 0 : FIELD_LENGTH;
      // Goleiro fica NA LINHA entre a bola e o centro da meta, avançando para
      // fechar o ângulo. Antes ele só deslizava de lado e ficava colado à
      // trave — o atacante entrava na área e tinha o gol todo aberto.
      const bd = Math.hypot(this.ball.x - goalX, this.ball.z - GOAL_Z);
      const out = Math.max(0.8, Math.min(GK_MAX_OUT_M, bd * GK_OUT_RATIO));
      const t = out / Math.max(1, bd);
      return {
        x: goalX + (this.ball.x - goalX) * t,
        z: GOAL_Z + (this.ball.z - GOAL_Z) * Math.min(t, 0.55),
      };
    }
    const dir = this.dirOf(p.side);
    const cx = this.blockCenterX(p.side, teamHasBall);
    const x = cx + dir * (p.depth01 - 0.5) * BLOCK_DEPTH_M;
    const z =
      GOAL_Z
      + (p.width01 - 0.5) * BLOCK_WIDTH_M
      + (this.ball.z - GOAL_Z) * LATERAL_FOLLOW;
    // Posicionamento entra aqui: quem tem pouco vaza da linha, sempre para o
    // mesmo lado. É o atributo que faz um lateral ser furado por infiltração.
    return {
      x: Math.max(3, Math.min(FIELD_LENGTH - 3, x + p.anchorErrX)),
      z: Math.max(2, Math.min(FIELD_WIDTH - 2, z + p.anchorErrZ)),
    };
  }

  // ── conversão para a camada de espaço ───────────────────────────────────────

  private controlPlayers(): ControlPlayer[] {
    return this.players.map((p) => ({
      id: p.id,
      side: p.side,
      x: p.x,
      z: p.z,
      vx: p.vx,
      vz: p.vz,
      vmax: p.vmax * (0.72 + 0.28 * (p.stamina / 100)),
      accel: p.accel,
      anticipation01: p.anticipation01,
    }));
  }

  // ── decisão ─────────────────────────────────────────────────────────────────

  private assignTargets(): void {
    const carrier = this.carrierId ? this.players.find((p) => p.id === this.carrierId) : undefined;
    const attackingSide = carrier?.side ?? null;
    const cps = this.controlPlayers();

    // Ponto para onde a bola está indo — é o que se disputa, não onde ela está.
    const contestX = this.ballMode === 'flight' && this.flight ? this.flight.toX : this.ball.x;
    const contestZ = this.ballMode === 'flight' && this.flight ? this.flight.toZ : this.ball.z;

    for (const side of ['home', 'away'] as const) {
      const teamHasBall = attackingSide === side;
      const mates = this.players.filter((p) => p.side === side && p.role !== 'gk');

      // Quem chega antes no ponto disputado sai da forma para ir lá.
      const byArrival = [...mates].sort(
        (a, b) => timeToReach(this.cp(a), contestX, contestZ) - timeToReach(this.cp(b), contestX, contestZ),
      );
      const chasers = new Set<string>();
      let nChase = teamHasBall ? (this.ballMode === 'flight' ? 1 : 0) : PRESSERS;
      // Um time de arquétipos agressivos manda mais gente à bola. A média do
      // peso `press` dos que estão perto decide se sai um a mais.
      if (!teamHasBall && byArrival.length > 0) {
        const pressAvg =
          byArrival.slice(0, 3).reduce((sum, m) => sum + m.w.press, 0)
          / Math.min(3, byArrival.length);
        if (pressAvg > 1.22) nChase += 1;
        else if (pressAvg < 0.85) nChase = Math.max(1, nChase - 1);
      }
      for (let i = 0; i < nChase && i < byArrival.length; i++) chasers.add(byArrival[i]!.id);

      // Com a bola: corridas de apoio para onde o espaço vale.
      const runners = new Set<string>();
      if (teamHasBall && carrier) {
        const dir = this.dirOf(side);
        // Atribuição SEQUENCIAL: cada corredor escolhe sabendo para onde os
        // anteriores já foram. É o que transforma decisão individual boa em
        // ocupação coletiva boa.
        const claimed: Array<{ x: number; z: number }> = [];
        const pool = mates.filter((m) => m.id !== carrier.id && m.depth01 > 0.35);
        for (let i = 0; i < SUPPORT_RUNNERS; i++) {
          let best: { m: MotorPlayer; spot: { x: number; z: number; gain: number } } | null = null;
          for (const m of pool) {
            if (runners.has(m.id)) continue;
            const spot = this.bestRunSpot(m, dir, cps, claimed);
            if (!best || spot.gain > best.spot.gain) best = { m, spot };
          }
          if (!best) break;
          runners.add(best.m.id);
          best.m.targetX = best.spot.x;
          best.m.targetZ = best.spot.z;
          best.m.urgency = 0.95;
          this.marcarAcao(best.m.id, this.rotuloCorrida(best.m, dir, best.spot));
          claimed.push({ x: best.spot.x, z: best.spot.z });
        }
      }

      // Cobertura: na zona de perigo, os mais próximos param de acompanhar
      // homem e vão FECHAR A LINHA entre a bola e a própria meta. É o que
      // faltava — a instrumentação mostrou finalização de 11m com mediana de
      // UM defensor no cone, ou seja, o atacante entrava na área sozinho.
      const cover = new Set<string>();
      for (const m of mates) m.tight = false;
      if (!teamHasBall) {
        const dirD = this.dirOf(side);
        const ownGoalX = dirD === 1 ? 0 : FIELD_LENGTH;
        const ballToGoal = Math.hypot(this.ball.x - ownGoalX, this.ball.z - GOAL_Z);
        if (ballToGoal < DANGER_DIST_M) {
          const free = mates
            .filter((m) => !chasers.has(m.id))
            .sort(
              (a, b) =>
                Math.hypot(a.x - this.ball.x, a.z - this.ball.z)
                - Math.hypot(b.x - this.ball.x, b.z - this.ball.z),
            );
          for (let i = 0; i < COVER_DEFENDERS && i < free.length; i++) {
            const d = free[i]!;
            // Escalonados ao longo da linha bola→meta, ligeiramente abertos
            // para cobrir largura em vez de virarem fila indiana.
            const t = Math.min(0.75, (2.6 + i * 2.3) / Math.max(1, ballToGoal));
            d.targetX = this.ball.x + (ownGoalX - this.ball.x) * t;
            d.targetZ = GOAL_Z + (this.ball.z - GOAL_Z) * (1 - t) + (i - 1) * 5.5;
            d.urgency = 1;
            d.tight = true;
            this.marcarAcao(d.id, 'cover_shot_line');
            cover.add(d.id);
          }
        }
      }

      // Marcação: sem a bola, quem está atrás pega o adversário mais perigoso
      // da sua zona em vez de só ocupar posição. Sem isto o ataque chega
      // limpo à pequena área e o xG médio da finalização fica absurdo.
      const marks = new Map<string, MotorPlayer>();
      if (!teamHasBall) {
        const dir = this.dirOf(side);
        const threats = this.players
          .filter((o) => o.side !== side && o.role !== 'gk')
          .filter((o) => positionValue(o.x, o.z, (-dir) as 1 | -1) > 0.26)
          .sort(
            (a, b) =>
              positionValue(b.x, b.z, (-dir) as 1 | -1) - positionValue(a.x, a.z, (-dir) as 1 | -1),
          );
        const free = mates.filter(
          (m) => !chasers.has(m.id) && !cover.has(m.id) && m.depth01 < 0.5,
        );
        for (const th of threats) {
          if (free.length === 0) break;
          free.sort(
            (a, b) => Math.hypot(a.x - th.x, a.z - th.z) - Math.hypot(b.x - th.x, b.z - th.z),
          );
          const marker = free.shift()!;
          marks.set(marker.id, th);
        }
      }

      for (const p of this.players.filter((q) => q.side === side)) {
        if (runners.has(p.id) || cover.has(p.id)) continue;
        const mark = marks.get(p.id);
        if (mark) {
          this.marcarAcao(p.id, 'man_mark');
          // Fica entre o marcado e o próprio gol, colado — mas sem sair da
          // faixa do bloco, senão marcar estica a equipe e reprova a
          // profundidade que a compactação acabou de conquistar.
          const dir = this.dirOf(side);
          const cx = this.blockCenterX(side, false);
          const bandBack = cx + dir * (-0.5 * BLOCK_DEPTH_M - 6);
          const bandFront = cx + dir * (0.5 * BLOCK_DEPTH_M + 6);
          const rawX = mark.x - dir * 1.6;
          p.targetX = dir === 1
            ? Math.max(Math.min(bandBack, bandFront), Math.min(Math.max(bandBack, bandFront), rawX))
            : Math.max(Math.min(bandBack, bandFront), Math.min(Math.max(bandBack, bandFront), rawX));
          p.targetZ = mark.z + (mark.z > GOAL_Z ? -0.9 : 0.9);
          p.urgency = 0.95;
          continue;
        }
        if (p.id === this.carrierId) {
          p.urgency = 0.7;
          continue; // o portador tem alvo próprio (ver carrierAction)
        }
        if (chasers.has(p.id)) {
          p.targetX = contestX;
          p.targetZ = contestZ;
          p.urgency = 1;
          this.marcarAcao(p.id, teamHasBall ? 'chase_loose' : 'press_ball');
          continue;
        }
        const s = this.shapeTarget(p, teamHasBall);
        // Célula-alvo: em vez de ir para o ponto exato da âncora, cada jogador
        // escolhe a melhor opção NUM RAIO EM TORNO DELA. É o que faz o estilo
        // do arquétipo aparecer em todo mundo, não só nos dois apoiadores —
        // um ponta de linha só usa a faixa se tiver como escolher a faixa.
        let tx = s.x;
        let tz = s.z;
        if (p.role !== 'gk') {
          const spot = this.bestRunSpot(p, this.dirOf(side), cps, [], s, CELL_SPREAD);
          if (spot.gain > 0) {
            tx = spot.x;
            tz = spot.z;
            this.marcarAcao(p.id, this.rotuloCorrida(p, this.dirOf(side), spot));
          } else {
            this.marcarAcao(p.id, 'hold_shape');
          }
        }
        p.targetX = tx;
        p.targetZ = tz;
        // Longe do posto = corre para voltar; perto = trota.
        const d = Math.hypot(p.x - tx, p.z - tz);
        p.urgency = Math.max(0.22, Math.min(0.9, d / 22));
      }
    }
  }

  /**
   * Avalia uma finalização a partir da posição atual do jogador. Uma função só
   * para decidir e para resolver — ver `shotOutcome`.
   */
  private evaluateShot(shooter: MotorPlayer, dir: 1 | -1): ShotOutcome {
    const goalX = dir === 1 ? FIELD_LENGTH : 0;
    const dist = Math.hypot(goalX - shooter.x, shooter.z - GOAL_Z);
    const openAngle = Math.atan2(3.66, Math.max(1, dist)) * 2;
    const angle01 = Math.min(1, openAngle / 0.55);
    const cps = this.controlPlayers();
    const press = pressureSec(cps, shooter.side, shooter.x, shooter.z);
    const blockers = countBlockers(shooter, this.players, dir);
    const gk = this.players.find((p) => p.role === 'gk' && p.side !== shooter.side);
    const gkQuality = gk ? (gk.attrs.goleiro ?? gk.attrs.marcacao) : 55;
    // Quanto o goleiro fechou o ângulo: 0 = colado na linha, 1 = bem à frente
    // no vértice do ângulo. Goleiro mal posicionado defende muito menos.
    const gkOut = gk ? Math.abs(gk.x - goalX) : 0;
    const gkCover01 = Math.max(0, Math.min(1, gkOut / 7));
    return shotOutcome(dist, angle01, shooter.attrs.finalizacao, press, blockers, gkQuality, gkCover01);
  }

  /**
   * X da linha de impedimento para quem ataca em `dir`: o penúltimo defensor.
   * Sem isto o atacante acampa nas costas da zaga e a linha nunca sobe.
   */
  private offsideLineX(defendingSide: 'home' | 'away', dir: 1 | -1): number {
    const xs = this.players
      .filter((p) => p.side === defendingSide)
      .map((p) => p.x)
      .sort((a, b) => (dir === 1 ? b - a : a - b));
    const secondLast = xs[1] ?? xs[0] ?? (dir === 1 ? FIELD_LENGTH : 0);
    // Não há impedimento no próprio campo.
    return dir === 1
      ? Math.max(secondLast, FIELD_LENGTH / 2)
      : Math.min(secondLast, FIELD_LENGTH / 2);
  }

  private cp(p: MotorPlayer): ControlPlayer {
    return {
      id: p.id, side: p.side, x: p.x, z: p.z, vx: p.vx, vz: p.vz,
      vmax: p.vmax, accel: p.accel, anticipation01: p.anticipation01,
    };
  }

  /**
   * Melhor destino de corrida para um jogador sem a bola: testa pontos à frente
   * dele e escolhe o que mais soma valor de posse ponderado pelo controle que o
   * time teria ali. É isto que substitui o "ande 3 metros para frente".
   */
  /**
   * Melhor destino entre candidatos gerados EM TORNO DE UM CENTRO.
   *
   * Passando a âncora de forma como centro, o jogador escolhe a melhor opção
   * local sem sair do bloco — é o modelo de "célula-alvo" do Football Manager:
   * o cérebro escolhe um ponto, a cinemática leva até lá em velocidade cheia,
   * e não existe elástico puxando de volta.
   */
  private bestRunSpot(
    p: MotorPlayer,
    dir: 1 | -1,
    cps: ControlPlayer[],
    claimed: Array<{ x: number; z: number }> = [],
    center?: { x: number; z: number },
    spread = 1,
  ): { x: number; z: number; gain: number } {
    const cx = center?.x ?? p.x;
    const cz = center?.z ?? p.z;
    // Visão de Jogo = quantos pontos ele consegue avaliar por ciclo: de 5
    // (não levanta a cabeça) a 12 (enxerga o campo todo).
    const candidates = Math.round(5 + (p.attrs.visaoDeJogo / 100) * 7);
    const scored: Array<{ x: number; z: number; gain: number }> = [];
    // Valor esperado de ONDE ELE ESTÁ, na mesma moeda dos candidatos.
    const cHere = controlAt(cps, this.ball, cx, cz, 20);
    const mineHere = p.side === 'home' ? cHere.home : 1 - cHere.home;
    const here = possessionValue(cx, cz, dir) * mineHere;
    for (let i = 0; i < candidates; i++) {
      const ahead = (8 + (i % 4) * 9) * spread;
      const lateral = (Math.floor(i / 4) % 2 === 0 ? -1 : 1) * (4 + (i % 4) * 5) * spread;
      const offside = this.offsideLineX(p.side === 'home' ? 'away' : 'home', dir);
      const raw = cx + dir * ahead;
      const capped = dir === 1 ? Math.min(raw, offside - 0.5) : Math.max(raw, offside + 0.5);
      const x = Math.max(4, Math.min(FIELD_LENGTH - 4, capped));
      const z = Math.max(3, Math.min(FIELD_WIDTH - 3, cz + lateral));
      const c = controlAt(cps, this.ball, x, z, 20);
      const mine = p.side === 'home' ? c.home : 1 - c.home;
      // Estilo da corrida: quem busca profundidade valoriza o ponto mais
      // adiantado; quem dá largura valoriza o mais aberto. É o que separa o
      // ponta que rasga a linha do que segura a bola no pé na faixa.
      const depthGain = Math.max(0, (x - cx) * dir) / 35;
      const wideGain = Math.abs(z - GOAL_Z) / (FIELD_WIDTH / 2);
      const styleMul =
        1 + depthGain * (p.w.runDepth - 1) + wideGain * (p.w.runWide - 1);
      // GOLS ESPERADOS, não ganho posicional bruto.
      //
      // A versão anterior pontuava `(posição melhor) × (0,25 + 0,75 × controle)`.
      // Aquele piso de 0,25 fazia um ponto TOTALMENTE dominado pelo adversário
      // ainda valer um quarto — então quem decidia "melhor" corria para dentro
      // da marcação. Medido: o time com os quatro mentais em 88 completava
      // 34,0% dos passes contra 37,9% do time com 42, de forma consistente em
      // todos os seeds. Decidir melhor tem que significar valor esperado maior,
      // e valor esperado inclui a chance de a bola chegar lá.
      let gain = possessionValue(x, z, dir) * mine * styleMul - here;
      // Espaço já reivindicado por um companheiro nesta mesma fatia vale menos.
      //
      // Sem isto, DECISÃO alta piorava o time: todo mundo identificava o mesmo
      // "melhor ponto" e corria para lá, enquanto quem decidia mal se espalhava
      // por acidente e cobria mais campo. Medido: Decisão 88 contra 42 dava
      // -3,6 p.p. de acerto de passe. Otimização individual gulosa contra o
      // coletivo — no futebol, você corre onde o companheiro NÃO está.
      for (const c of claimed) {
        const dc = Math.hypot(x - c.x, z - c.z);
        if (dc < CLAIM_RADIUS_M) gain *= dc / CLAIM_RADIUS_M;
      }
      scored.push({ x, z, gain });
    }
    if (scored.length === 0) return { x: p.x, z: p.z, gain: -1 };
    scored.sort((a, b) => b.gain - a.gain);
    // Decisão = chance de ficar com o melhor candidato em vez de um sub-ótimo.
    // Um jogador de Decisão 40 escolhe certo em pouco mais da metade das vezes;
    // é o que faz o mesmo físico render menos num jogador que lê mal.
    // Faixa larga de propósito: com Decisão 40 o jogador acerta a melhor opção
    // em ~3 de 5 vezes; com 90, em ~9 de 10. É a diferença entre um time que
    // constrói e um que desperdiça a mesma posse.
    const pickBest = 0.32 + (p.attrs.decisao / 100) * 0.62;
    if (this.rng() < pickBest || scored.length === 1) return scored[0]!;
    const alt = 1 + Math.floor(this.rng() * Math.min(3, scored.length - 1));
    return scored[alt]!;
  }

  /** Decisão do portador: passe, finalização ou condução. */
  private carrierAction(): void {
    const carrier = this.players.find((p) => p.id === this.carrierId);
    if (!carrier) return;
    const dir = this.dirOf(carrier.side);
    const cps = this.controlPlayers();
    const press = pressureSec(cps, carrier.side, carrier.x, carrier.z);

    // Domínio: ninguém recebe e devolve no mesmo instante. Sob pressão o
    // jogador se livra rápido; livre, ele levanta a cabeça e espera a jogada.
    const held = this.t - this.possessionSince;
    const needed = CONTROL_TIME_MIN_S + Math.min(1, press / 2.2) * CONTROL_TIME_FREE_S;
    if (held < needed) {
      // Enquanto domina, se reposiciona — não fica estátua.
      carrier.targetX = Math.max(3, Math.min(FIELD_LENGTH - 3, carrier.x + dir * 6));
      carrier.targetZ = carrier.z;
      carrier.urgency = 0.45;
      return;
    }

    // Finalizar?
    // Todas as opções abaixo estão em GOLS ESPERADOS — mesma moeda.
    const shot = this.evaluateShot(carrier, dir);
    // O peso do arquétipo entra na DECISÃO de finalizar, nunca na chance real
    // de o chute entrar: um centroavante de área finaliza mais, não com mais
    // sorte. A resolução do lance continua usando `shot` puro.
    const sv = shot.goal * carrier.w.shoot;
    const here = possessionValue(carrier.x, carrier.z, dir);

    // Melhor passe.
    let bestPass: { to: MotorPlayer; value: number; survival: number } | null = null;
    const offside = this.offsideLineX(carrier.side === 'home' ? 'away' : 'home', dir);
    for (const m of this.players) {
      if (m.side !== carrier.side || m.id === carrier.id || m.role === 'gk') continue;
      // Impedido: passe simplesmente não é opção.
      if ((m.x - offside) * dir > 0) continue;
      const d = Math.hypot(m.x - carrier.x, m.z - carrier.z);
      if (d < 4 || d > 55) continue;
      const speed = this.passSpeedFor(carrier, d);
      const survival = passSurvival(cps, carrier, m, carrier.side, speed);
      // ── Estilo entra aqui ──────────────────────────────────────────────
      // Tolerância a risco achata a penalidade do passe improvável: é o meia
      // genial que erra oito e decide o jogo no nono. Progressão ganha bônus
      // separado, porque um armador e um volante de contenção enxergam a mesma
      // bola vertical com valores diferentes.
      const effSurvival = Math.pow(survival, 1 / carrier.w.risk);
      const forward = (m.x - carrier.x) * dir > 3 ? carrier.w.passForward : 1;
      const gain =
        possessionValue(m.x, m.z, dir) * carrier.w.pass * forward
        + RETENTION_VALUE * carrier.w.retention;
      const value = effSurvival * gain;
      if (!bestPass || value > bestPass.value) bestPass = { to: m, value, survival };
    }

    // Conduzir: vale o destino À FRENTE, mas multiplicado pela chance real de
    // chegar lá com a bola. Sem esse desconto, driblar 14 metros por dentro de
    // um bloco compacto era uma opção sem risco — e por isso ninguém passava.
    const carryX = Math.max(3, Math.min(FIELD_LENGTH - 3, carrier.x + dir * 14));
    const nearestFoe = this.players
      .filter((p) => p.side !== carrier.side && p.role !== 'gk')
      .reduce(
        (best, p) => {
          const d = Math.hypot(p.x - carrier.x, p.z - carrier.z);
          return d < best.d ? { d, p } : best;
        },
        { d: Infinity, p: undefined as MotorPlayer | undefined },
      );
    const duel = nearestFoe.p
      ? (carrier.attrs.drible + 10) / (carrier.attrs.drible + nearestFoe.p.attrs.marcacao + 20)
      : 0.85;
    // Quanto mais perto o adversário, menor a chance de a condução sobreviver.
    const carrySurvival = Math.max(
      0.06,
      Math.min(0.92, duel * (0.30 + 0.70 * Math.min(1, nearestFoe.d / 9))),
    );
    const carryValue =
      (possessionValue(carryX, carrier.z, dir) * carrier.w.carry
        + RETENTION_VALUE * carrier.w.retention)
      * carrySurvival;

    const passValue = bestPass ? bestPass.value : -1;

    // Finalizar é decisão cara: só de posição que vale, com chance real, e
    // quando bate as alternativas. Sem estes três filtros o motor chutava 917
    // vezes por partida.
    const goalX = dir === 1 ? FIELD_LENGTH : 0;
    const distToGoal = Math.hypot(goalX - carrier.x, carrier.z - GOAL_Z);
    const canShoot = distToGoal <= 26 && shot.goal >= SHOT_MIN_XG;
    // Na mesma moeda a comparação é direta — com uma reserva: empate técnico
    // entre finalizar e passar não vira finalização, porque finalizar ENCERRA
    // a posse enquanto passar a mantém.
    //
    // MEDIDO: hoje esta reserva não muda uma única decisão — as três medidas de
    // ritmo saem idênticas com 1.0 e com 1.25. Quando o motor decide finalizar,
    // o chute já vale mais de 25% acima da melhor alternativa. Ou seja, o
    // excesso de finalizações (49 por partida contra as ~25 do futebol) NÃO vem
    // de o portador ser afoito: vem de o ataque chegar a boas posições vezes
    // demais. O conserto é defensivo, não é mexer neste número.
    const SHOOT_RELUCTANCE = 1.25;
    if (canShoot && sv > passValue * SHOOT_RELUCTANCE && sv > carryValue * SHOOT_RELUCTANCE) {
      this.marcarAcao(carrier.id, 'take_shot', 6);
      this.takeShot(carrier, dir, shot);
      return;
    }
    if (bestPass && passValue >= carryValue) {
      const progride = (bestPass.to.x - carrier.x) * dir > 6;
      this.marcarAcao(carrier.id, progride ? 'pass_progress' : 'sq_recycle', 3.5);
      this.makePass(carrier, bestPass.to, bestPass.survival, press);
      return;
    }
    this.bySide[carrier.side].carries++;
    this.pstat(carrier.id).carries++;
    this.marcarAcao(carrier.id, 'carry_forward', 2.5);
    // Condução: destino de verdade, não um passinho.
    carrier.targetX = carryX;
    carrier.targetZ = carrier.z + (this.rng() - 0.5) * 8;
    carrier.urgency = 0.85;
  }

  private passSpeedFor(from: MotorPlayer, dist: number): number {
    const skill = from.attrs.passe / 100;
    const wanted = 14 + dist * 0.22 + skill * 5;
    return Math.max(PASS_SPEED_MIN_MS, Math.min(PASS_SPEED_MAX_MS, wanted));
  }

  /** Ruído gaussiano ~N(0,1) a partir do rng determinístico (Box–Muller). */
  private gauss(): number {
    const u = Math.max(1e-9, this.rng());
    const v = this.rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private makePass(from: MotorPlayer, to: MotorPlayer, survival = 1, press = 9): void {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const speed = this.passSpeedFor(from, d);
    // Lidera o passe: a bola vai para onde o receptor VAI estar.
    const lead = Math.min(2.2, d / speed);
    let toX = to.x + to.vx * lead;
    let toZ = to.z + to.vz * lead;

    // ── Erro de execução ────────────────────────────────────────────────────
    // `passSurvival` só entrava na ESCOLHA do passe: uma vez escolhido, a bola
    // chegava sempre exatamente onde foi mirada. Sem erro de execução o ataque
    // não tem como falhar no meio do caminho, e por isso quase toda posse
    // chegava à área — o motor produzia uma finalização a cada 1,04 passe.
    // Aqui o passe difícil, o jogador pressionado e o passe longo erram.
    // Sob pressão quem decide bem mantém a qualidade; quem decide mal apressa
    // e erra — é para isso que serve o atributo Decisão.
    const composure = 0.62 + (from.attrs.decisao / 100) * 0.38;
    const rushed = 0.55 + 0.45 * Math.min(1, (press / 1.6) * composure + (1 - composure) * 0);
    const accuracy = Math.min(
      0.97,
      ((from.attrs.passe / 100) * 0.58 + survival * 0.42) * (0.72 + 0.28 * composure) * rushed,
    );
    const sigma = (1 - accuracy) * (2.2 + d * 0.12);
    toX += this.gauss() * sigma;
    toZ += this.gauss() * sigma;
    toX = Math.max(2, Math.min(FIELD_LENGTH - 2, toX));
    toZ = Math.max(1, Math.min(FIELD_WIDTH - 1, toZ));
    this.ball.x = from.x;
    this.ball.z = from.z;
    this.flight = { toX, toZ, speed, targetId: to.id, passerId: from.id, travelled: 0 };
    this.ultimoPassador = from.id;
    this.ballMode = 'flight';
    this.setCarrier(null);
    this.stats.passes++;
    const acc = this.bySide[from.side];
    acc.passes++;
    acc.passDistSum += d;
    const pe = this.pstat(from.id);
    pe.passes++;
    if ((toX - from.x) * this.dirOf(from.side) > 3) {
      acc.passesForward++;
      pe.passesForward++;
    }
  }

  private takeShot(shooter: MotorPlayer, dir: 1 | -1, o: ShotOutcome): void {
    this.stats.shots++;
    this.bySide[shooter.side].shots++;
    this.bySide[shooter.side].xg += o.goal;
    const ps = this.pstat(shooter.id);
    ps.shots++;
    ps.xg += o.goal;
    const goalX: number = dir === 1 ? FIELD_LENGTH : 0;
    const foeSide = shooter.side === 'home' ? 'away' : 'home';

    // 1. Travou num corpo.
    if (this.rng() < o.blocked) {
      this.stats.blocked++;
      this.evento(`Bloqueio na frente de ${this.rotulo(shooter)}`, 'shot', shooter.id);
      // Boa parte dos bloqueios DESVIA para fora — escanteio, não segunda
      // chance imediata. Sem isso o lance vira metralhadora: medido, a partida
      // tinha 131 trocas de posse e 67 finalizações, ou seja meia finalização
      // por posse contra 0,1 do futebol real. Não eram posses demais; eram
      // chutes repetidos DENTRO da mesma posse.
      if (this.rng() < BLOCKED_OUT_CHANCE) {
        this.ball.x = goalX - dir * 1.5;
        this.ball.z = shooter.z > GOAL_Z ? FIELD_WIDTH - 1 : 1;
        this.stop('shot', foeSide);
        return;
      }
      this.ball.x = shooter.x + dir * 2.0;
      this.ball.z = shooter.z + (this.rng() - 0.5) * 5;
      this.giveToNearest(9, foeSide);
      return;
    }
    // 2. Foi para fora.
    if (this.rng() > o.onTarget) {
      this.stats.offTarget++;
      this.evento(`${this.rotulo(shooter)} finalizou para fora`, 'shot', shooter.id);
      this.ball.x = goalX + (dir === 1 ? -5 : 5);
      this.ball.z = GOAL_Z + (this.rng() - 0.5) * 16;
      this.stop('shot', foeSide);
      return;
    }
    this.stats.onTarget++;
    // 3. Goleiro.
    if (this.rng() < o.save) {
      this.stats.saves++;
      const gk = this.players.find((p) => p.role === 'gk' && p.side === foeSide);
      this.evento(`Defesa do goleiro — ${this.rotulo(shooter)} finalizou`, 'save', shooter.id);
      // Segura, espalma para fora ou dá rebote. Rebote que sobra limpo para o
      // atacante é a exceção no futebol, não a regra.
      if (this.rng() < SAVE_HELD_CHANCE) {
        this.ball.x = gk?.x ?? goalX;
        this.ball.z = gk?.z ?? GOAL_Z;
        this.stop('shot', foeSide);
      } else {
        this.stats.rebounds++;
        this.ball.x = goalX - dir * (5 + this.rng() * 5);
        this.ball.z = GOAL_Z + (this.rng() - 0.5) * 14;
        this.giveToNearest(11, foeSide);
      }
      return;
    }
    // 4. Gol.
    if (shooter.side === 'home') this.homeScore++;
    else this.awayScore++;
    this.stats.goals++;
    this.pstat(shooter.id).goals++;
    this.evento(`GOL! ${this.rotulo(shooter)}`, 'goal', shooter.id);
    this.kickoff(foeSide);
  }

  /**
   * Entrega a bola solta a quem estiver mais perto; se ninguém, sai de jogo.
   *
   * `favour` privilegia um lado — um chute travado sobra para quem bloqueou, e
   * um rebote de goleiro cai mais vezes para a defesa do que para o atacante.
   *
   * O reset de posse é OBRIGATÓRIO aqui: sem ele, quando a bola voltava para o
   * próprio finalizador, `setCarrier` via o mesmo id, não reiniciava o relógio
   * de domínio, e ele batia de novo no instante seguinte. Era um laço — 28% das
   * finalizações saíam a menos de 3s da anterior, e o motor chegou a 287
   * finalizações por partida com apenas 102 passes.
   */
  private giveToNearest(maxDist: number, favour?: 'home' | 'away'): void {
    this.ballMode = 'held';
    this.flight = null;
    let best: MotorPlayer | undefined;
    let bestD = Infinity;
    for (const p of this.players) {
      const raw = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      // Vantagem de posição para o lado favorecido: ele já estava de frente
      // para a bola, o atacante estava de costas ou desequilibrado.
      const d = favour && p.side === favour ? raw * 0.55 : raw;
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best || bestD > maxDist) {
      this.stop('out', this.rng() < 0.5 ? 'home' : 'away');
      return;
    }
    this.setCarrier(best.id, true);
  }

  private kickoff(side: 'home' | 'away'): void {
    this.ball.x = FIELD_LENGTH / 2;
    this.ball.z = GOAL_Z;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ballMode = 'held';
    this.flight = null;
    const taker = this.players.find(
      (p) => p.side === side && p.role === 'attack',
    ) ?? this.players.find((p) => p.side === side && p.role !== 'gk');
    this.setCarrier(taker?.id ?? null);
    for (const p of this.players) {
      const s = this.shapeTarget(p, p.side === side);
      p.x = s.x;
      p.z = s.z;
      p.vx = 0;
      p.vz = 0;
    }
    if (taker) {
      taker.x = FIELD_LENGTH / 2 - this.dirOf(side) * 1.2;
      taker.z = GOAL_Z;
    }
  }

  // ── física ──────────────────────────────────────────────────────────────────

  private movePlayers(dt: number): void {
    for (const p of this.players) {
      const dx = p.targetX - p.x;
      const dz = p.targetZ - p.z;
      const d = Math.hypot(dx, dz);

      // Velocidade desejada: sobe com a distância e com a urgência. Chegando
      // perto, desacelera — mas o destino é longe o bastante para exigir
      // corrida, que era exatamente o que faltava no motor antigo.
      const carrying = p.id === this.carrierId && this.ballMode === 'held';
      const effVmax =
        p.vmax * (0.72 + 0.28 * (p.stamina / 100)) * (carrying ? CARRY_SPEED_MULT : 1);

      // Repulsão entre companheiros: mantém o time ocupando espaços distintos
      // dentro do bloco em vez de virar aglomerado em cima da bola.
      let sepX = 0;
      let sepZ = 0;
      if (!carrying && p.role !== 'gk') {
        for (const o of this.players) {
          if (o === p || o.side !== p.side || o.role === 'gk') continue;
          const ddx = p.x - o.x;
          const ddz = p.z - o.z;
          const dd = Math.hypot(ddx, ddz);
          if (dd > 1e-6 && dd < TEAMMATE_MIN_SEP_M) {
            const push = (TEAMMATE_MIN_SEP_M - dd) / TEAMMATE_MIN_SEP_M;
            const k = p.tight || o.tight ? COVER_SEPARATION_MULT : 1;
            sepX += (ddx / dd) * push * k;
            sepZ += (ddz / dd) * push * k;
          }
        }
      }
      const want = Math.min(effVmax, effVmax * p.urgency * Math.min(1, d / 6));
      const tx = (d > 1e-6 ? (dx / d) * want : 0) + sepX * SEPARATION_STRENGTH;
      const tz = (d > 1e-6 ? (dz / d) * want : 0) + sepZ * SEPARATION_STRENGTH;

      // Aceleração limitada — é o que dá inércia e faz o momento importar.
      const accel = p.accel * dt;
      const ax = tx - p.vx;
      const az = tz - p.vz;
      const am = Math.hypot(ax, az);
      if (am > accel) {
        p.vx += (ax / am) * accel;
        p.vz += (az / am) * accel;
      } else {
        p.vx = tx;
        p.vz = tz;
      }

      const antesX = p.x;
      const antesZ = p.z;
      p.x = Math.max(0.5, Math.min(FIELD_LENGTH - 0.5, p.x + p.vx * dt));
      p.z = Math.max(0.5, Math.min(FIELD_WIDTH - 0.5, p.z + p.vz * dt));
      // Distância percorrida — o pós-jogo cobra quilometragem e é o que
      // transforma "jogou bem" em número que o torcedor reconhece.
      this.pstat(p.id).distanceM += Math.hypot(p.x - antesX, p.z - antesZ);

      // Fadiga: correr custa, andar recupera.
      const spd = Math.hypot(p.vx, p.vz);
      const drain = spd > 5.5 ? 0.010 : spd > 3 ? 0.003 : -0.006;
      p.stamina = Math.max(45, Math.min(100, p.stamina - drain * dt * 60 * (1 - p.attrs.fisico / 320)));
    }
  }

  private moveBall(dt: number): void {
    if (this.ballMode === 'held') {
      const c = this.players.find((p) => p.id === this.carrierId);
      if (c) {
        const spd = Math.hypot(c.vx, c.vz);
        const ux = spd > 0.1 ? c.vx / spd : 0;
        const uz = spd > 0.1 ? c.vz / spd : 0;
        this.ball.x = c.x + ux * 0.9;
        this.ball.z = c.z + uz * 0.9;
        this.ball.vx = c.vx;
        this.ball.vz = c.vz;
      }
      return;
    }

    const f = this.flight;
    if (!f) return;
    const dx = f.toX - this.ball.x;
    const dz = f.toZ - this.ball.z;
    const d = Math.hypot(dx, dz);
    this.ball.vx = d > 1e-6 ? (dx / d) * f.speed : 0;
    this.ball.vz = d > 1e-6 ? (dz / d) * f.speed : 0;

    const stepDist = f.speed * dt;
    if (stepDist >= d) {
      this.ball.x = f.toX;
      this.ball.z = f.toZ;
      this.resolveReception();
      return;
    }
    this.ball.x += this.ball.vx * dt;
    this.ball.z += this.ball.vz * dt;
    f.travelled += stepDist;

    // Saiu pela lateral. Sem isto a partida não tinha uma única reposição — e
    // são ~40 por jogo no futebol, parte do orçamento de bola parada.
    if (this.ball.z <= 0.4 || this.ball.z >= FIELD_WIDTH - 0.4) {
      const passer = this.players.find((p) => p.id === f.passerId);
      this.stop('out', passer?.side === 'home' ? 'away' : 'home');
      return;
    }

    // Interceptação. Duas guardas que faltavam e quebravam tudo: quem passou
    // não pode reinterceptar (ele está a 1m da bola no primeiro passo, então
    // TODO passe se completava no lugar — a bola nunca chegava a voar), e a
    // bola precisa ter andado um mínimo antes de qualquer um pegá-la.
    if (f.travelled < 3.5) return;
    for (const p of this.players) {
      if (p.id === f.passerId) continue;
      const dp = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      // Antecipação entra na EXECUÇÃO, não só na percepção. Antes ela só
      // encurtava o tempo de reação dentro do controle de espaço, o que fazia
      // o time achar que estava mais seguro do que estava: ele arriscava
      // passes com base numa vantagem que não existia na hora de interceptar.
      // Medido: Antecipação 88 contra 42 dava -3,2 p.p. de acerto de passe.
      const reach = INTERCEPT_BASE_M + p.anticipation01 * INTERCEPT_ANTICIPATION_M;
      if (dp < reach) {
        // Companheiro que corta a bola no caminho RECEBEU o passe — não é
        // interceptação. Sem esta distinção, todo passe apanhado antes de
        // chegar ao ponto exato contava como perdido: o acerto de passe
        // despencou para 10,6%, o que não é futebol nenhum, e por um triz
        // isso passou por "o time é mais ambicioso".
        const passer = this.players.find((q) => q.id === f.passerId);
        if (passer && p.side === passer.side) {
          this.stats.passesOk++;
          this.bySide[p.side].passesOk++;
          this.pstat(passer.id).passesOk++;
        }
        this.setCarrier(p.id);
        this.ballMode = 'held';
        this.flight = null;
        return;
      }
    }
  }

  /** Quem deu o último passe — a recepção precisa creditar o passador. */
  private ultimoPassador: string | null = null;

  private resolveReception(): void {
    const target = this.flight?.targetId
      ? this.players.find((p) => p.id === this.flight!.targetId)
      : undefined;
    this.flight = null;
    this.ballMode = 'held';
    // Quem estiver mais perto do ponto de chegada fica com ela.
    let best: MotorPlayer | undefined = target;
    let bestD = target ? Math.hypot(target.x - this.ball.x, target.z - this.ball.z) : Infinity;
    for (const p of this.players) {
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    // Perto da linha, passe malfeito vira lateral — sem isto a bola nunca sai
    // de jogo e a partida não tem as ~40 reposições que fazem o ritmo real.
    const nearTouch = this.ball.z < 4 || this.ball.z > FIELD_WIDTH - 4;
    if (nearTouch && bestD > 2.2) {
      this.stop('out', target?.side === 'home' ? 'away' : 'home');
      return;
    }
    // Ninguém razoavelmente perto do ponto de chegada: a bola saiu.
    if (!best || bestD > 6.5) {
      const side = target?.side === 'home' ? 'away' : 'home';
      this.stop('out', side);
      return;
    }
    this.setCarrier(best.id);
    if (best.side === target?.side) {
      this.stats.passesOk++;
      this.bySide[best.side].passesOk++;
      const passador = this.flight?.passerId ?? this.ultimoPassador;
      if (passador) this.pstat(passador).passesOk++;
    }
  }

  /** Disputa direta: adversário colado no portador pode roubar. */
  private resolveTackles(dt: number): void {
    const c = this.players.find((p) => p.id === this.carrierId);
    if (!c) return;
    for (const p of this.players) {
      if (p.side === c.side) continue;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d > TACKLE_RADIUS_M) continue;
      const win = (p.attrs.marcacao + 12) / (p.attrs.marcacao + c.attrs.drible + 24);
      if (this.rng() < win * TACKLE_ATTEMPTS_PER_S * dt) {
        this.setCarrier(p.id);
        this.stats.tackles++;
        this.pstat(p.id).tackles++;
        return;
      }
      // Desarme malfeito: falta e bola parada.
      if (this.rng() < FOUL_RATE_PER_S * dt) {
        this.evento(`Falta de ${this.rotulo(p)} em ${this.rotulo(c)}`, 'freekick', p.id);
        this.stop('foul', c.side);
        return;
      }
    }
  }

  // ── loop ────────────────────────────────────────────────────────────────────

  /** Avança um passo de STEP_S segundos de futebol. */
  step(): void {
    const dead = this.t < this.deadUntil;
    if (dead) {
      // Bola parada: os onze se recolocam, o jogo não anda. É o que faz a
      // partida ter ~55 minutos de bola rolando em vez de 90.
      this.phase = 'dead_ball';
      if (this.stepCount % STEPS_PER_SLICE === 0) this.assignTargets();
      this.movePlayers(STEP_S);
      this.stepCount++;
      this.t += STEP_S;
      return;
    }
    if (this.phase === 'dead_ball' && !this.finished) {
      this.phase = 'live';
      this.possessionSince = this.t;
    }
    this.inPlayAccum += STEP_S;
    const holder = this.carrierId ? this.players.find((p) => p.id === this.carrierId) : undefined;
    if (holder) {
      const acc = this.bySide[holder.side];
      acc.possessionS += STEP_S;
      acc.touches++;
      if (Math.abs(holder.z - GOAL_Z) > 17) acc.touchesWide++;
      // Avanço do toque: quantos metros à frente do próprio gol ele aconteceu.
      const ownGoalX = this.dirOf(holder.side) === 1 ? 0 : FIELD_LENGTH;
      acc.touchAdvanceSum += Math.abs(holder.x - ownGoalX);
    }

    // A FORMA do time é coletiva e roda na fatia fixa. A DECISÃO do portador
    // roda no ritmo dele: Decisão e Visão altas revêem o campo a cada 150ms,
    // baixas a cada 400ms.
    if (this.stepCount % STEPS_PER_SLICE === 0) this.assignTargets();
    if (this.ballMode === 'held' && this.carrierId) {
      const c = this.players.find((p) => p.id === this.carrierId);
      if (c && this.t >= c.nextDecisionAt) {
        c.nextDecisionAt = this.t + c.sliceS;
        this.carrierAction();
      }
    }
    this.movePlayers(STEP_S);
    this.moveBall(STEP_S);
    if (this.ballMode === 'held') this.resolveTackles(STEP_S);

    this.stepCount++;
    this.t += STEP_S;

    if (this.half === 1 && this.t >= HALF_SECONDS) {
      this.half = 2;
      this.kickoff('away');
    } else if (this.half === 2 && this.t >= HALF_SECONDS * 2) {
      this.phase = 'dead_ball';
    }
  }

  get finished(): boolean {
    return this.t >= HALF_SECONDS * 2;
  }

  /** Emite o contrato de verdade — o mesmo que a régua e a UI já consomem. */
  snapshot(): MatchTruthSnapshot {
    const players: MatchTruthPlayer[] = this.players.map((p) => {
      const speed = Math.hypot(p.vx, p.vz);
      return {
        id: p.id,
        side: p.side,
        x: p.x,
        y: 0,
        z: p.z,
        heading: Math.atan2(p.vx, p.vz),
        speed,
        role: p.role,
        shirtNumber: p.shirtNumber,
        matchStamina: p.stamina,
        locomotionState: speed > 5.5 ? 'sprint' : speed > 2.6 ? 'jog' : 'walk',
      };
    });
    return {
      schemaVersion: 1,
      t: this.t,
      ball: { x: this.ball.x, y: 0, z: this.ball.z, vx: this.ball.vx, vz: this.ball.vz },
      players,
      matchPhase: this.phase,
    };
  }

  get carrier(): string | null {
    return this.carrierId;
  }

  /** Minuto de futebol para exibição, 0–90. */
  get minute(): number {
    return Math.min(90, Math.floor(this.t / 60));
  }

  /**
   * Grava a decisão do jogador.
   *
   * Ação COM a bola gruda por alguns segundos. Sem isso ela é apagada na fatia
   * seguinte pela decisão de forma — o jogador finaliza e, um quarto de segundo
   * depois, o card já diz "Segurou o posto". Quem toca no card quer ver o que
   * ele acabou de fazer de relevante, não o que está fazendo neste instante.
   */
  private marcarAcao(id: string, acao: string, seguraS = 0): void {
    if (seguraS <= 0 && (this.actionHold.get(id) ?? 0) > this.t) return;
    this.lastAction.set(id, acao);
    if (seguraS > 0) this.actionHold.set(id, this.t + seguraS);
  }

  /**
   * Que tipo de corrida foi essa? Profundidade e largura saem da geometria do
   * destino escolhido; o papel decide a palavra, porque um centroavante que
   * ataca a profundidade "infiltra a área" e um lateral "faz o overlap".
   */
  private rotuloCorrida(
    p: MotorPlayer,
    dir: 1 | -1,
    spot: { x: number; z: number },
  ): string {
    const ganhoProfundidade = (spot.x - p.x) * dir;
    const abriu = Math.abs(spot.z - GOAL_Z) > Math.abs(p.z - GOAL_Z) + 2;
    if (ganhoProfundidade > 9) {
      if (p.role === 'attack') return 'striker_infiltrate_box';
      if (p.slotId === 'pe' || p.slotId === 'pd') return 'winger_attack_depth';
      if (p.role === 'def') return 'fullback_overlap_box_entry';
      return 'mid_attack_depth';
    }
    if (abriu) return p.role === 'def' ? 'open_width' : 'sq_create_width';
    if (ganhoProfundidade < -4) return 'defensive_cover';
    return 'sq_offer_line';
  }

  /** Nome curto do jogador para a narrativa. */
  private rotulo(p: MotorPlayer): string {
    return `#${p.shirtNumber ?? '?'} ${p.slotId.toUpperCase()}`;
  }

  /** Segundos de futebol com a bola em jogo. */
  get inPlaySeconds(): number {
    return this.inPlayAccum;
  }

  private evento(text: string, kind: string, playerId?: string): void {
    this.events.push({ minute: this.minute, text, kind, playerId });
    if (this.events.length > 300) this.events.shift();
  }

  private setCarrier(id: string | null, forceReset = false): void {
    if (forceReset || id !== this.carrierId) this.possessionSince = this.t;
    this.carrierId = id;
  }

  /** Manda a bola para fora e para o relógio de jogo. */
  private stop(kind: 'shot' | 'out' | 'foul', nextSide: 'home' | 'away'): void {
    const dur =
      kind === 'shot' ? DEAD_AFTER_SHOT_S : kind === 'out' ? DEAD_AFTER_OUT_S : DEAD_AFTER_FOUL_S;
    this.deadUntil = this.t + dur;
    this.phase = 'dead_ball';
    this.stoppages[kind === 'shot' ? 'shots' : kind === 'out' ? 'outs' : 'fouls']++;
    this.ballMode = 'held';
    this.flight = null;
    // Quem reinicia: o jogador do lado indicado mais próximo da bola.
    const cand = this.players
      .filter((p) => p.side === nextSide)
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.ball.x, a.z - this.ball.z)
          - Math.hypot(b.x - this.ball.x, b.z - this.ball.z),
      )[0];
    this.setCarrier(cand?.id ?? null);
  }
}

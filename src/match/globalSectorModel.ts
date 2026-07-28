/**
 * MOTOR POR SETOR da Liga Global — o coração do placar que sai dos 11 REAIS.
 *
 * Antes, o placar vinha de UM número (overall agregado) num Poisson. Aqui a força
 * vem de SETORES reais: o ataque de um time enfrenta a defesa do outro, o meio
 * decide a posse. E o artilheiro sai POR TIPO DE LANCE — porque desde o Elifoot o
 * zagueiro marca de cabeça no escanteio, o meia bate a falta, o frio cobra o
 * pênalti. Restringir gol a atacante seria mutilar o futebol.
 *
 * PUREZA: nada de I/O, nada de Date/Math.random embutido — o `rng` entra por
 * parâmetro. É o que deixa este módulo testável e ESPELHÁVEL no Edge Function
 * (Deno) sem divergir do cliente. Um teste de paridade guarda a cópia.
 *
 * Só o time do MANAGER tem elenco real; o `player_id` só serve pra artilharia se
 * for UUID de `public.players` (senão o gol conta no placar, sem autor gravável).
 */

/** Jogador no snapshot de escalação que o cliente sincroniza pro servidor. */
export interface SnapshotPlayer {
  /** UUID real de public.players, ou null pra elenco legado (gol sem autor gravável). */
  id: string | null;
  name: string;
  pos: string;
  finalizacao: number;
  drible: number;
  velocidade: number;
  passe: number;
  marcacao: number;
  fisico: number;
  cabeceio: number;
  bolaParada: number;
  penalti: number;
  confianca: number;
}

export interface LineupSnapshot {
  v: number;
  formation: string;
  players: SnapshotPlayer[];
}

export interface Sectors {
  atk: number;
  mid: number;
  def: number;
}

export type GoalType = 'open' | 'header' | 'free_kick' | 'penalty';

export interface ScorerPick {
  playerId: string | null;
  name: string;
  pos: string;
  type: GoalType;
}

// ─── Classificação de posição em setor ──────────────────────────────────────

type SectorKey = 'atk' | 'mid' | 'def';

function sectorOf(pos: string): SectorKey {
  switch ((pos || '').trim().toUpperCase()) {
    case 'GOL':
    case 'ZAG':
    case 'LE':
    case 'LD':
      return 'def';
    case 'VOL':
    case 'MC':
    case 'MEI':
      return 'mid';
    case 'PE':
    case 'PD':
    case 'ATA':
    default:
      return 'atk';
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/**
 * Força de cada setor a partir dos jogadores reais. Cada setor pondera os
 * atributos que importam pra ele: ataque = finalização/drible/velocidade,
 * meio = passe/visão/físico, defesa = marcação/físico/velocidade.
 *
 * Setor sem jogador cai num piso (55) pra não zerar o time por falta de peça
 * numa linha — o fallback de "sem snapshot" é tratado por quem chama.
 */
export function computeSectors(players: SnapshotPlayer[]): Sectors {
  const FLOOR = 55;
  const atkRatings: number[] = [];
  const midRatings: number[] = [];
  const defRatings: number[] = [];
  for (const p of players) {
    const s = sectorOf(p.pos);
    if (s === 'atk') atkRatings.push(0.5 * p.finalizacao + 0.3 * p.drible + 0.2 * p.velocidade);
    else if (s === 'mid') midRatings.push(0.45 * p.passe + 0.3 * p.velocidade + 0.25 * p.marcacao);
    else defRatings.push(0.45 * p.marcacao + 0.35 * p.fisico + 0.2 * p.velocidade);
  }
  return {
    atk: atkRatings.length ? avg(atkRatings) : FLOOR,
    mid: midRatings.length ? avg(midRatings) : FLOOR,
    def: defRatings.length ? avg(defRatings) : FLOOR,
  };
}

// ─── Setores → gols esperados (λ do Poisson) ────────────────────────────────

/** Sensibilidade: quantos pontos de vantagem de setor valem ~1 gol esperado. */
const ATK_DEF_SENS = 22;
const MID_SENS = 34;
const BASE_LAMBDA = 1.35;
const HOME_EDGE = 0.18; // mando de campo, em gols esperados

export interface LambdaInput {
  home: Sectors;
  away: Sectors;
}

/** λ esperado de cada lado — mesma família Poisson, origem trocada pro setor real. */
export function sectorsToLambda({ home, away }: LambdaInput): { home: number; away: number } {
  const midEdge = home.mid - away.mid;
  const homeLambda =
    BASE_LAMBDA + (home.atk - away.def) / ATK_DEF_SENS + midEdge / MID_SENS + HOME_EDGE;
  const awayLambda =
    BASE_LAMBDA + (away.atk - home.def) / ATK_DEF_SENS - midEdge / MID_SENS;
  return {
    home: clamp(homeLambda, 0.2, 5),
    away: clamp(awayLambda, 0.2, 5),
  };
}

/** Sorteio de Poisson (Knuth) — `rng` entra por fora pra ser determinístico/espelhável. */
export function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 12);
  return k - 1;
}

// ─── Tipo de lance + artilheiro ─────────────────────────────────────────────

/**
 * Distribuição dos tipos de gol — aproximada do futebol real. Jogada aberta
 * domina, mas cabeça, falta e pênalti têm fatia de verdade (é o que traz o
 * zagueiro, o batedor e o cobrador pro placar).
 */
const GOAL_TYPE_TABLE: Array<{ type: GoalType; p: number }> = [
  { type: 'open', p: 0.7 },
  { type: 'header', p: 0.15 },
  { type: 'penalty', p: 0.08 },
  { type: 'free_kick', p: 0.07 },
];

export function pickGoalType(rng: () => number): GoalType {
  let r = rng();
  for (const row of GOAL_TYPE_TABLE) {
    if (r < row.p) return row.type;
    r -= row.p;
  }
  return 'open';
}

/** Peso de posição pra gol de jogada aberta (atacante pesa mais, mas todos entram). */
function openPlayPosWeight(pos: string): number {
  switch ((pos || '').trim().toUpperCase()) {
    case 'ATA':
      return 1;
    case 'PE':
    case 'PD':
    case 'MEI':
      return 0.72;
    case 'MC':
      return 0.4;
    case 'VOL':
      return 0.22;
    case 'LE':
    case 'LD':
      return 0.16;
    case 'ZAG':
      return 0.1;
    case 'GOL':
      return 0.002;
    default:
      return 0.3;
  }
}

/** Empurrão de cabeceio por posição: quem sobe na bola alta. */
function headerPosBoost(pos: string): number {
  switch ((pos || '').trim().toUpperCase()) {
    case 'ZAG':
      return 1.4;
    case 'ATA':
      return 1.3;
    case 'VOL':
      return 0.9;
    case 'GOL':
      return 0; // goleiro não sobe pro escanteio (aqui)
    default:
      return 0.7;
  }
}

/** Peso de cada jogador para marcar um gol de um dado TIPO de lance. */
function scorerWeight(p: SnapshotPlayer, type: GoalType): number {
  switch (type) {
    case 'open':
      return openPlayPosWeight(p.pos) * (0.35 + p.finalizacao / 99);
    case 'header':
      // Cabeceio manda, com empurrão de quem sobe (zagueiro, centroavante).
      return Math.pow(p.cabeceio / 99, 2) * headerPosBoost(p.pos);
    case 'free_kick':
      // O batedor especialista concentra as faltas (bolaParada ao cubo).
      return Math.pow(p.bolaParada / 99, 3);
    case 'penalty':
      // O cobrador designado: maior pênalti + frieza.
      return Math.pow((0.7 * p.penalti + 0.3 * p.confianca) / 99, 3);
    default:
      return 0.001;
  }
}

/**
 * Sorteia QUEM marcou um gol de um dado tipo, ponderado pelos atributos reais.
 * `rng` entra por fora. Devolve null se, por acaso, não houver jogador elegível
 * (defensivo — o placar já contou o gol).
 */
/** Habilidade de cobrança usada pra eleger o batedor/cobrador designado. */
function setPieceSkill(p: SnapshotPlayer, type: GoalType): number {
  return type === 'free_kick' ? p.bolaParada : 0.7 * p.penalti + 0.3 * p.confianca;
}

/** Chance do cobrador DESIGNADO bater — falta/pênalti têm dono, não é loteria. */
const DESIGNATED_TAKER_PROB = 0.85;

export function pickScorer(
  players: SnapshotPlayer[],
  type: GoalType,
  rng: () => number,
): ScorerPick | null {
  if (players.length === 0) return null;

  // Falta direta e pênalti: o time tem COBRADOR designado (o de maior atributo),
  // e é ele quem bate quase sempre — como na vida real. Só de vez em quando outro
  // assume, e aí cai na loteria ponderada abaixo.
  if (type === 'free_kick' || type === 'penalty') {
    let taker = players[0]!;
    for (const p of players) if (setPieceSkill(p, type) > setPieceSkill(taker, type)) taker = p;
    if (rng() < DESIGNATED_TAKER_PROB) {
      return { playerId: taker.id, name: taker.name, pos: taker.pos, type };
    }
  }

  const weights = players.map((p) => Math.max(0, scorerWeight(p, type)));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    // Ninguém com atributo pro lance — cai no jogador mais ofensivo qualquer.
    const p = players[0]!;
    return { playerId: p.id, name: p.name, pos: p.pos, type };
  }
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i]!;
    if (r <= 0) {
      const p = players[i]!;
      return { playerId: p.id, name: p.name, pos: p.pos, type };
    }
  }
  const p = players[players.length - 1]!;
  return { playerId: p.id, name: p.name, pos: p.pos, type };
}

/** Sorteia N marcadores para um time (um tipo de lance por gol). */
export function drawScorers(
  players: SnapshotPlayer[],
  goals: number,
  rng: () => number,
): ScorerPick[] {
  const out: ScorerPick[] = [];
  for (let g = 0; g < goals; g++) {
    const type = pickGoalType(rng);
    const scorer = pickScorer(players, type, rng);
    if (scorer) out.push(scorer);
  }
  return out;
}

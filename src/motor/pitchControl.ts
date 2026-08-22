/**
 * /src/motor/pitchControl.ts — CAMADA L1: ESPAÇO
 *
 * Controle de espaço no formato de Spearman: para um ponto do campo, quem
 * chega primeiro? A resposta sai do tempo de interceptação de cada um dos 22
 * (posição + velocidade + aceleração) confrontado com o tempo de voo da bola
 * até ali.
 *
 * Um modelo só entrega, de uma vez, as quatro perguntas que a decisão precisa:
 *   · esse companheiro está livre para receber?
 *   · essa corrida cria espaço?
 *   · o bloco está compacto?
 *   · quanta pressão o portador está sofrendo?
 *
 * ── Unidades ─────────────────────────────────────────────────────────────────
 * Tudo aqui é FUTEBOL REAL: metros, segundos, m/s. O motor antigo comprimia o
 * tempo em 15× e mantinha as distâncias em metros, o que obrigava cada
 * velocidade a ser multiplicada por 15 — e nenhuma era. Este módulo não conhece
 * compressão nenhuma; quem quiser tocar a partida mais rápido faz isso no
 * playback, não na física.
 */

/** Aceleração de referência quando o agente não informa a própria, m/s². */
export const PLAYER_ACCEL_MS2 = 4.0;
/** Tempo de reação antes de mudar de direção, s. */
export const REACTION_TIME_S = 0.25;
/**
 * Suavidade da fronteira de controle, s. Um jogador que chega 0,5s antes não
 * controla o ponto com certeza absoluta — a diferença vira probabilidade.
 */
export const CONTROL_TAU_S = 0.45;

export interface ControlPlayer {
  id: string;
  side: 'home' | 'away';
  /** Metros: x = comprimento (0 gol casa → 105 gol visitante), z = largura. */
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Velocidade máxima em m/s de futebol — atributo Velocidade Máxima. */
  vmax: number;
  /** Aceleração em m/s² — atributo Aceleração. Ausente, cai na referência. */
  accel?: number;
  /**
   * 0–1: Antecipação. Quem antecipa bem já está saindo quando a jogada
   * acontece; quem não antecipa perde o tempo de reação inteiro. Entra como
   * encurtamento do tempo morto antes de mudar de direção.
   */
  anticipation01?: number;
}

/**
 * Tempo para o jogador alcançar (px, pz), em segundos.
 *
 * Modelo: durante `REACTION_TIME_S` ele segue no vetor atual; a partir daí
 * acelera na direção do alvo até `vmax`. Isso é o que faz o momento importar —
 * um zagueiro correndo para trás não "teleporta" para cobrir um lançamento.
 */
export function timeToReach(p: ControlPlayer, px: number, pz: number): number {
  // Antecipação encurta o tempo morto: de 0,25s (não lê a jogada) a 0,10s
  // (já está saindo antes de a bola sair do pé).
  const react = REACTION_TIME_S * (1 - 0.72 * Math.max(0, Math.min(1, p.anticipation01 ?? 0.5)));
  const accel = Math.max(1.5, p.accel ?? PLAYER_ACCEL_MS2);
  const projX = p.x + p.vx * react;
  const projZ = p.z + p.vz * react;
  const d = Math.hypot(px - projX, pz - projZ);
  if (d < 1e-6) return react;

  // Distância consumida enquanto acelera de 0 a vmax.
  const tAccel = p.vmax / accel;
  const dAccel = 0.5 * accel * tAccel * tAccel;
  if (d <= dAccel) return react + Math.sqrt((2 * d) / accel);
  return react + tAccel + (d - dAccel) / p.vmax;
}

/** Tempo de voo da bola até o ponto, em segundos. */
export function ballTimeTo(
  ball: { x: number; z: number },
  px: number,
  pz: number,
  ballSpeedMs: number,
): number {
  return Math.hypot(px - ball.x, pz - ball.z) / Math.max(1, ballSpeedMs);
}

export interface ControlAt {
  /** 0–1: fatia do controle do ponto que pertence ao lado da casa. */
  home: number;
  /** Id de quem chega primeiro, independente de lado. */
  firstId: string | null;
  /** Vantagem em segundos do primeiro sobre o primeiro do lado oposto. */
  marginSec: number;
}

/**
 * Controle do ponto (px, pz) supondo que a bola seja tocada para lá agora.
 *
 * Cada jogador contribui com uma sigmoide da sua folga em relação à chegada da
 * bola: quem chega bem antes contribui ~1, quem chega bem depois ~0. Somar as
 * contribuições (em vez de dar o ponto inteiro ao primeiro) é o que faz
 * superioridade numérica aparecer — dois marcadores em cima de um atacante
 * controlam mais espaço do que um.
 */
export function controlAt(
  players: readonly ControlPlayer[],
  ball: { x: number; z: number },
  px: number,
  pz: number,
  ballSpeedMs: number,
): ControlAt {
  const tBall = ballTimeTo(ball, px, pz, ballSpeedMs);
  let sumHome = 0;
  let sumAway = 0;
  let firstId: string | null = null;
  let firstT = Infinity;
  let bestHomeT = Infinity;
  let bestAwayT = Infinity;

  for (const p of players) {
    const t = timeToReach(p, px, pz);
    // Folga positiva = chega antes da bola.
    const slack = tBall - t;
    const w = 1 / (1 + Math.exp(-slack / CONTROL_TAU_S));
    if (p.side === 'home') {
      sumHome += w;
      if (t < bestHomeT) bestHomeT = t;
    } else {
      sumAway += w;
      if (t < bestAwayT) bestAwayT = t;
    }
    if (t < firstT) {
      firstT = t;
      firstId = p.id;
    }
  }

  const total = sumHome + sumAway;
  return {
    home: total > 1e-9 ? sumHome / total : 0.5,
    firstId,
    marginSec: Math.abs(bestHomeT - bestAwayT),
  };
}

/**
 * Um passe de `from` para `to` sobrevive?
 *
 * Amostra a linha do passe e devolve a menor probabilidade de o lado que passa
 * controlar cada ponto do caminho. Não basta o destino estar livre — o corredor
 * inteiro precisa estar.
 */
export function passSurvival(
  players: readonly ControlPlayer[],
  from: { x: number; z: number },
  to: { x: number; z: number },
  side: 'home' | 'away',
  ballSpeedMs: number,
  samples = 6,
): number {
  let worst = 1;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const px = from.x + (to.x - from.x) * t;
    const pz = from.z + (to.z - from.z) * t;
    // A bola parte de `from`, não da posição atual dela.
    const c = controlAt(players, from, px, pz, ballSpeedMs);
    const mine = side === 'home' ? c.home : 1 - c.home;
    if (mine < worst) worst = mine;
  }
  return worst;
}

/**
 * Pressão sobre um ponto: quão perto, em segundos, está o adversário mais
 * próximo. Menor = mais pressionado.
 */
export function pressureSec(
  players: readonly ControlPlayer[],
  side: 'home' | 'away',
  px: number,
  pz: number,
): number {
  let best = Infinity;
  for (const p of players) {
    if (p.side === side) continue;
    const t = timeToReach(p, px, pz);
    if (t < best) best = t;
  }
  return Number.isFinite(best) ? best : 99;
}

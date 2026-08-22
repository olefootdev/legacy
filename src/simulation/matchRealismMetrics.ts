/**
 * Régua de realismo do motor ao vivo.
 *
 * Mede se os 22 agentes jogam futebol de verdade — não se o código roda.
 * As medidas abaixo são o contrato do que "funcionar" significa; qualquer
 * mudança no TacticalSimLoop tem que passar por elas (`npm run test:match-realism`).
 *
 * Referência dos limiares: Football Manager / dados de rastreamento reais.
 *
 * ── Bloco de FORMA (as 7 originais) ───────────────────────────────────────────
 * Respondem: os onze se comportam como um time? acompanham a bola? disputam?
 *
 * ── Bloco de UNIDADE (as 5 novas) ─────────────────────────────────────────────
 * Respondem: as grandezas físicas batem com futebol? Foram acrescentadas depois
 * da auditoria de 2026-08-21, que achou a causa raiz das outras falhas: as
 * velocidades foram calibradas no olho, em unidades fictícias, e a bola ficou
 * ~10× lenta contra ~2,4× do jogador. Como o que governa a cara do futebol é a
 * RAZÃO entre os dois, ela inverteu — no motor a bola andava a 0,5× a velocidade
 * de um sprint, quando no futebol real ela anda a ~2,4×. Num mundo assim todo
 * passe é interceptável, o que produz enxame, que foi "corrigido" prendendo os
 * jogadores ao slot da formação — e é essa coleira que quebra as 7 originais.
 */
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import { FIELD_LENGTH, FIELD_WIDTH, simToFootballMs } from '@/tactical';

/** Limiar de proximidade que caracteriza disputa pela bola (metros). */
export const CONTEST_RADIUS_M = 5;

/** Abaixo disto a bola está parada/em posse — não conta para velocidade de voo. */
const BALL_MOVING_MIN_SIM = 1.0;

export interface MatchRealismReport {
  samples: number;
  /** Correlação entre X da bola e X do centro do bloco. O time acompanha o jogo? */
  ballBlockCorrelation: { home: number; away: number };
  /** % de frames com pelo menos um jogador de cada lado a CONTEST_RADIUS_M da bola. */
  contestPct: number;
  /** Distância da linha mais recuada à mais adiantada, sem goleiro (metros). */
  blockDepthM: { home: number; away: number };
  /** Distância da ponta esquerda à ponta direita do bloco, sem goleiro (metros). */
  blockWidthM: { home: number; away: number };
  /** Área do fecho convexo do bloco, sem goleiro (m²). Compactação real. */
  blockAreaM2: { home: number; away: number };
  /**
   * Distância média do adversário mais próximo até a bola (metros).
   * Mede PRESSÃO: a distância até a bola do lado que NÃO tem a posse.
   * Usar "jogador mais próximo" não serve — o portador está sempre em cima dela.
   */
  pressureDistM: number;
  /** % de frames com portador definido. O resto é bola solta. */
  carrierPct: number;
  /** Sprint observado no percentil 95, convertido para m/s de futebol. */
  sprintTopMs: number;
  /** Velocidade média da bola em movimento, em m/s de futebol. */
  ballFlightMs: number;
  /** ballFlightMs / sprintTopMs. No futebol real fica em torno de 2,4. */
  ballPlayerRatio: number;
}

/** Limiares mínimos aceitáveis. Falhar aqui = regressão de jogabilidade. */
export const REALISM_THRESHOLDS = {
  ballBlockCorrelationMin: 0.6,
  contestPctMin: 30,
  blockDepthMaxM: 45,
  pressureDistMaxM: 12,
  carrierPctMin: 70,
  /** Bloco largo demais = sem compactação lateral. O campo tem 68m. */
  blockWidthMaxM: 48,
  /** Rastreamento real chama "alta compactação" abaixo de 600m². 1600 é o teto do tolerável. */
  blockAreaMaxM2: 1600,
  /** Jogador rápido tem que sprintar como gente: piso de 6,5 m/s de futebol. */
  sprintTopMinMs: 6.5,
  /** Passe médio de futebol fica em 15–25 m/s. Piso de 12. */
  ballFlightMinMs: 12,
  /** A bola tem que ser mais rápida que o jogador. Real ≈ 2,4. */
  ballPlayerRatioMin: 1.8,
} as const;

interface SideAcc {
  ballX: number[];
  centroidX: number[];
  depthSum: number;
  widthSum: number;
  areaSum: number;
}

function newSideAcc(): SideAcc {
  return { ballX: [], centroidX: [], depthSum: 0, widthSum: 0, areaSum: 0 };
}

/** Correlação de Pearson. Retorna 0 quando não há variação (evita NaN no relatório). */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i]!;
    mb += b[i]!;
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da <= 1e-9 || db <= 1e-9) return 0;
  return num / Math.sqrt(da * db);
}

/** Percentil de um vetor não ordenado. `p` em 0–1. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx]!;
}

type Pt = { x: number; z: number };

/**
 * Área do fecho convexo (cadeia monótona de Andrew + fórmula do laço).
 * É a medida honesta de "quanto chão o bloco cobre" — o retângulo delimitador
 * infla a área sempre que um lateral abre, e é justamente aí que a compactação
 * precisa ser medida.
 */
function convexHullArea(points: Pt[]): number {
  if (points.length < 3) return 0;
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 3) return 0;

  let area2 = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    area2 += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area2) / 2;
}

/**
 * Acumula amostras de uma partida e devolve o relatório.
 * Alimente só com frames de jogo rolando — parada de bola distorce as medidas.
 */
export class MatchRealismSampler {
  private readonly home = newSideAcc();
  private readonly away = newSideAcc();
  private samples = 0;
  private contestFrames = 0;
  private carrierFrames = 0;
  private pressureSum = 0;
  private pressureFrames = 0;
  /** Velocidades de jogador observadas, em unidades de simulação. */
  private readonly playerSpeeds: number[] = [];
  private ballSpeedSum = 0;
  private ballSpeedFrames = 0;

  add(snap: MatchTruthSnapshot, carrierId: string | null | undefined): void {
    const ball = snap.ball;
    if (!Number.isFinite(ball.x) || !Number.isFinite(ball.z)) return;

    const players = snap.players.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
    if (players.length < 4) return;

    this.samples += 1;
    if (carrierId) this.carrierFrames += 1;

    // ── Velocidade da bola em voo ────────────────────────────────────────────
    if (Number.isFinite(ball.vx) && Number.isFinite(ball.vz)) {
      const bs = Math.hypot(ball.vx as number, ball.vz as number);
      if (bs >= BALL_MOVING_MIN_SIM) {
        this.ballSpeedSum += bs;
        this.ballSpeedFrames += 1;
      }
    }

    /** Lado que tem a bola — para medir a pressão do lado oposto. */
    const carrierSide = carrierId
      ? players.find((p) => p.id === carrierId)?.side ?? null
      : null;

    let nearestOpponent = Infinity;
    let homeNear = false;
    let awayNear = false;
    for (const p of players) {
      if (Number.isFinite(p.speed) && (p.speed as number) > 0) {
        this.playerSpeeds.push(p.speed as number);
      }
      const d = Math.hypot(p.x - ball.x, p.z - ball.z);
      if (carrierSide && p.side !== carrierSide && d < nearestOpponent) nearestOpponent = d;
      if (d <= CONTEST_RADIUS_M) {
        if (p.side === 'home') homeNear = true;
        else awayNear = true;
      }
    }
    if (Number.isFinite(nearestOpponent)) {
      this.pressureSum += nearestOpponent;
      this.pressureFrames += 1;
    }
    if (homeNear && awayNear) this.contestFrames += 1;

    for (const side of ['home', 'away'] as const) {
      const acc = side === 'home' ? this.home : this.away;
      const outfield = players.filter((p) => p.side === side && p.role !== 'gk' && !p.id.endsWith('gol'));
      if (outfield.length < 6) continue;
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      let zMin = Infinity;
      let zMax = -Infinity;
      for (const p of outfield) {
        sum += p.x;
        if (p.x < min) min = p.x;
        if (p.x > max) max = p.x;
        if (p.z < zMin) zMin = p.z;
        if (p.z > zMax) zMax = p.z;
      }
      acc.ballX.push(ball.x);
      acc.centroidX.push(sum / outfield.length);
      acc.depthSum += max - min;
      acc.widthSum += zMax - zMin;
      acc.areaSum += convexHullArea(outfield.map((p) => ({ x: p.x, z: p.z })));
    }
  }

  report(): MatchRealismReport {
    const n = Math.max(1, this.samples);
    const perSide = <T>(pick: (acc: SideAcc) => T) => ({
      home: pick(this.home),
      away: pick(this.away),
    });
    const avgOf = (acc: SideAcc, sum: number, fallback: number) =>
      acc.centroidX.length > 0 ? sum / acc.centroidX.length : fallback;

    const sprintTopMs = simToFootballMs(percentile(this.playerSpeeds, 0.95));
    const ballFlightMs =
      this.ballSpeedFrames > 0 ? simToFootballMs(this.ballSpeedSum / this.ballSpeedFrames) : 0;

    return {
      samples: this.samples,
      ballBlockCorrelation: {
        home: pearson(this.home.ballX, this.home.centroidX),
        away: pearson(this.away.ballX, this.away.centroidX),
      },
      contestPct: (this.contestFrames / n) * 100,
      blockDepthM: perSide((a) => avgOf(a, a.depthSum, FIELD_LENGTH)),
      blockWidthM: perSide((a) => avgOf(a, a.widthSum, FIELD_WIDTH)),
      blockAreaM2: perSide((a) => avgOf(a, a.areaSum, FIELD_LENGTH * FIELD_WIDTH)),
      pressureDistM: this.pressureFrames > 0 ? this.pressureSum / this.pressureFrames : FIELD_LENGTH,
      carrierPct: (this.carrierFrames / n) * 100,
      sprintTopMs,
      ballFlightMs,
      ballPlayerRatio: sprintTopMs > 0.01 ? ballFlightMs / sprintTopMs : 0,
    };
  }
}

export interface RealismCheck {
  label: string;
  value: number;
  limit: number;
  ok: boolean;
  /** 'min' = quanto maior melhor; 'max' = quanto menor melhor. */
  dir: 'min' | 'max';
  /** 'forma' = os onze jogam como time; 'unidade' = as grandezas batem com futebol. */
  group: 'forma' | 'unidade';
}

/** Confronta um relatório com os limiares. */
export function checkRealism(r: MatchRealismReport): RealismCheck[] {
  const T = REALISM_THRESHOLDS;
  const min = (group: RealismCheck['group']) =>
    (label: string, value: number, limit: number): RealismCheck => ({
      label, value, limit, dir: 'min', ok: value >= limit, group,
    });
  const max = (group: RealismCheck['group']) =>
    (label: string, value: number, limit: number): RealismCheck => ({
      label, value, limit, dir: 'max', ok: value <= limit, group,
    });
  const minF = min('forma');
  const maxF = max('forma');
  const minU = min('unidade');

  /** Largura e área: cobra o pior dos dois lados — um time certo não compensa o outro. */
  const worstWidth = Math.max(r.blockWidthM.home, r.blockWidthM.away);
  const worstArea = Math.max(r.blockAreaM2.home, r.blockAreaM2.away);

  return [
    minF('correlação bola↔bloco (casa)', r.ballBlockCorrelation.home, T.ballBlockCorrelationMin),
    minF('correlação bola↔bloco (fora)', r.ballBlockCorrelation.away, T.ballBlockCorrelationMin),
    minF('disputa pela bola %', r.contestPct, T.contestPctMin),
    maxF('profundidade do bloco casa (m)', r.blockDepthM.home, T.blockDepthMaxM),
    maxF('profundidade do bloco fora (m)', r.blockDepthM.away, T.blockDepthMaxM),
    maxF('pressão: adversário + próximo (m)', r.pressureDistM, T.pressureDistMaxM),
    minF('frames com portador %', r.carrierPct, T.carrierPctMin),
    // ── unidade ──────────────────────────────────────────────────────────────
    maxF('largura do bloco, pior lado (m)', worstWidth, T.blockWidthMaxM),
    maxF('área do bloco, pior lado (m²)', worstArea, T.blockAreaMaxM2),
    minU('sprint observado (m/s futebol)', r.sprintTopMs, T.sprintTopMinMs),
    minU('bola em voo (m/s futebol)', r.ballFlightMs, T.ballFlightMinMs),
    minU('razão bola/jogador', r.ballPlayerRatio, T.ballPlayerRatioMin),
  ];
}

/** Relatório legível para o terminal. */
export function formatRealism(checks: RealismCheck[]): string {
  const line = (c: RealismCheck) => {
    const mark = c.ok ? '✓' : '✗';
    const cmp = c.dir === 'min' ? '>=' : '<=';
    return `  ${mark} ${c.label.padEnd(34)} ${c.value.toFixed(2).padStart(8)}  (${cmp} ${c.limit})`;
  };
  const forma = checks.filter((c) => c.group === 'forma');
  const unidade = checks.filter((c) => c.group === 'unidade');
  return [
    '  ── forma: os onze jogam como time? ──',
    ...forma.map(line),
    '  ── unidade: as grandezas batem com futebol? ──',
    ...unidade.map(line),
  ].join('\n');
}

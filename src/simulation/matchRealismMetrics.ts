/**
 * Régua de realismo do motor ao vivo.
 *
 * Mede se os 22 agentes jogam futebol de verdade — não se o código roda.
 * As cinco medidas abaixo são o contrato do que "funcionar" significa; qualquer
 * mudança no TacticalSimLoop tem que passar por elas (`npm run test:match-realism`).
 *
 * Referência dos limiares: Football Manager / dados de rastreamento reais.
 */
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import { FIELD_LENGTH } from '@/tactical';

/** Limiar de proximidade que caracteriza disputa pela bola (metros). */
export const CONTEST_RADIUS_M = 5;

export interface MatchRealismReport {
  samples: number;
  /** Correlação entre X da bola e X do centro do bloco. O time acompanha o jogo? */
  ballBlockCorrelation: { home: number; away: number };
  /** % de frames com pelo menos um jogador de cada lado a CONTEST_RADIUS_M da bola. */
  contestPct: number;
  /** Distância da linha mais recuada à mais adiantada, sem goleiro (metros). */
  blockDepthM: { home: number; away: number };
  /**
   * Distância média do adversário mais próximo até a bola (metros).
   * Mede PRESSÃO: a distância até a bola do lado que NÃO tem a posse.
   * Usar "jogador mais próximo" não serve — o portador está sempre em cima dela.
   */
  pressureDistM: number;
  /** % de frames com portador definido. O resto é bola solta. */
  carrierPct: number;
}

/** Limiares mínimos aceitáveis. Falhar aqui = regressão de jogabilidade. */
export const REALISM_THRESHOLDS = {
  ballBlockCorrelationMin: 0.6,
  contestPctMin: 30,
  blockDepthMaxM: 45,
  pressureDistMaxM: 12,
  carrierPctMin: 70,
} as const;

interface SideAcc {
  ballX: number[];
  centroidX: number[];
  depthSum: number;
}

function newSideAcc(): SideAcc {
  return { ballX: [], centroidX: [], depthSum: 0 };
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

  add(snap: MatchTruthSnapshot, carrierId: string | null | undefined): void {
    const ball = snap.ball;
    if (!Number.isFinite(ball.x) || !Number.isFinite(ball.z)) return;

    const players = snap.players.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
    if (players.length < 4) return;

    this.samples += 1;
    if (carrierId) this.carrierFrames += 1;

    /** Lado que tem a bola — para medir a pressão do lado oposto. */
    const carrierSide = carrierId
      ? players.find((p) => p.id === carrierId)?.side ?? null
      : null;

    let nearestOpponent = Infinity;
    let homeNear = false;
    let awayNear = false;
    for (const p of players) {
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
      for (const p of outfield) {
        sum += p.x;
        if (p.x < min) min = p.x;
        if (p.x > max) max = p.x;
      }
      acc.ballX.push(ball.x);
      acc.centroidX.push(sum / outfield.length);
      acc.depthSum += max - min;
    }
  }

  report(): MatchRealismReport {
    const n = Math.max(1, this.samples);
    return {
      samples: this.samples,
      ballBlockCorrelation: {
        home: pearson(this.home.ballX, this.home.centroidX),
        away: pearson(this.away.ballX, this.away.centroidX),
      },
      contestPct: (this.contestFrames / n) * 100,
      blockDepthM: {
        home: this.home.centroidX.length > 0 ? this.home.depthSum / this.home.centroidX.length : FIELD_LENGTH,
        away: this.away.centroidX.length > 0 ? this.away.depthSum / this.away.centroidX.length : FIELD_LENGTH,
      },
      pressureDistM: this.pressureFrames > 0 ? this.pressureSum / this.pressureFrames : FIELD_LENGTH,
      carrierPct: (this.carrierFrames / n) * 100,
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
}

/** Confronta um relatório com os limiares. */
export function checkRealism(r: MatchRealismReport): RealismCheck[] {
  const T = REALISM_THRESHOLDS;
  const min = (label: string, value: number, limit: number): RealismCheck => ({
    label, value, limit, dir: 'min', ok: value >= limit,
  });
  const max = (label: string, value: number, limit: number): RealismCheck => ({
    label, value, limit, dir: 'max', ok: value <= limit,
  });
  return [
    min('correlação bola↔bloco (casa)', r.ballBlockCorrelation.home, T.ballBlockCorrelationMin),
    min('correlação bola↔bloco (fora)', r.ballBlockCorrelation.away, T.ballBlockCorrelationMin),
    min('disputa pela bola %', r.contestPct, T.contestPctMin),
    max('profundidade do bloco casa (m)', r.blockDepthM.home, T.blockDepthMaxM),
    max('profundidade do bloco fora (m)', r.blockDepthM.away, T.blockDepthMaxM),
    max('pressão: adversário + próximo (m)', r.pressureDistM, T.pressureDistMaxM),
    min('frames com portador %', r.carrierPct, T.carrierPctMin),
  ];
}

/** Relatório legível para o terminal. */
export function formatRealism(checks: RealismCheck[]): string {
  return checks
    .map((c) => {
      const mark = c.ok ? '✓' : '✗';
      const cmp = c.dir === 'min' ? '>=' : '<=';
      return `  ${mark} ${c.label.padEnd(34)} ${c.value.toFixed(2).padStart(7)}  (${cmp} ${c.limit})`;
    })
    .join('\n');
}

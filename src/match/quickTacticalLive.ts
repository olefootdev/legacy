/**
 * quickTacticalLive — estilo de jogo AO VIVO com consequência real.
 *
 * Pedido do produto: "ativar o estilo errado aumenta a chance de PERDER; ativar
 * o estilo com inteligência aumenta a chance de fazer GOL." Este módulo é a
 * varredura que faz isso funcionar, 100% PURO e DETERMINÍSTICO (SpiritRng
 * seedado por plan.seed + índice do evento + estilo) — espelha o padrão do
 * quickBeatDirector, mas dirigido pelo ESTILO ativo e pelo CONTEXTO do jogo.
 *
 * Como funciona:
 *   1. `idealStyle(state)` lê placar+minuto+momento e diz qual estilo o momento
 *      pede (ex.: perdendo no fim → Ataque; ganhando no fim → Retranca).
 *   2. `styleFit(chosen, state)` mede quão perto o estilo escolhido está do ideal
 *      (eixo defesa↔ataque): +1 perfeito … -1 oposto.
 *   3. `resolveStyleOnEvent` é chamado quando CADA evento é revelado: fit alto
 *      converte quase-gol da casa em GOL e blinda ameaça do adversário; fit
 *      negativo derruba gol da casa e transforma quase-gol deles em GOL.
 *
 * Decidir no momento da revelação (não mutando o array todo) evita dupla
 * contagem e recompensa MANTER o estilo certo ao longo do jogo.
 */

import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import { hashSeed } from './quickBeatDirector';
import type { MatchPlanEvent } from './quickPlanTypes';
import type { TacticalIntensityLevel } from './quickTacticalIntensity';

export interface LiveMatchState {
  /** homeScore - awayScore (>0 ganhando). */
  scoreDiff: number;
  minute: number;
  /** Momento 0-100 na perspectiva da casa (50 = equilíbrio). */
  momentum: number;
}

/** Eixo defesa(0) ↔ ataque(4) — distância nele mede o "erro" da escolha. */
const AXIS: Record<TacticalIntensityLevel, number> = {
  defend: 0, counter: 1, possession: 2, press: 3, attack: 4,
};

export const STYLE_LABEL: Record<TacticalIntensityLevel, string> = {
  defend: 'Retranca', counter: 'Contra-ataque', possession: 'Posse', press: 'Pressão', attack: 'Ataque',
};

/**
 * O estilo que o MOMENTO pede. É a "resposta certa" que o manager inteligente lê.
 *  • perdendo: pressão (cedo) / ataque total (fim)
 *  • ganhando: posse (controlar) / contra (se dominado) / retranca (fim ou +2)
 *  • empatado: ataque/pressão se dominando, contra se sufocado, posse/pressão no resto
 */
export function idealStyle(s: LiveMatchState): TacticalIntensityLevel {
  const { scoreDiff, minute, momentum } = s;
  if (scoreDiff < 0) return minute >= 70 ? 'attack' : 'press';
  if (scoreDiff > 0) {
    if (scoreDiff >= 2 || minute >= 78) return 'defend';
    return momentum <= 42 ? 'counter' : 'possession';
  }
  if (momentum >= 62) return minute >= 70 ? 'attack' : 'press';
  if (momentum <= 38) return 'counter';
  return minute >= 76 ? 'press' : 'possession';
}

const FIT_BY_DIST = [1, 0.45, 0, -0.5, -1];

/** Quão acertada é a escolha: +1 (no ponto) … 0 (ok) … -1 (oposto do ideal). */
export function styleFit(chosen: TacticalIntensityLevel, s: LiveMatchState): number {
  const dist = Math.abs(AXIS[chosen] - AXIS[idealStyle(s)]);
  return FIT_BY_DIST[Math.min(4, dist)] ?? 0;
}

/** Viés territorial do estilo — empurra a barra de momento na hora da troca. */
export function styleMomentumBias(style: TacticalIntensityLevel): number {
  return ({ defend: -11, counter: -4, possession: 4, press: 10, attack: 15 } as const)[style] ?? 0;
}

/** Acende a curva de momento a partir do minuto da troca (efeito decai ~18'). */
export function nudgeMomentumCurve(curve: number[], fromMinute: number, bias: number): number[] {
  if (!bias) return curve;
  const out = curve.slice();
  const target = Math.max(8, Math.min(92, 50 + bias));
  for (let i = Math.max(0, Math.floor(fromMinute)); i < out.length; i += 1) {
    const decay = 1 - (i - fromMinute) / 18;
    if (decay <= 0) break;
    out[i] = Math.max(5, Math.min(95, (out[i] ?? 50) + (target - (out[i] ?? 50)) * 0.35 * decay));
  }
  return out;
}

const NEAR_MISS_HOME = new Set<MatchPlanEvent['kind']>(['shot_home', 'chance_home', 'save_home', 'woodwork_home']);
const NEAR_MISS_AWAY = new Set<MatchPlanEvent['kind']>(['shot_away', 'chance_away', 'save_away', 'woodwork_away']);
const THREAT_AWAY = new Set<MatchPlanEvent['kind']>(['goal_away', 'chance_away', 'save_away', 'woodwork_away']);

function upHomeGoal(e: MatchPlanEvent, label: string): MatchPlanEvent {
  return { ...e, kind: 'goal_home', weight_tier: 'epic',
    text: `${e.minute}' — GOOOL! ${label} na hora certa rasgou a defesa — bola na rede!`,
    reason: `${label} foi a leitura certa do momento`, decision_influenced: true };
}
function shieldAway(e: MatchPlanEvent, label: string): MatchPlanEvent {
  return { ...e, kind: 'shot_away', weight_tier: 'big',
    text: `${e.minute}' — Travou! ${label} no tempo certo matou o perigo deles.`,
    reason: `${label} segurou o jogo`, decision_influenced: true };
}
function downHomeGoal(e: MatchPlanEvent, label: string): MatchPlanEvent {
  return { ...e, kind: 'shot_home', weight_tier: 'normal',
    text: `${e.minute}' — Faltou ler o jogo: ${label} fora de hora e a finalização morre na marcação.`,
    reason: `${label} era o estilo errado pro momento`, decision_influenced: true };
}
function upAwayGoal(e: MatchPlanEvent, label: string): MatchPlanEvent {
  return { ...e, kind: 'goal_away', weight_tier: 'big',
    text: `${e.minute}' — Deu ruim: ${label} na hora errada abriu o espaço e o adversário não perdoou.`,
    reason: `${label} fora de hora cobrou o preço`, decision_influenced: true };
}

/**
 * LEGACY ATIVO: enquanto a janela do buff está aberta, as lendas em campo
 * PUXAM o time — quase-gol da casa tem chance extra de virar gol. `totalPct` é a
 * soma dos boosters das lendas ativas (quanto mais lenda, mais forte). Pode
 * compor com o estilo (são efeitos independentes). Determinístico por índice.
 */
export function resolveLegacyBoost(opts: {
  event: MatchPlanEvent;
  totalPct: number;
  seed: string;
  index: number;
  legendName: string;
}): MatchPlanEvent | null {
  const e = opts.event;
  if (!NEAR_MISS_HOME.has(e.kind)) return null;
  const rng = new SpiritRng(hashSeed(`${opts.seed}:legacy:${opts.index}`));
  const p = Math.min(0.45, (e.xg ?? 0.12) * 1.5 + opts.totalPct * 0.03);
  if (rng.next() < p) {
    return { ...e, kind: 'goal_home', weight_tier: 'epic',
      text: `${e.minute}' — GOOOL! O Legacy de ${opts.legendName} puxou o time — bola na rede!`,
      reason: `a lenda ${opts.legendName} decidiu`, decision_influenced: true };
  }
  return null;
}

/** Índice ofensivo da formação (-1 fechada … +1 aberta). Vira efeito REAL no jogo. */
export const FORMATION_OFFENSE: Record<string, number> = {
  '5-3-2': -1, '3-5-2': -0.3, '4-4-2': 0, '4-2-3-1': 0.25, '4-3-3': 0.5, '3-4-3': 1,
};

/**
 * FORMAÇÃO com consequência: a forma do time muda o jogo de VERDADE (não só o
 * momento). Ofensiva (3-4-3) cria mais gol da casa MAS expõe a defesa no contra;
 * defensiva (5-3-2) blinda a ameaça do adversário. Determinístico por índice.
 */
export function resolveFormationOnEvent(opts: {
  event: MatchPlanEvent;
  formation: string;
  seed: string;
  index: number;
}): MatchPlanEvent | null {
  const off = FORMATION_OFFENSE[opts.formation] ?? 0;
  if (Math.abs(off) < 0.1) return null;
  const e = opts.event;
  const rng = new SpiritRng(hashSeed(`${opts.seed}:formation:${opts.index}:${opts.formation}`));
  if (off > 0) {
    if (NEAR_MISS_HOME.has(e.kind) && rng.next() < off * 0.1) {
      return { ...e, kind: 'goal_home', weight_tier: 'big',
        text: `${e.minute}' — GOOOL! A formação ofensiva criou o espaço e o time não perdoou!`,
        reason: 'a formação aberta gerou a chance', decision_influenced: true };
    }
    if (NEAR_MISS_AWAY.has(e.kind) && rng.next() < off * 0.07) {
      return { ...e, kind: 'goal_away', weight_tier: 'big',
        text: `${e.minute}' — A formação aberta deixou espaço atrás e o adversário aproveitou.`,
        reason: 'o time exposto pagou o preço', decision_influenced: true };
    }
  } else if (THREAT_AWAY.has(e.kind) && rng.next() < Math.abs(off) * 0.16) {
    return { ...e, kind: 'shot_away', weight_tier: 'big',
      text: `${e.minute}' — A formação fechada engoliu o ataque deles. Sólido atrás.`,
      reason: 'a formação defensiva segurou', decision_influenced: true };
  }
  return null;
}

export type StyleFlip = 'home_goal' | 'shield' | 'home_miss' | 'away_goal' | null;

export interface StyleResolveResult { event: MatchPlanEvent; flip: StyleFlip; fit: number; }

/**
 * Aplica o estilo ativo a UM evento no instante em que ele é revelado.
 * fit > 0 (escolha inteligente): converte quase-gol da casa / blinda ameaça.
 * fit < 0 (escolha errada): derruba gol da casa / vira quase-gol deles em gol.
 * |fit| ≤ 0.15 (escolha neutra): nada acontece.
 */
export function resolveStyleOnEvent(opts: {
  event: MatchPlanEvent;
  chosen: TacticalIntensityLevel;
  state: LiveMatchState;
  seed: string;
  index: number;
}): StyleResolveResult {
  const { event: e, chosen, state, seed, index } = opts;
  const fit = styleFit(chosen, state);
  if (Math.abs(fit) <= 0.15) return { event: e, flip: null, fit };
  const rng = new SpiritRng(hashSeed(`${seed}:livestyle:${index}:${chosen}`));
  const label = STYLE_LABEL[chosen];

  if (fit > 0) {
    if (NEAR_MISS_HOME.has(e.kind)) {
      const p = Math.min(0.5, fit * (0.16 + (e.xg ?? 0.12) * 2));
      if (rng.next() < p) return { event: upHomeGoal(e, label), flip: 'home_goal', fit };
    } else if (THREAT_AWAY.has(e.kind)) {
      const p = e.kind === 'goal_away' ? fit * 0.16 : fit * 0.32;
      if (rng.next() < p) return { event: shieldAway(e, label), flip: 'shield', fit };
    }
  } else {
    const f = Math.abs(fit);
    if (e.kind === 'goal_home') {
      if (rng.next() < f * 0.3) return { event: downHomeGoal(e, label), flip: 'home_miss', fit };
    } else if (NEAR_MISS_AWAY.has(e.kind)) {
      const p = Math.min(0.4, f * (0.12 + (e.xg ?? 0.1) * 1.5));
      if (rng.next() < p) return { event: upAwayGoal(e, label), flip: 'away_goal', fit };
    }
  }
  return { event: e, flip: null, fit };
}

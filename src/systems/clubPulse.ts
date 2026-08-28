/**
 * clubPulse.ts — CLUB PULSE: o estado vivo do clube em UM número (0–100).
 *
 * O OLEFOOT já roda seis sistemas que medem "como o clube está": torcida,
 * forma, moral do plantel, engajamento do manager, consequências persistentes
 * e a pontuação do dia. Todos são REAIS e todos eram INVISÍVEIS — cada um
 * escondido numa página diferente. O Pulse é a leitura de 1 segundo que junta
 * os seis no topo da Home.
 *
 * NÃO é um score de habilidade (isso é o managerScore) nem de fama (renown).
 * É um termômetro de MOMENTO: sobe com vitória e torcida, cai com lesão,
 * cartão e abandono.
 *
 * PURO e determinístico — sem Date/Math.random. Sem estado novo no store, sem
 * migration: só lê o que o reducer já persiste.
 */

import type { FormLetter } from '@/entities/types';
import type { ConsequenceDimension } from '@/systems/impactCatalog';

/** Recorte mínimo de uma consequência ativa — evita acoplar ao tipo completo. */
export interface PulseConsequence {
  dimension: ConsequenceDimension;
  /** Valor efetivo AGORA (pós-decay). Negativo = penalidade. */
  currentValue: number;
}

export interface ClubPulseInput {
  /** `state.crowd.supportPercent` (0–100). */
  crowdSupportPercent: number;
  /** `state.form` — mais recente por ÚLTIMO (mesma convenção da Home). */
  form: FormLetter[];
  /** Moral (0–100) de cada jogador do plantel — `state.playerMoral[*].moral`. */
  squadMoral: number[];
  /** `computeEngagementScore()` (0–100). */
  engagementScore: number;
  /** Consequências ativas do clube (já avaliadas pós-decay). */
  consequences: PulseConsequence[];
  /** `state.managerScore.today` — atividade de hoje. */
  managerScoreToday: number;
}

export type PulseBand = 'fire' | 'high' | 'steady' | 'low' | 'crisis';
export type PulseTrend = 'up' | 'flat' | 'down';

export interface ClubPulseDriver {
  /** Nome do sistema em pt-BR — ex.: "Torcida". */
  label: string;
  /** Leitura curta do estado — ex.: "cantando". */
  detail: string;
  direction: PulseTrend;
}

export interface ClubPulse {
  /** 0–100. */
  value: number;
  band: PulseBand;
  /** Rótulo editorial do band — ex.: "EM CHAMAS". */
  label: string;
  trend: PulseTrend;
  /** As 3 forças que mais explicam o número agora (maior desvio primeiro). */
  drivers: ClubPulseDriver[];
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Peso de cada componente. Soma = 1. Torcida e forma mandam — é o que o
 *  jogador SENTE; engajamento entra por último porque é utilitário. */
const WEIGHTS = {
  crowd: 0.28,
  form: 0.28,
  moral: 0.24,
  engagement: 0.20,
} as const;

/** Teto do ajuste por consequências ativas. Punição pesa mais que bônus —
 *  cartão vermelho e lesão precisam doer mais do que MVP afaga. */
const CONSEQUENCE_FLOOR = -18;
const CONSEQUENCE_CEIL = 8;

/** Pontos de bônus por atividade de hoje (satura rápido: presença conta,
 *  moer o jogo o dia inteiro não infla o termômetro). */
const ACTIVITY_MAX = 4;

const FORM_POINTS: Record<FormLetter, number> = { W: 100, D: 50, L: 0 };

/** Desvio mínimo do neutro pra um componente virar "driver" exibível. */
const MIN_DRIVER_DEVIATION = 6;

/**
 * Forma dos últimos 5, com peso crescente pro mais recente (5,4,3,2,1).
 * Sem histórico devolve 50 (neutro) — clube novo não nasce em crise.
 */
export function formScore(form: readonly FormLetter[]): number {
  const last = form.slice(-5);
  if (last.length === 0) return 50;
  let sum = 0;
  let weightSum = 0;
  last.forEach((letter, i) => {
    // `i` cresce com a recência (o último elemento é o jogo mais recente).
    const w = i + 1;
    sum += FORM_POINTS[letter] * w;
    weightSum += w;
  });
  return sum / weightSum;
}

/** Média de moral do plantel. Plantel vazio devolve 50 (neutro). */
export function squadMoralScore(squadMoral: readonly number[]): number {
  if (squadMoral.length === 0) return 50;
  const sum = squadMoral.reduce((a, b) => a + clamp(b), 0);
  return sum / squadMoral.length;
}

/**
 * Ajuste líquido das consequências ativas, em pontos de Pulse.
 *
 * `currentValue` vem em escalas diferentes por dimensão (moral em pontos,
 * mercado em %), então normalizamos por dimensão antes de somar — senão uma
 * consequência financeira grande afogaria três lesões.
 */
export function consequenceAdjustment(consequences: readonly PulseConsequence[]): number {
  if (consequences.length === 0) return 0;
  const SCALE: Record<ConsequenceDimension, number> = {
    physical: 0.35,
    psychological: 0.30,
    reputational: 0.15,
    financial: 0.10,
  };
  let net = 0;
  for (const c of consequences) {
    if (!Number.isFinite(c.currentValue)) continue;
    net += c.currentValue * (SCALE[c.dimension] ?? 0.1);
  }
  return Math.max(CONSEQUENCE_FLOOR, Math.min(CONSEQUENCE_CEIL, net));
}

function bandOf(value: number): { band: PulseBand; label: string } {
  if (value >= 82) return { band: 'fire', label: 'Em chamas' };
  if (value >= 65) return { band: 'high', label: 'Embalado' };
  if (value >= 45) return { band: 'steady', label: 'Estável' };
  if (value >= 28) return { band: 'low', label: 'Abalado' };
  return { band: 'crisis', label: 'Em crise' };
}

/**
 * Tendência lida da forma: os 2 jogos mais recentes contra os 3 anteriores.
 * Menos de 3 jogos → a atividade de hoje decide (jogou = subindo).
 */
export function pulseTrend(form: readonly FormLetter[], managerScoreToday: number): PulseTrend {
  const last = form.slice(-5);
  if (last.length < 3) return managerScoreToday > 0 ? 'up' : 'flat';
  const recent = last.slice(-2);
  const older = last.slice(0, -2);
  const avg = (xs: readonly FormLetter[]) =>
    xs.reduce((a, l) => a + FORM_POINTS[l], 0) / xs.length;
  const delta = avg(recent) - avg(older);
  if (delta >= 12) return 'up';
  if (delta <= -12) return 'down';
  return 'flat';
}

function directionOf(score: number): PulseTrend {
  if (score >= 62) return 'up';
  if (score <= 38) return 'down';
  return 'flat';
}

function crowdDetail(v: number): string {
  if (v >= 75) return 'cantando';
  if (v >= 58) return 'do lado';
  if (v >= 42) return 'morna';
  if (v >= 28) return 'desconfiada';
  return 'hostil';
}

function formDetail(form: readonly FormLetter[]): string {
  const last = form.slice(-5);
  if (last.length === 0) return 'sem histórico';
  const w = last.filter((l) => l === 'W').length;
  const l = last.filter((x) => x === 'L').length;
  if (w === last.length) return `${w} vitórias seguidas`;
  if (l === last.length) return `${l} derrotas seguidas`;
  return `${w}V em ${last.length}`;
}

function moralDetail(v: number): string {
  if (v >= 70) return 'plantel empolgado';
  if (v >= 55) return 'plantel confiante';
  if (v >= 40) return 'plantel morno';
  return 'plantel abatido';
}

function engagementDetail(v: number): string {
  if (v >= 70) return 'clube no comando';
  if (v >= 45) return 'presença regular';
  return 'clube sem comando';
}

/**
 * Calcula o Pulse. Tolerante a estado incompleto: clube recém-criado
 * (sem forma, sem moral, sem consequência) cai perto de 50, não em zero.
 */
export function computeClubPulse(input: ClubPulseInput): ClubPulse {
  const crowd = clamp(input.crowdSupportPercent);
  const form = formScore(input.form);
  const moral = squadMoralScore(input.squadMoral);
  const engagement = clamp(input.engagementScore);

  const base =
    crowd * WEIGHTS.crowd +
    form * WEIGHTS.form +
    moral * WEIGHTS.moral +
    engagement * WEIGHTS.engagement;

  const consequences = consequenceAdjustment(input.consequences);
  // Atividade de hoje: satura em ACTIVITY_MAX (25 pts de managerScore ≈ topo).
  const activity = Math.min(ACTIVITY_MAX, Math.max(0, input.managerScoreToday) / 25 * ACTIVITY_MAX);

  const value = Math.round(clamp(base + consequences + activity));
  const { band, label } = bandOf(value);

  // Drivers: os componentes que MAIS se afastam do neutro explicam o número.
  const candidates: Array<ClubPulseDriver & { deviation: number }> = [
    { label: 'Torcida', detail: crowdDetail(crowd), direction: directionOf(crowd), deviation: Math.abs(crowd - 50) },
    { label: 'Forma', detail: formDetail(input.form), direction: directionOf(form), deviation: Math.abs(form - 50) },
    { label: 'Moral', detail: moralDetail(moral), direction: directionOf(moral), deviation: Math.abs(moral - 50) },
    { label: 'Comando', detail: engagementDetail(engagement), direction: directionOf(engagement), deviation: Math.abs(engagement - 50) },
  ];
  if (consequences <= -3) {
    candidates.push({
      label: 'Baixas',
      detail: `${input.consequences.length} consequência${input.consequences.length === 1 ? '' : 's'} ativa${input.consequences.length === 1 ? '' : 's'}`,
      direction: 'down',
      deviation: Math.abs(consequences) * 3,
    });
  }

  // Só é "driver" o que tem sinal de verdade. Clube recém-criado tem tudo no
  // neutro — nesse caso a lista sai vazia e o hero simplesmente não mostra
  // chips, em vez de inventar explicação pra um número que não se moveu.
  const drivers = candidates
    .filter((c) => c.deviation >= MIN_DRIVER_DEVIATION)
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 3)
    .map(({ label: l, detail, direction }) => ({ label: l, detail, direction }));

  return {
    value,
    band,
    label,
    trend: pulseTrend(input.form, input.managerScoreToday),
    drivers,
  };
}

/**
 * A seta de tendência deve aparecer?
 *
 * NÃO na crise. A tendência lê os 2 jogos mais recentes contra os 3 anteriores,
 * então um clube que perdeu tudo e empatou o último sai com seta PRA CIMA — a
 * conta está certa, mas "Em crise ↑" se contradiz na tela e mina a confiança no
 * número inteiro. Abaixo da crise a banda já diz tudo que precisa ser dito.
 *
 * Regra de apresentação, de propósito fora do cálculo: o `trend` continua real
 * e disponível pra quem quiser usá-lo (telemetria, coach, futuras telas).
 */
export function shouldShowTrend(pulse: Pick<ClubPulse, 'band' | 'trend'>): boolean {
  if (pulse.band === 'crisis') return false;
  return pulse.trend !== 'flat';
}

/** Cor do band em token do design system — usada pelo hero e por badges. */
export function pulseColorToken(band: PulseBand): string {
  switch (band) {
    case 'fire': return 'var(--color-momentum-fire)';
    case 'high': return 'var(--color-neon-green)';
    case 'steady': return 'var(--color-neon-yellow)';
    case 'low': return 'var(--color-warning)';
    case 'crisis': return 'var(--color-danger)';
  }
}

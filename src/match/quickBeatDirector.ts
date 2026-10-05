/**
 * quickBeatDirector — lógica pura da Fase B do Quick Match 2.0.
 *
 * O Python entrega o plano com analyst_beats (leituras + decisões pesadas).
 * Este módulo aplica a decisão do manager nos eventos AINDA NÃO exibidos do
 * tempo corrente, de forma 100% determinística (SpiritRng seedado por
 * plan.seed + choice.id): mesma partida + mesma escolha = mesmo desfecho.
 *
 * Divisão de autoridade com o Python (docs/QUICK-ENGAGEMENT-REDESIGN.md):
 *   - Decisões do 1º tempo: efeito local só até o 45' (este módulo) e depois
 *     ecoadas no replan, onde o Python aplica nos 45' finais. Sem dupla conta.
 *   - Decisões do 2º tempo: efeito local até o 90' (não há outro replan).
 *
 * Também computa os VEREDITOS pós-jogo ("Sua leitura estava certa — o gol
 * saiu pelo corredor esquerdo") e a nota de Leitura de Jogo.
 */

import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import type {
  AnalystBeat,
  AnalystBeatChoice,
  ChoiceEffect,
  MatchPlanEvent,
  MatchupChannel,
} from './quickPlanTypes';
import { L, emIngles } from '@/i18n/L';

/** Buff base por tier de efeito: positivo +2.5% · neutro 0% · negativo −2.5%. */
export const EFFECT_BUFF_PCT: Record<ChoiceEffect, number> = {
  positive: 2.5,
  neutral: 0,
  negative: -2.5,
};

/** % → peso do motor de flip (escala onde 2.5% ≈ 0.25 de weight). */
export function buffPctToWeight(pct: number): number {
  return pct / 10;
}

/** Janela do buff em minutos de jogo (~10s reais no ritmo da Partida Rápida). */
export const BUFF_WINDOW_MINUTES = 12;

export interface DecisionCrit {
  /** 1 (normal), 2 ou 3 (crítico). */
  mult: 1 | 2 | 3;
  isCrit: boolean;
}

/**
 * Rola o CRÍTICO de uma decisão: 5% de chance de crítico; quando crítico,
 * multiplica o buff por 2× ou 3× (50/50). Determinístico por seed+beatId pra o
 * replay bater. Caso comum (95%): 1× (sem crítico).
 */
export function rollDecisionCrit(seed: string, beatId: string): DecisionCrit {
  const rng = new SpiritRng(hashSeed(`${seed}:crit:${beatId}`));
  if (rng.next() < 0.05) {
    const mult = rng.next() < 0.5 ? 2 : 3;
    return { mult, isCrit: true };
  }
  return { mult: 1, isCrit: false };
}

/** Decisão registrada no ledger local (ecoada no replan via QuickPlanDecision). */
export interface BeatDecisionRecord {
  beat_id: string;
  choice_id: string;
  minute: number;
  half: 1 | 2;
  label: string;
  channel: MatchupChannel;
  target_side: 'home' | 'away';
  weight: number;
}

export interface BeatVerdict {
  beatId: string;
  minute: number;
  choiceLabel: string;
  kind: 'hit' | 'neutral' | 'miss';
  text: string;
}

export type QuickFeedKind =
  | 'insight' | 'decision' | 'halftime'
  | 'goal_home' | 'goal_away'
  | 'save' | 'chance' | 'woodwork' | 'counter' | 'penalty' | 'red'
  | 'yellow' | 'injury';

export interface QuickPlanFeedItem {
  id: string;
  minute: number;
  kind: QuickFeedKind;
  text: string;
  /** Lado do protagonista — pra foto/realce no feed (item 8). */
  side?: 'home' | 'away';
  /** actor_id do evento, quando houver — usado pra puxar a foto do jogador. */
  actorId?: string;
}

/** Feed enxuto: itens de alto sinal apenas (tese "dois planos" da spec). */
export const QUICK_PLAN_FEED_MAX = 10;

/** Quase-gols que uma boa leitura pode CONVERTER em gol (ou que punem). */
const NEAR_MISS_HOME = new Set<MatchPlanEvent['kind']>(['shot_home', 'chance_home', 'save_home', 'woodwork_home']);
const NEAR_MISS_AWAY = new Set<MatchPlanEvent['kind']>(['shot_away', 'chance_away', 'save_away', 'woodwork_away']);
/** Ameaças REAIS do adversário que o escudo neutraliza (chute fraco fica de fora). */
const THREAT_AWAY = new Set<MatchPlanEvent['kind']>(['goal_away', 'chance_away', 'save_away', 'woodwork_away']);

/** Concordância PT-BR por canal — espelha CHANNEL_GENDER do analyst_beats.py. */
const CHANNEL_PT: Record<MatchupChannel, { label: string; em: string; por: string }> = {
  ataque_central: { label: 'ataque central', em: 'no', por: 'pelo' },
  corredor_esquerdo: { label: 'corredor esquerdo', em: 'no', por: 'pelo' },
  corredor_direito: { label: 'corredor direito', em: 'no', por: 'pelo' },
  criacao: { label: 'criação de jogo', em: 'na', por: 'pela' },
  bola_parada: { label: 'bola parada', em: 'na', por: 'pela' },
  finalizacao_vs_gk: { label: 'finalização', em: 'na', por: 'pela' },
  pressao: { label: 'pressão alta', em: 'na', por: 'pela' },
};

/** Rótulo de tela EN por canal (em/por viram preposição inglesa). */
const CHANNEL_EN: Record<MatchupChannel, { label: string; em: string; por: string }> = {
  ataque_central: { label: 'central attack', em: 'on the', por: 'through the' },
  corredor_esquerdo: { label: 'left flank', em: 'on the', por: 'down the' },
  corredor_direito: { label: 'right flank', em: 'on the', por: 'down the' },
  criacao: { label: 'build-up play', em: 'in the', por: 'through the' },
  bola_parada: { label: 'set pieces', em: 'on', por: 'from' },
  finalizacao_vs_gk: { label: 'finishing', em: 'on', por: 'through' },
  pressao: { label: 'high press', em: 'on the', por: 'through the' },
};

export function channelPt(ch: MatchupChannel) {
  if (emIngles()) return CHANNEL_EN[ch] ?? { label: ch, em: 'on', por: 'through' };
  return CHANNEL_PT[ch] ?? { label: ch, em: 'no', por: 'pelo' };
}

/** FNV-1a — string → seed uint32 pro SpiritRng. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function toDecisionRecord(beat: AnalystBeat, choice: AnalystBeatChoice): BeatDecisionRecord {
  return {
    beat_id: beat.id,
    choice_id: choice.id,
    minute: beat.minute,
    half: beat.half,
    label: choice.label,
    channel: choice.channel,
    target_side: choice.target_side,
    weight: choice.weight,
  };
}

function upgradeToHomeGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { por, label } = channelPt(ch);
  return {
    ...e,
    kind: 'goal_home',
    weight_tier: 'epic',
    text: L(`${e.minute}' — GOOOL! Você mandou atacar ${por} ${label} e deu certo — bola na rede!`, `${e.minute}' — GOAL! You called the attack ${por} ${label} and it worked — back of the net!`),
    reason: L('sua leitura abriu o caminho', 'your read opened the way'),
    decision_influenced: true,
  };
}

function downgradeHomeGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { em, label } = channelPt(ch);
  return {
    ...e,
    kind: 'shot_home',
    weight_tier: 'normal',
    text: L(`${e.minute}' — Bateu na trave da insistência ${em} ${label}: a marcação já esperava. Faltou ler melhor.`, `${e.minute}' — Kept insisting ${em} ${label}: the marking was ready for it. Should have read it better.`),
    reason: L('canal fechado — a teimosia custou', 'channel closed — stubbornness cost you'),
    decision_influenced: true,
  };
}

function downgradeAwayGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { label } = channelPt(ch);
  return {
    ...e,
    kind: 'shot_away',
    weight_tier: 'big',
    text: L(`${e.minute}' — Travou! Você fechou a ${label} deles e o perigo morreu na marcação. Leitura cirúrgica.`, `${e.minute}' — Shut down! You closed their ${label} and the danger died in the marking. Surgical read.`),
    reason: L('sua decisão defensiva segurou o canal', 'your defensive call held the channel'),
    decision_influenced: true,
  };
}

function upgradeToAwayGoal(e: MatchPlanEvent): MatchPlanEvent {
  return {
    ...e,
    kind: 'goal_away',
    weight_tier: 'big',
    text: L(`${e.minute}' — Deu ruim: o adversário achou o buraco que a sua aposta deixou e não perdoou.`, `${e.minute}' — It backfired: the opponent found the gap your gamble left and made no mistake.`),
    reason: L('escolha errada cobrou o preço', 'wrong call, and it cost you'),
    decision_influenced: true,
  };
}

/**
 * Aplica a decisão nos eventos ainda não exibidos do tempo do beat.
 * Determinístico: SpiritRng(plan.seed + choice.id). Retorna novo array.
 */
export function applyDecisionToRemainingEvents(opts: {
  events: MatchPlanEvent[];
  fromIndex: number;
  /** Beat completo (decisão) OU, pra reações de lead-in, use atMinute/half. */
  beat?: AnalystBeat;
  atMinute?: number;
  half?: 1 | 2;
  choice: AnalystBeatChoice;
  seed: string;
  /** Limita o efeito do buff a uma janela de minutos (default: até o fim do tempo). */
  windowMinutes?: number;
}): { events: MatchPlanEvent[]; flips: number } {
  const { events, fromIndex, beat, choice, seed, windowMinutes } = opts;
  const half = beat?.half ?? opts.half ?? 1;
  const atMinute = beat?.minute ?? opts.atMinute ?? 0;
  const rng = new SpiritRng(hashSeed(`${seed}:${choice.id}`));
  const halfEnd = half === 1 ? 45 : 90;
  // Buff dura uma JANELA (≈10s): só os lances dentro dela sentem o efeito.
  const windowEnd = windowMinutes != null ? Math.min(halfEnd, atMinute + windowMinutes) : halfEnd;
  const w = choice.weight;
  let flips = 0;

  const out = events.map((e, i) => {
    if (i < fromIndex || e.minute < atMinute || e.minute > windowEnd) return e;

    if (choice.target_side === 'home' && w > 0) {
      // Explorar canal com vantagem: quase-gols do home no canal podem virar gol
      // (cara a cara, defensaça e chute de fora — todos "quase" que a leitura converte)
      if (NEAR_MISS_HOME.has(e.kind) && e.channel === choice.channel) {
        const p = Math.min(0.5, (e.xg ?? 0.12) * w * 3.2 + 0.05);
        if (rng.next() < p) {
          flips += 1;
          return upgradeToHomeGoal(e, choice.channel);
        }
      }
    } else if (choice.target_side === 'home' && w < 0) {
      // Armadilha: gols do home no canal podem morrer; o away ganha fôlego
      if (e.kind === 'goal_home' && e.channel === choice.channel) {
        if (rng.next() < Math.min(0.6, Math.abs(w) * 1.8)) {
          flips += 1;
          return downgradeHomeGoal(e, choice.channel);
        }
      }
      if (NEAR_MISS_AWAY.has(e.kind)) {
        const p = Math.min(0.35, (e.xg ?? 0.1) * Math.abs(w) * 1.6 + 0.03);
        if (rng.next() < p) {
          flips += 1;
          return upgradeToAwayGoal(e);
        }
      }
    } else if (choice.target_side === 'away' && w > 0) {
      // Escudo: ameaças REAIS do away naquele canal (gol/cara a cara/defensaça/
      // trave) são neutralizadas. Chute fraco não precisa de escudo.
      if (THREAT_AWAY.has(e.kind) && e.channel === choice.channel) {
        if (rng.next() < Math.min(0.6, w * 2.5)) {
          flips += 1;
          return downgradeAwayGoal(e, choice.channel);
        }
      }
    } else if (choice.target_side === 'away' && w < 0) {
      // Defesa ERRADA: a leitura ruim abre o canal e um quase-gol do adversário vira gol.
      if (NEAR_MISS_AWAY.has(e.kind)) {
        const p = Math.min(0.35, (e.xg ?? 0.1) * Math.abs(w) * 1.6 + 0.03);
        if (rng.next() < p) {
          flips += 1;
          return upgradeToAwayGoal(e);
        }
      }
    }
    return e;
  });

  return { events: out, flips };
}

/**
 * Jogar com um a menos (vermelho) PESA no resto do jogo: parte dos gols da casa
 * vira só chute e parte dos quase-gols do adversário vira gol. Determinístico.
 */
export function applyManDownPenalty(opts: {
  events: MatchPlanEvent[];
  fromIndex: number;
  seed: string;
}): MatchPlanEvent[] {
  const { events, fromIndex, seed } = opts;
  const rng = new SpiritRng(hashSeed(`${seed}:mandown`));
  return events.map((e, i) => {
    if (i < fromIndex) return e;
    if (e.kind === 'goal_home' && rng.next() < 0.35) {
      return { ...e, kind: 'shot_home', weight_tier: 'normal', text: L(`${e.minute}' — Com um a menos, o time não chega: a finalização sai fraca.`, `${e.minute}' — A man down, the team can't get there: the shot comes out weak.`), reason: L('desfalque numérico pesou', 'being a man down told') };
    }
    if ((e.kind === 'shot_away' || e.kind === 'chance_away') && rng.next() < 0.3) {
      return { ...e, kind: 'goal_away', weight_tier: 'big', text: L(`${e.minute}' — O espaço deixado pelo expulso vira gol do adversário.`, `${e.minute}' — The space left by the sent-off player becomes an opponent goal.`), reason: L('um a menos cobrou o preço', 'a man down, and it cost you') };
    }
    return e;
  });
}

/**
 * Efeito de uma SUBSTITUIÇÃO no meio do jogo (sem replan): o saldo de OVR entre
 * quem entra e quem sai pesa no resto. Sub melhor pode transformar um quase-gol
 * da casa em gol; sub pior pode esfriar um gol. Determinístico por seed+outId.
 */
export function applySubNudge(opts: {
  events: MatchPlanEvent[];
  fromIndex: number;
  ovrDelta: number; // inOvr - outOvr (efetivo)
  seed: string;
  outId: string;
  /** Ponte #3: fadiga do que sai − fadiga do que entra (>0 = reforço mais fresco). */
  freshnessDelta?: number;
  /** Ponte #3: o reforço entra na MESMA posição do que saiu? (encaixe). */
  posMatch?: boolean;
}): MatchPlanEvent[] {
  const { events, fromIndex, ovrDelta, seed, outId, freshnessDelta = 0, posMatch = true } = opts;
  // Delta EFETIVO: OVR + pernas frescas (até ~+8 com 65% de diferença) + encaixe.
  // Assim trocar um craque cansado por reserva fresco PESA mesmo sem ganho de OVR.
  const effDelta = ovrDelta + freshnessDelta * 0.12 + (posMatch ? 1.5 : -3);
  if (Math.abs(effDelta) < 3) return events; // troca neutra, sem efeito
  const rng = new SpiritRng(hashSeed(`${seed}:sub:${outId}`));
  const better = effDelta > 0;
  const strength = Math.min(0.5, Math.abs(effDelta) / 30); // 3→0.1 … 15+→0.5
  let used = false;
  return events.map((e, i) => {
    if (used || i < fromIndex) return e;
    if (better && (e.kind === 'shot_home' || e.kind === 'chance_home') && rng.next() < strength) {
      used = true;
      return { ...e, kind: 'goal_home', weight_tier: 'big', text: L(`${e.minute}' — O reforço que entrou resolve — bola na rede!`, `${e.minute}' — The sub settles it — back of the net!`), reason: L('sangue novo decidiu', 'fresh legs decided it'), decision_influenced: true };
    }
    if (!better && e.kind === 'goal_home' && rng.next() < strength) {
      used = true;
      return { ...e, kind: 'shot_home', weight_tier: 'normal', text: L(`${e.minute}' — A troca não encaixou: a jogada esfria e a finalização sai fraca.`, `${e.minute}' — The change didn't click: the move cools off and the shot is weak.`), reason: L('substituição custou ritmo', 'the substitution cost rhythm'), decision_influenced: true };
    }
    return e;
  });
}

export interface DisciplinePlayer {
  id: string;
  name: string;
  fatigue: number;
  /** Ponte #2: menos fair play = mais propenso a cartão. Default 70 (neutro). */
  fairPlay?: number;
}

/**
 * Semeia eventos de DISCIPLINA/FÍSICO (amarelo, vermelho, lesão) no plano — o
 * motor Python quase não os gera. Determinístico por seed; ponderado por fadiga
 * (mais cansado = mais chance de cartão/lesão). 2º amarelo do mesmo jogador vira
 * vermelho. Os eventos resultantes passam pela máquina existente do player
 * (vermelho → 1 a menos; lesão home → substituição forçada; feed pros demais).
 */
export function sprinkleDisciplineEvents(opts: {
  events: MatchPlanEvent[];
  home: DisciplinePlayer[];
  away: DisciplinePlayer[];
  seed: string;
}): MatchPlanEvent[] {
  const { events, home, away, seed } = opts;
  const rng = new SpiritRng(hashSeed(`${seed}:discipline`));
  const extra: MatchPlanEvent[] = [];

  const pickWeighted = (players: DisciplinePlayer[]): DisciplinePlayer | null => {
    if (!players.length) return null;
    // Fadiga + indisciplina (fair play baixo) puxam o cartão pro jogador certo.
    const weights = players.map((p) => 1 + Math.max(0, p.fatigue) / 25 + Math.max(0, 70 - (p.fairPlay ?? 70)) / 20);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < players.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return players[i]!;
    }
    return players[players.length - 1]!;
  };
  const minuteSlot = (lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo));

  const genSide = (players: DisciplinePlayer[], side: 'home' | 'away') => {
    if (!players.length) return;
    const yellowedAt = new Map<string, number>();
    const nYellow = 1 + Math.floor(rng.next() * 3); // 1–3 amarelos
    for (let k = 0; k < nYellow; k++) {
      const p = pickWeighted(players);
      if (!p) continue;
      const minute = minuteSlot(12, 88);
      const prev = yellowedAt.get(p.id);
      // 2º amarelo → vermelho sai mais fácil pra quem tem fair play baixo.
      const redChance = Math.min(0.85, 0.5 * (1 + Math.max(0, 60 - (p.fairPlay ?? 70)) / 40));
      if (prev !== undefined && rng.next() < redChance) {
        const m = Math.min(90, Math.max(minute, prev + 5));
        extra.push({
          minute: m, kind: `red_${side}` as MatchPlanEvent['kind'], actor_id: p.id, actor_name: p.name,
          actor_side: side, weight_tier: 'big', zone: 'mid',
          text: L(`${m}' — Segundo amarelo! ${p.name} tá fora.`, `${m}' — Second yellow! ${p.name} is off.`), reason: L('segundo amarelo', 'second yellow'),
        });
      } else {
        yellowedAt.set(p.id, minute);
        extra.push({
          minute, kind: `yellow_${side}` as MatchPlanEvent['kind'], actor_id: p.id, actor_name: p.name,
          actor_side: side, weight_tier: 'minor', zone: 'mid',
          text: L(`${minute}' — Amarelo para ${p.name}.`, `${minute}' — Yellow for ${p.name}.`), reason: L('falta tática', 'tactical foul'),
        });
      }
    }
    // Lesão: chance ponderada pela maior fadiga do lado.
    const maxFat = players.reduce((m, p) => Math.max(m, p.fatigue), 0);
    const injuryChance = 0.1 + (Math.max(0, maxFat - 70) / 30) * 0.25; // 0.10–0.35
    if (rng.next() < injuryChance) {
      const p = [...players].sort((a, b) => b.fatigue - a.fatigue)[0];
      if (p) {
        const minute = minuteSlot(20, 80);
        extra.push({
          minute, kind: `injury_${side}` as MatchPlanEvent['kind'], actor_id: p.id, actor_name: p.name,
          actor_side: side, weight_tier: 'big', zone: 'mid',
          text: L(`${minute}' — ${p.name} sente e não consegue continuar.`, `${minute}' — ${p.name} pulls up and can't continue.`), reason: L('desgaste físico', 'physical wear'),
        });
      }
    }
  };

  genSide(home, 'home');
  genSide(away, 'away');

  if (!extra.length) return events;
  return [...events, ...extra].sort((a, b) => a.minute - b.minute);
}

export interface LiveBeatStat { id: string; side: 'home' | 'away'; goals: number; shots: number; }
export interface LiveBeatAwayPlayer { pos: string; fatigue: number; }

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

/** Situação real do jogo: 3 opções (a CERTA é inferível do texto). */
interface SituationTemplate {
  intent: 'attack' | 'defend' | 'neutral';
  targetSide: 'home' | 'away';
  channel: MatchupChannel;
  /** [positiva, neutra, negativa] — a ordem é embaralhada na UI. */
  labels: [string, string, string];
}

/** Monta o texto da situação (suporta {flank}/{star} preenchidos pelo builder). */
type SituationFactory = (ctx: { flank: string; star: string; right: boolean }) => { insight: string; tpl: SituationTemplate };

const DEFEND_SITUATIONS: SituationFactory[] = [
  ({ flank, right }) => ({ insight: L(`Adversário cruzando ${flank}`, `Opponent crossing ${flank}`), tpl: { intent: 'defend', targetSide: 'away', channel: right ? 'corredor_direito' : 'corredor_esquerdo', labels: [L('Marcar nas laterais', 'Mark the flanks'), L('Manter posicionamento', 'Hold position'), L('Subir a linha', 'Push the line up')] } }),
  () => ({ insight: L('Eles pressionam em bloco alto', 'They press with a high block'), tpl: { intent: 'defend', targetSide: 'away', channel: 'pressao', labels: [L('Sair jogando rápido', 'Play out quickly'), L('Tocar de lado', 'Pass sideways'), L('Lançar na loteria', 'Hit it and hope')] } }),
  () => ({ insight: L('Contra-ataque deles em velocidade', 'Their counter-attack at speed'), tpl: { intent: 'defend', targetSide: 'away', channel: 'ataque_central', labels: [L('Falta tática no meio', 'Tactical foul in midfield'), L('Recompor a marcação', 'Recover the marking'), L('Dar o bote isolado', 'Lunge in alone')] } }),
  () => ({ insight: L('Escanteio perigoso pra eles', 'Dangerous corner for them'), tpl: { intent: 'defend', targetSide: 'away', channel: 'bola_parada', labels: [L('Marcação por zona', 'Zonal marking'), L('Marcação individual', 'Man marking'), L('Subir o goleiro', 'Send the keeper up')] } }),
];

const ATTACK_SITUATIONS: SituationFactory[] = [
  ({ flank, right }) => ({ insight: L(`Lateral deles exposto ${flank}`, `Their full-back exposed ${flank}`), tpl: { intent: 'attack', targetSide: 'home', channel: right ? 'corredor_direito' : 'corredor_esquerdo', labels: [L('Atacar pelo corredor', 'Attack down the flank'), L('Manter o meio', 'Hold the middle'), L('Insistir no chutão', 'Keep hoofing it')] } }),
  () => ({ insight: L('Goleiro deles inseguro', 'Their keeper looks shaky'), tpl: { intent: 'attack', targetSide: 'home', channel: 'finalizacao_vs_gk', labels: [L('Finalizar de primeira', 'Shoot first time'), L('Trabalhar a jogada', 'Work the move'), L('Driblar demais', 'Over-dribble')] } }),
  () => ({ insight: L('Espaço nas costas da zaga', 'Space behind their defence'), tpl: { intent: 'attack', targetSide: 'home', channel: 'ataque_central', labels: [L('Lançar nas costas', 'Ball in behind'), L('Posse no meio', 'Keep it in midfield'), L('Recuar a bola', 'Play it back')] } }),
  ({ star }) => ({ insight: L(`${star} está ligado`, `${star} is on fire`), tpl: { intent: 'attack', targetSide: 'home', channel: 'finalizacao_vs_gk', labels: [L(`Municiar ${star}`, `Feed ${star}`), L('Jogo coletivo', 'Team play'), L('Isolar na ponta', 'Isolate on the wing')] } }),
];

const NEUTRAL_SITUATIONS: SituationFactory[] = [
  () => ({ insight: L('Jogo travado no meio', 'Game stuck in midfield'), tpl: { intent: 'neutral', targetSide: 'home', channel: 'criacao', labels: [L('Acelerar pelos lados', 'Speed up on the flanks'), L('Manter a posse', 'Keep possession'), L('Chutar de longe', 'Shoot from distance')] } }),
  () => ({ insight: L('Time pedindo fôlego', 'Team needs a breather'), tpl: { intent: 'neutral', targetSide: 'home', channel: 'pressao', labels: [L('Segurar a bola', 'Hold the ball'), L('Ritmo normal', 'Normal tempo'), L('Pressionar alto', 'Press high')] } }),
];

const EFFECT_ORDER: ChoiceEffect[] = ['positive', 'neutral', 'negative'];

/**
 * Gera o beat do Analista a partir do estado REAL da partida (não mock): uma
 * SITUAÇÃO concreta (cruzamento, contra-ataque, lateral exposto…) com SEMPRE 3
 * opções de efeito (positivo +2.5% / neutro 0% / negativo −2.5%). A ordem das
 * opções é embaralhada (determinística) — a resposta certa é inferível do texto.
 */
export function buildLiveAnalystBeat(opts: {
  beatId: string;
  minute: number;
  index: number; // qual beat (0..) → rotaciona a situação
  homeScore: number;
  awayScore: number;
  momentum: number; // 0..100 (viés casa)
  homeStats: LiveBeatStat[];
  homeNameById: Record<string, string>;
  awayPlayers: LiveBeatAwayPlayer[];
}): AnalystBeat {
  const trend: 'rising' | 'falling' | 'stable' =
    opts.momentum > 55 ? 'rising' : opts.momentum < 45 ? 'falling' : 'stable';
  const half: 1 | 2 = opts.minute <= 45 ? 1 : 2;
  const rng = new SpiritRng(hashSeed(`${opts.beatId}:situation`));

  // Flanco cansado do adversário (estima fadiga corrente pelo minuto).
  const live = (f: number) => Math.min(100, (f || 0) + opts.minute * 0.5);
  const avgFlank = (poss: string[]) => {
    const g = opts.awayPlayers.filter((p) => poss.includes(p.pos.toUpperCase()));
    return g.length ? g.reduce((s, p) => s + live(p.fatigue), 0) / g.length : 0;
  };
  const right = avgFlank(['LD', 'PD']) >= avgFlank(['LE', 'PE']);
  const flank = right ? L('pela direita', 'on the right') : L('pela esquerda', 'on the left');
  const best = opts.homeStats
    .filter((s) => s.side === 'home')
    .sort((a, b) => b.goals * 3 + b.shots - (a.goals * 3 + a.shots))[0];
  const star = best && best.goals + best.shots > 0
    ? firstName(opts.homeNameById[best.id] ?? L('o craque', 'the star'))
    : L('o craque', 'the star');

  // Categoria pela leitura do jogo: perdendo/sob pressão → defesa; com a bola e
  // momento → ataque; senão neutro. Rotaciona dentro da categoria pelo índice.
  const losing = opts.homeScore < opts.awayScore;
  const category: SituationFactory[] =
    losing || opts.momentum < 43 ? DEFEND_SITUATIONS
      : opts.momentum > 57 || opts.homeScore > opts.awayScore ? ATTACK_SITUATIONS
        : NEUTRAL_SITUATIONS;
  const factory = category[opts.index % category.length]!;
  const { insight, tpl } = factory({ flank, star, right });

  // 3 escolhas (positivo/neutro/negativo) → peso por tier; ordem embaralhada.
  const built = EFFECT_ORDER.map((effect, i) => ({
    id: `${opts.beatId}-${effect}`,
    label: tpl.labels[i]!,
    channel: tpl.channel,
    target_side: tpl.targetSide,
    weight: buffPctToWeight(EFFECT_BUFF_PCT[effect]),
    effect,
  }));
  // Fisher-Yates determinístico pra a ordem dos botões não denunciar o tier.
  for (let i = built.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [built[i], built[j]] = [built[j]!, built[i]!];
  }

  return {
    id: opts.beatId,
    minute: opts.minute,
    half,
    intent: tpl.intent,
    insight: { text: insight, primary_channel: tpl.channel, threat_channel: 'ataque_central', momentum_trend: trend },
    choices: built,
    window_ms: 6000,
  };
}

/** Chamada de transição: o texto curto que ANTECEDE um lance de alto sinal pra
 *  dar contexto ("Olha o contra-ataque!") — o gol deixa de sair "do nada". */
/** Uma opção de reação à chamada (label + tier de efeito). */
export interface ReactionChoice {
  label: string;
  effect: ChoiceEffect; // positive=certa · neutral=segura · negative=errada
}

export interface TransitionLeadIn {
  /** id da situação (telemetria/teste). */
  kind: string;
  text: string;
  intent: 'attack' | 'defend' | 'neutral';
  /** SEMPRE 3 opções (negativo/neutro/positivo), ordem embaralhada — a certa é
   *  inferível do texto. Vazio só nas chamadas de gol (que usam o clutch). */
  reactions: ReactionChoice[];
}

/** Tripla de reação (positiva/neutra/negativa) por situação × intenção. */
interface ReactionTriple { positive: string; neutral: string; negative: string }

const TRANSITION_REACTIONS: Record<string, { attack: ReactionTriple; defend: ReactionTriple }> = {
  rebote: {
    attack: { positive: 'NA SOBRA!', neutral: 'RECOMPOR', negative: 'TOCAR PRA TRÁS' },
    defend: { positive: 'AFASTAR!', neutral: 'MANTER POSIÇÃO', negative: 'SAIR JOGANDO' },
  },
  contra_pro: {
    attack: { positive: 'ACELERAR!', neutral: 'MANTER POSSE', negative: 'SEGURAR' },
    defend: { positive: 'RECUAR!', neutral: 'MANTER', negative: 'PRESSIONAR' },
  },
  contra_sofrido: {
    attack: { positive: 'ACELERAR!', neutral: 'MANTER POSSE', negative: 'SEGURAR' },
    defend: { positive: 'RECUAR!', neutral: 'MANTER', negative: 'PRESSIONAR' },
  },
  bola_parada: {
    attack: { positive: 'SUBIR PRA ÁREA!', neutral: 'JOGADA ENSAIADA', negative: 'BATER DIRETO' },
    defend: { positive: 'MARCAR FORTE!', neutral: 'MANTER ZONA', negative: 'SUBIR A LINHA' },
  },
  falha: {
    attack: { positive: 'APROVEITAR!', neutral: 'CONSTRUIR', negative: 'ENROLAR' },
    defend: { positive: 'COBRIR!', neutral: 'MANTER', negative: 'ARRISCAR SAÍDA' },
  },
  pressao: {
    attack: { positive: 'ROUBAR ALTO!', neutral: 'MANTER', negative: 'RECUAR' },
    defend: { positive: 'SAIR JOGANDO!', neutral: 'TOCAR DE LADO', negative: 'LANÇAR NA LOTERIA' },
  },
  individual: {
    attack: { positive: 'OUSAR!', neutral: 'TOCAR', negative: 'ISOLAR' },
    defend: { positive: 'DOBRAR MARCAÇÃO!', neutral: 'CONTER', negative: 'DAR O BOTE' },
  },
  cruzamento: {
    attack: { positive: 'ATACAR A BOLA!', neutral: 'SEGURAR', negative: 'CHUTAR DE LONGE' },
    defend: { positive: 'AFASTAR CRUZAMENTO!', neutral: 'MARCAR ZONA', negative: 'SUBIR A LINHA' },
  },
  golaco: {
    attack: { positive: 'ARRISCAR!', neutral: 'TRABALHAR', negative: 'RECUAR' },
    defend: { positive: 'BLOQUEAR!', neutral: 'FECHAR ÂNGULO', negative: 'DAR ESPAÇO' },
  },
  lancamento: {
    attack: { positive: 'LANÇAR!', neutral: 'MANTER POSSE', negative: 'RECUAR' },
    defend: { positive: 'RECUAR A LINHA!', neutral: 'MANTER', negative: 'LINHA ALTA' },
  },
  chegada: {
    attack: { positive: 'FINALIZAR!', neutral: 'TRABALHAR', negative: 'RECUAR' },
    defend: { positive: 'FECHAR!', neutral: 'MANTER', negative: 'SAIR PRA CIMA' },
  },
};

const TRANSITION_REACTIONS_EN: Record<string, { attack: ReactionTriple; defend: ReactionTriple }> = {
  rebote: {
    attack: { positive: 'ON THE REBOUND!', neutral: 'REGROUP', negative: 'PLAY IT BACK' },
    defend: { positive: 'CLEAR IT!', neutral: 'HOLD POSITION', negative: 'PLAY OUT' },
  },
  contra_pro: {
    attack: { positive: 'SPEED UP!', neutral: 'KEEP POSSESSION', negative: 'HOLD' },
    defend: { positive: 'DROP BACK!', neutral: 'HOLD', negative: 'PRESS' },
  },
  contra_sofrido: {
    attack: { positive: 'SPEED UP!', neutral: 'KEEP POSSESSION', negative: 'HOLD' },
    defend: { positive: 'DROP BACK!', neutral: 'HOLD', negative: 'PRESS' },
  },
  bola_parada: {
    attack: { positive: 'GET IN THE BOX!', neutral: 'SET PLAY', negative: 'SHOOT DIRECT' },
    defend: { positive: 'MARK TIGHT!', neutral: 'HOLD THE ZONE', negative: 'PUSH THE LINE UP' },
  },
  falha: {
    attack: { positive: 'PUNISH IT!', neutral: 'BUILD UP', negative: 'DITHER' },
    defend: { positive: 'COVER!', neutral: 'HOLD', negative: 'RISK PLAYING OUT' },
  },
  pressao: {
    attack: { positive: 'WIN IT HIGH!', neutral: 'HOLD', negative: 'DROP BACK' },
    defend: { positive: 'PLAY OUT!', neutral: 'PASS SIDEWAYS', negative: 'HIT AND HOPE' },
  },
  individual: {
    attack: { positive: 'TAKE HIM ON!', neutral: 'PASS', negative: 'ISOLATE' },
    defend: { positive: 'DOUBLE UP!', neutral: 'CONTAIN', negative: 'DIVE IN' },
  },
  cruzamento: {
    attack: { positive: 'ATTACK THE BALL!', neutral: 'HOLD', negative: 'SHOOT FROM DISTANCE' },
    defend: { positive: 'CLEAR THE CROSS!', neutral: 'MARK THE ZONE', negative: 'PUSH THE LINE UP' },
  },
  golaco: {
    attack: { positive: 'GO FOR IT!', neutral: 'WORK IT', negative: 'DROP BACK' },
    defend: { positive: 'BLOCK!', neutral: 'CLOSE THE ANGLE', negative: 'GIVE SPACE' },
  },
  lancamento: {
    attack: { positive: 'PLAY IT LONG!', neutral: 'KEEP POSSESSION', negative: 'DROP BACK' },
    defend: { positive: 'DROP THE LINE!', neutral: 'HOLD', negative: 'HIGH LINE' },
  },
  chegada: {
    attack: { positive: 'SHOOT!', neutral: 'WORK IT', negative: 'DROP BACK' },
    defend: { positive: 'SHUT IT DOWN!', neutral: 'HOLD', negative: 'STEP OUT' },
  },
};

/** Monta as 3 reações (neg/neutro/pos) e embaralha determinístico por minuto. */
function buildReactions(kind: string, intent: 'attack' | 'defend', minute: number): ReactionChoice[] {
  const t = (emIngles() ? TRANSITION_REACTIONS_EN : TRANSITION_REACTIONS)[kind]?.[intent] ?? {
    positive: intent === 'attack' ? L('ATACAR!', 'ATTACK!') : L('FECHAR!', 'SHUT IT DOWN!'),
    neutral: L('MANTER', 'HOLD'),
    negative: intent === 'attack' ? L('RECUAR', 'DROP BACK') : L('SUBIR A LINHA', 'PUSH THE LINE UP'),
  };
  const out: ReactionChoice[] = [
    { label: t.positive, effect: 'positive' },
    { label: t.neutral, effect: 'neutral' },
    { label: t.negative, effect: 'negative' },
  ];
  const rng = new SpiritRng(hashSeed(`${kind}:${minute}:react`));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Classifica a SITUAÇÃO que antecede um lance de alto sinal (gol, contra-ataque,
 * chance grande), pra anunciar o contexto antes de mostrar o desfecho. Cobre as
 * 10 situações principais; cai num genérico só pra gol (nunca um gol "do nada").
 * Decisão tática já tem contexto próprio (feed) → não anuncia.
 */
export function classifyTransition(opts: {
  event: MatchPlanEvent;
  /** Momento da casa (0..100) no minuto do lance. */
  momentumHome: number;
  /** Tipo do lance imediatamente anterior (pra detectar rebote/sobra). */
  prevKind?: MatchPlanEvent['kind'];
}): TransitionLeadIn | null {
  const e = opts.event;
  if (e.decision_influenced) return null; // já explicado pela decisão do manager

  const isGoal = e.kind === 'goal_home' || e.kind === 'goal_away';
  const isCounter = e.kind === 'counter_home' || e.kind === 'counter_away';
  const isBigChance = (e.kind === 'chance_home' || e.kind === 'chance_away')
    && (e.weight_tier === 'big' || e.weight_tier === 'epic');
  if (!isGoal && !isCounter && !isBigChance) return null;

  const home = e.actor_side === 'home';
  const mh = opts.momentumHome;
  const reason = (e.reason ?? '').toLowerCase();
  const ch = e.channel;
  const intent: 'attack' | 'defend' = home ? 'attack' : 'defend';
  const mk = (kind: string, text: string): TransitionLeadIn => ({
    kind,
    text,
    intent,
    reactions: buildReactions(kind, intent, e.minute),
  });

  // 1) Rebote/sobra — lance logo após defesaça/trave.
  if (opts.prevKind && (
    opts.prevKind === (home ? 'save_away' : 'save_home')
    || opts.prevKind === (home ? 'woodwork_home' : 'woodwork_away')
  )) {
    return mk('rebote', home ? L('Na sobra do rebote…', 'On the rebound…') : L('Sobra perigosa na nossa área…', 'Dangerous loose ball in our box…'));
  }
  // 2) Contra-ataque — gol/lance CONTRA o fluxo do jogo (a queixa do "do nada").
  if (isCounter || (isGoal && ((home && mh < 42) || (!home && mh > 58)))) {
    return home
      ? mk('contra_pro', L('Roubou e saiu no contra-ataque!', 'Won it and off on the counter!'))
      : mk('contra_sofrido', L('Cuidado — contra-ataque deles!', 'Careful — their counter-attack!'));
  }
  // 3) Bola parada / escanteio / falta.
  if (ch === 'bola_parada' || reason.includes('bola parada') || reason.includes('escanteio') || reason.includes('falta') || reason.includes('corner') || reason.includes('set piece') || reason.includes('free kick')) {
    return mk('bola_parada', home ? L('Na bola parada…', 'From the set piece…') : L('Bola parada perigosa pra eles…', 'Dangerous set piece for them…'));
  }
  // 4) Erro defensivo / presente.
  if (reason.includes('falha') || reason.includes('erro') || reason.includes('vacilo')) {
    return mk('falha', home ? L('Falha na saída deles — presente!', 'Error in their build-up — a gift!') : L('Vacilo nosso na saída…', 'Our slip in the build-up…'));
  }
  // 5) Pressão alta → roubada.
  if (ch === 'pressao') {
    return mk('pressao', home ? L('Pressão alta e roubou!', 'High press and won it!') : L('A pressão deles te sufoca…', 'Their press is smothering you…'));
  }
  // 6) Jogada individual de craque.
  if (ch === 'finalizacao_vs_gk' || reason.includes('individual') || reason.includes('drible')) {
    return mk('individual', home ? L('Lance individual de craque…', 'A moment of individual class…') : L('Individual deles assusta…', 'Their solo run is a scare…'));
  }
  // 7) Cruzamento na área (corredores).
  if (ch === 'corredor_esquerdo' || ch === 'corredor_direito') {
    return mk('cruzamento', home ? L('Cruzamento na área…', 'Cross into the box…') : L('Cruzamento perigoso pra eles…', 'Dangerous cross for them…'));
  }
  // 8) Golaço de longe (xG baixo).
  if (isGoal && (e.xg ?? 0.1) < 0.06) {
    return mk('golaco', home ? L('De muito longe… olha o chute!', 'From way out… look at this shot!') : L('Chutaram de longe…', 'They shot from distance…'));
  }
  // 9) Lançamento nas costas / ataque central.
  if (ch === 'ataque_central') {
    return mk('lancamento', home ? L('Lançou nas costas da zaga!', 'Ball in behind the defence!') : L('Acharam as costas da nossa zaga…', 'They found space behind our defence…'));
  }
  // 10) Construção / chegada com perigo (genérico — gol nunca sai "do nada").
  if (isGoal) {
    return mk('chegada', home ? L('Chegou com perigo…', 'Arriving with danger…') : L('Perigo na nossa área…', 'Danger in our box…'));
  }
  return null;
}

/** Veredito por decisão, computado sobre os eventos REALMENTE exibidos. */
export function computeBeatVerdicts(
  events: MatchPlanEvent[],
  ledger: BeatDecisionRecord[],
): BeatVerdict[] {
  return ledger.map((d) => {
    const { por, label } = channelPt(d.channel);
    const after = events.filter((e) => e.minute > d.minute);
    const base = { beatId: d.beat_id, minute: d.minute, choiceLabel: d.label };

    if (d.weight === 0) {
      return {
        ...base,
        kind: 'neutral' as const,
        text: L('Você manteve o plano — sem mexer no jogo, sem risco.', 'You kept the plan — no changes, no risk.'),
      };
    }
    if (d.weight < 0) {
      return {
        ...base,
        kind: 'miss' as const,
        text: L(`O canal estava fechado — insistir ${por.replace('pelo', 'no').replace('pela', 'na')} ${label} custou caro.`, `The channel was closed — insisting ${por} ${label} cost you.`),
      };
    }
    if (d.target_side === 'home') {
      if (after.some((e) => e.kind === 'goal_home' && e.channel === d.channel)) {
        return {
          ...base,
          kind: 'hit' as const,
          text: L(`Mandou bem — o gol saiu ${por} ${label}, exatamente onde você apontou.`, `Well read — the goal came ${por} ${label}, exactly where you pointed.`),
        };
      }
      if (after.some((e) => NEAR_MISS_HOME.has(e.kind) && e.channel === d.channel)) {
        return {
          ...base,
          kind: 'neutral' as const,
          text: L(`Quase! O time chegou ${por} ${label} — faltou o capricho na hora H.`, `Close! The team got there ${por} ${label} — lacked the final touch.`),
        };
      }
      return {
        ...base,
        kind: 'miss' as const,
        text: L(`O plano não saiu do papel — nada nasceu ${por} ${label} depois da decisão.`, `The plan never got going — nothing came ${por} ${label} after the call.`),
      };
    }
    // Escudo defensivo
    if (after.some((e) => e.kind === 'goal_away' && e.channel === d.channel)) {
      return {
        ...base,
        kind: 'miss' as const,
        text: L(`A trava não segurou: o gol deles saiu justamente ${por} ${label}.`, `The lock didn't hold: their goal came right ${por} ${label}.`),
      };
    }
    return {
      ...base,
      kind: 'hit' as const,
      text: L(`Trava perfeita — a ${label} deles não produziu nada depois da sua decisão.`, `Perfect lock — their ${label} produced nothing after your call.`),
    };
  });
}

/** Nota de Leitura de Jogo: escolhas com peso positivo / beats oferecidos. */
export function computeReadingScore(
  ledger: BeatDecisionRecord[],
  beatsOffered: number,
): { good: number; total: number } {
  return {
    good: ledger.filter((d) => d.weight > 0).length,
    total: Math.max(beatsOffered, ledger.length),
  };
}
